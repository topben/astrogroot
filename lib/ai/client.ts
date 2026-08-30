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
export const DEFAULT_MODEL =
  Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001";
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

interface LocalBackend {
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

async function sendViaLocal(
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

  const response = await fetch(`${backend.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: backend.model,
      messages,
      max_tokens: Math.max(params.maxTokens || MAX_TOKENS, localMaxTokens()),
      temperature: params.temperature ?? 0.7,
      stream: false,
    }),
    signal: AbortSignal.timeout(localTimeoutMs()),
  });

  if (!response.ok) {
    throw new Error(`${backend.model} returned HTTP ${response.status}`);
  }

  const body = await response.json();
  const message = body?.choices?.[0]?.message;
  const text = message?.content;
  if (typeof text !== "string" || !text.trim()) {
    // A blank completion is a failure, not an answer: letting it through would
    // silently publish an empty summary/translation.
    const reasonedOnly = typeof message?.reasoning === "string" && message.reasoning.trim().length > 0;
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
      try {
        const local = await sendViaLocal(backend, params);
        await recordUsage({
          model: `local:${backend.model}`,
          purpose: params.purpose ?? "unknown",
          inputTokens: local.inputTokens,
          outputTokens: local.outputTokens,
        });
        return local.text;
      } catch (error) {
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
