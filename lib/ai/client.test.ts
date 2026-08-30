import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { sendMessage } from "./client.ts";

/** Swap globalThis.fetch for the duration of one test. */
async function withFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    previous.set(k, Deno.env.get(k));
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  return fn().finally(() => {
    for (const [k, v] of previous) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  });
}

const LOCAL_ENV = {
  AI_LOCAL_MODE: "primary",
  AI_LOCAL_BASE_URL: "http://127.0.0.1:11435/v1",
  AI_LOCAL_MODEL: "primary-model",
  AI_LOCAL_FALLBACK_BASE_URL: "http://127.0.0.1:11434/v1",
  AI_LOCAL_FALLBACK_MODEL: "fallback-model",
  ANTHROPIC_API_KEY: undefined,
};

Deno.test("sendMessage uses the local backend and never calls Anthropic", async () => {
  const calls: string[] = [];
  await withEnv(LOCAL_ENV, () =>
    withFetch(
      (url) => {
        calls.push(url);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "local summary" } }],
              usage: { prompt_tokens: 100, completion_tokens: 20 },
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      },
      async () => {
        const text = await sendMessage({ messages: [{ role: "user", content: "hi" }] });
        assertEquals(text, "local summary");
        assertEquals(calls, ["http://127.0.0.1:11435/v1/chat/completions"]);
      },
    ));
});

Deno.test("sendMessage falls through primary → fallback → Anthropic", async () => {
  const calls: string[] = [];
  await withEnv(LOCAL_ENV, () =>
    withFetch(
      (url) => {
        calls.push(url);
        // Primary refuses, fallback answers with a blank completion (which must
        // count as a failure, not as an empty summary).
        if (url.includes("11435")) return Promise.resolve(new Response("nope", { status: 503 }));
        return Promise.resolve(
          new Response(JSON.stringify({ choices: [{ message: { content: "   " } }] }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
      async () => {
        // Both local backends fail and no Anthropic key is configured, so the
        // Anthropic leg is what raises — proving the chain fell all the way through.
        const error = await assertRejects(() =>
          sendMessage({ messages: [{ role: "user", content: "hi" }] })
        );
        assertStringIncludes(String(error), "ANTHROPIC_API_KEY");
        assertEquals(calls.length, 2);
      },
    ));
});

Deno.test("sendMessage skips local backends when AI_LOCAL_MODE is off", async () => {
  await withEnv({ ...LOCAL_ENV, AI_LOCAL_MODE: "off" }, () =>
    withFetch(
      (url) => {
        throw new Error(`no local call expected, got ${url}`);
      },
      async () => {
        const error = await assertRejects(() =>
          sendMessage({ messages: [{ role: "user", content: "hi" }] })
        );
        assertStringIncludes(String(error), "ANTHROPIC_API_KEY");
      },
    ));
});
