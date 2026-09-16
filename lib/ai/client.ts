import Anthropic from "@anthropic-ai/sdk";
import { recordUsage } from "./usage.ts";

// Lazy initialization to allow importing without env vars (for tests)
let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_, prop) {
    return Reflect.get(getAnthropic(), prop);
  },
});

// Use ANTHROPIC_MODEL in .env to override. Defaults to Haiku 4.5 - cheap and
// strong enough for the summarize/translate workload this app runs.
export const DEFAULT_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001";
export const MAX_TOKENS = 4096;

export type Message = {
  role: "user" | "assistant";
  content: string;
};

// --- Local (OpenAI-compatible) backends -------------------------------------
// Summarize + translate is the whole AI workload here, and it is the same shape
// arbora already runs locally, so it does not need a frontier model. With
// AI_LOCAL_MODE=primary each call goes to the local backends first and only
// falls back to Anthropic if every one of them fails. Local calls are recorded
// with a `local:` model id, which prices at $0 (lib/ai/pricing.ts) so they never
// consume AI_DAILY_BUDGET_USD — that cap exists to bound API spend.
//
// Env is read per call, not at module load, so tests and one-off scripts can
// flip modes without re-importing.

export interface LocalBackend {
  baseUrl: string;
  model: string;
}

/** Primary then fallback local backend, in the order they should be tried. */
function localBackends(): LocalBackend[] {
  const backends: LocalBackend[] = [];
  const add = (baseUrl?: string, model?: string) => {
    if (baseUrl && model) backends.push({ baseUrl: baseUrl.replace(/\/$/, ""), model });
  };
  add(Deno.env.get("AI_LOCAL_BASE_URL"), Deno.env.get("AI_LOCAL_MODEL"));
  add(Deno.env.get("AI_LOCAL_FALLBACK_BASE_URL"), Deno.env.get("AI_LOCAL_FALLBACK_MODEL"));
  return backends;
}

function localTimeoutMs(): number {
  const raw = Number(Deno.env.get("AI_LOCAL_TIMEOUT_MS"));
  return Number.isFinite(raw) && raw > 0 ? raw : 180_000;
}

/**
 * Floor for `max_tokens` on local backends. Reasoning models (gemma4 and
 * qwen3.5 via Ollama) spend tokens on a `reasoning` field before writing any
 * `content`, so the caller's budget — 1024 for a summary — is exhausted before
 * the answer starts and the completion comes back empty. Claude has no such
 * hidden preamble, which is why this floor is local-only.
 */
function localMaxTokens(): number {
  const raw = Number(Deno.env.get("AI_LOCAL_MAX_TOKENS"));
  return Number.isFinite(raw) && raw > 0 ? raw : 4096;
}

/**
 * OpenAI-compatible `reasoning_effort` sent on every local call — one setting
 * for both the primary and fallback backend, not a per-backend override.
 * Defaults to `"none"`: measured 2026-09-16 against the production LM Studio
 * backend (google/gemma-4-26b-a4b) with a 47-token prompt and max_tokens 300,
 * the default thinking pass took 13s and came back with an EMPTY completion
 * (completion_tokens_details.reasoning_tokens = 297 — the whole budget spent
 * before any answer was written); `"none"` took 1.8s for a 40-token answer.
 * Set AI_LOCAL_REASONING_EFFORT=omit to send no such field at all, for a
 * server that rejects unrecognised request fields.
 */
function localReasoningEffort(): string | undefined {
  const raw = (Deno.env.get("AI_LOCAL_REASONING_EFFORT") ?? "").trim();
  const value = raw === "" ? "none" : raw;
  return value === "omit" ? undefined : value;
}

/**
 * Per-process circuit breaker over local backends. A backend (identified by
 * its baseUrl+model) that fails AI_LOCAL_MAX_CONSECUTIVE_FAILURES times in a
 * row — timeout, non-OK response, empty completion, or network error, i.e.
 * anything sendViaLocal throws — is skipped for the rest of THIS process:
 * once a backend (e.g. a wedged LM Studio) is down, every subsequent paper
 * would otherwise pay its full timeout again before falling through to the
 * next backend. Any success resets that backend's count to zero.
 *
 * Module-level so it persists across calls within one process.
 * resetLocalBackendCircuit() clears it — for tests only.
 */
const localBackendFailures = new Map<string, number>();

function backendKey(backend: LocalBackend): string {
  return `${backend.baseUrl}::${backend.model}`;
}

function maxConsecutiveFailures(): number {
  const raw = Number(Deno.env.get("AI_LOCAL_MAX_CONSECUTIVE_FAILURES"));
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

function isBackendCircuitOpen(backend: LocalBackend): boolean {
  return (localBackendFailures.get(backendKey(backend)) ?? 0) >= maxConsecutiveFailures();
}

function recordLocalFailure(backend: LocalBackend): void {
  const key = backendKey(backend);
  const max = maxConsecutiveFailures();
  const failures = (localBackendFailures.get(key) ?? 0) + 1;
  localBackendFailures.set(key, failures);
  if (failures === max) {
    console.warn(
      `⚠️  Local backend ${backend.model} failed ${failures} times in a row — ` +
        `skipping it for the rest of this process`,
    );
  }
}

function recordLocalSuccess(backend: LocalBackend): void {
  localBackendFailures.delete(backendKey(backend));
}

/** Test-only: clear all circuit-breaker state so tests don't leak into each other. */
export function resetLocalBackendCircuit(): void {
  localBackendFailures.clear();
}

export async function sendViaLocal(
  backend: LocalBackend,
  params: {
    messages: Message[];
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  },
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const messages = params.systemPrompt
    ? [{ role: "system", content: params.systemPrompt }, ...params.messages]
    : params.messages;

  const reasoningEffort = localReasoningEffort();

  const response = await fetch(`${backend.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: backend.model,
      messages,
      max_tokens: Math.max(params.maxTokens || MAX_TOKENS, localMaxTokens()),
      temperature: params.temperature ?? 0.7,
      stream: false,
      // Omitted entirely when AI_LOCAL_REASONING_EFFORT=omit, for servers that
      // reject unrecognised fields. See localReasoningEffort() above for the
      // measured 13s(empty)→1.8s numbers this default fixes.
      ...(reasoningEffort !== undefined ? { reasoning_effort: reasoningEffort } : {}),
    }),
    signal: AbortSignal.timeout(localTimeoutMs()),
  });

  if (!response.ok) {
    // The body often carries the actual cause (bad request shape, model not
    // loaded, …) — without reading it a 400 is a mystery in the logs.
    const bodyText = await response.text().catch(() => "");
    const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 500);
    throw new Error(`${backend.model} returned HTTP ${response.status}: ${snippet}`);
  }

  const body = await response.json();
  const message = body?.choices?.[0]?.message;
  const text = message?.content;
  if (typeof text !== "string" || !text.trim()) {
    // A blank completion is a failure, not an answer: letting it through would
    // silently publish an empty summary/translation.
    const reasonedOnly = typeof message?.reasoning === "string" &&
      message.reasoning.trim().length > 0;
    throw new Error(
      `${backend.model} returned an empty completion` +
        (reasonedOnly ? " (reasoning used the whole budget — raise AI_LOCAL_MAX_TOKENS)" : ""),
    );
  }

  return {
    text,
    inputTokens: Number(body?.usage?.prompt_tokens ?? 0),
    outputTokens: Number(body?.usage?.completion_tokens ?? 0),
  };
}

export async function sendMessage(params: {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  purpose?: string;
}): Promise<string> {
  const model = params.model || DEFAULT_MODEL;

  if (Deno.env.get("AI_LOCAL_MODE") === "primary") {
    for (const backend of localBackends()) {
      if (isBackendCircuitOpen(backend)) continue;
      try {
        const local = await sendViaLocal(backend, params);
        recordLocalSuccess(backend);
        await recordUsage({
          model: `local:${backend.model}`,
          purpose: params.purpose ?? "unknown",
          inputTokens: local.inputTokens,
          outputTokens: local.outputTokens,
        });
        return local.text;
      } catch (error) {
        recordLocalFailure(backend);
        console.warn(`⚠️  Local backend ${backend.model} failed, trying next:`, error);
      }
    }
  }

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: params.maxTokens || MAX_TOKENS,
      temperature: params.temperature || 0.7,
      system: params.systemPrompt,
      messages: params.messages,
    });

    await recordUsage({
      model,
      purpose: params.purpose ?? "unknown",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text;
    }

    throw new Error("Unexpected response type from Claude");
  } catch (error) {
    console.error("Error sending message to Claude:", error);
    throw error;
  }
}

export async function streamMessage(params: {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  onChunk?: (text: string) => void;
}): Promise<string> {
  try {
    const stream = await anthropic.messages.create({
      model: params.model || DEFAULT_MODEL,
      max_tokens: params.maxTokens || MAX_TOKENS,
      temperature: params.temperature || 0.7,
      system: params.systemPrompt,
      messages: params.messages,
      stream: true,
    });

    let fullResponse = "";

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        fullResponse += text;
        if (params.onChunk) {
          params.onChunk(text);
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error("Error streaming message from Claude:", error);
    throw error;
  }
}
