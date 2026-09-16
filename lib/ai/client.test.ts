import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { resetLocalBackendCircuit, sendMessage, sendViaLocal } from "./client.ts";

/** Swap globalThis.fetch for the duration of one test. */
async function withFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch =
    ((input: string | URL | Request, init?: RequestInit) =>
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

// Circuit-breaker tests below rely on the default threshold (3): guard against
// an ambient AI_LOCAL_MAX_CONSECUTIVE_FAILURES in the environment they run in.
const CIRCUIT_ENV = { ...LOCAL_ENV, AI_LOCAL_MAX_CONSECUTIVE_FAILURES: undefined };

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

// --- reasoning_effort (AI_LOCAL_REASONING_EFFORT) ---------------------------

function okResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    headers: { "Content-Type": "application/json" },
  });
}

const TEST_BACKEND = { baseUrl: "http://127.0.0.1:11435/v1", model: "primary-model" };

Deno.test("sendViaLocal sends reasoning_effort: none by default", async () => {
  let body: Record<string, unknown> | undefined;
  await withEnv({ AI_LOCAL_REASONING_EFFORT: undefined }, () =>
    withFetch(
      (_url, init) => {
        body = JSON.parse(String(init?.body));
        return Promise.resolve(okResponse("ok"));
      },
      async () => {
        await sendViaLocal(TEST_BACKEND, { messages: [{ role: "user", content: "hi" }] });
      },
    ));
  assertEquals(body?.reasoning_effort, "none");
});

Deno.test("sendViaLocal omits reasoning_effort when AI_LOCAL_REASONING_EFFORT=omit", async () => {
  let body: Record<string, unknown> | undefined;
  await withEnv({ AI_LOCAL_REASONING_EFFORT: "omit" }, () =>
    withFetch(
      (_url, init) => {
        body = JSON.parse(String(init?.body));
        return Promise.resolve(okResponse("ok"));
      },
      async () => {
        await sendViaLocal(TEST_BACKEND, { messages: [{ role: "user", content: "hi" }] });
      },
    ));
  assertEquals(Object.prototype.hasOwnProperty.call(body ?? {}, "reasoning_effort"), false);
});

Deno.test("sendViaLocal passes a custom reasoning_effort through verbatim", async () => {
  let body: Record<string, unknown> | undefined;
  await withEnv({ AI_LOCAL_REASONING_EFFORT: "low" }, () =>
    withFetch(
      (_url, init) => {
        body = JSON.parse(String(init?.body));
        return Promise.resolve(okResponse("ok"));
      },
      async () => {
        await sendViaLocal(TEST_BACKEND, { messages: [{ role: "user", content: "hi" }] });
      },
    ));
  assertEquals(body?.reasoning_effort, "low");
});

// --- HTTP error body snippet -------------------------------------------------

Deno.test("sendViaLocal includes a collapsed body snippet in a non-OK error", async () => {
  await withFetch(
    () => Promise.resolve(new Response("  Bad   request:\nmodel   not loaded  ", { status: 400 })),
    async () => {
      const error = await assertRejects(() =>
        sendViaLocal(TEST_BACKEND, { messages: [{ role: "user", content: "hi" }] })
      );
      assertStringIncludes(String(error), "primary-model returned HTTP 400");
      assertStringIncludes(String(error), "Bad request: model not loaded");
    },
  );
});

Deno.test("sendViaLocal caps the body snippet at 500 chars", async () => {
  const longBody = "x".repeat(1000);
  await withFetch(
    () => Promise.resolve(new Response(longBody, { status: 500 })),
    async () => {
      const error = await assertRejects(() =>
        sendViaLocal(TEST_BACKEND, { messages: [{ role: "user", content: "hi" }] })
      );
      // Use .message, not String(error): the latter prepends "Error: ", which
      // has its own ": " that would shift the slice below.
      const message = error instanceof Error ? error.message : String(error);
      const snippet = message.slice(message.indexOf(": ") + 2);
      assertEquals(snippet.length, 500);
    },
  );
});

// --- Circuit breaker (AI_LOCAL_MAX_CONSECUTIVE_FAILURES) --------------------

Deno.test("circuit breaker skips a backend after 3 consecutive failures", async () => {
  resetLocalBackendCircuit();
  const calls: string[] = [];
  await withEnv(CIRCUIT_ENV, () =>
    withFetch(
      (url) => {
        calls.push(url);
        // Primary always fails; fallback always answers.
        if (url.includes("11435")) return Promise.resolve(new Response("down", { status: 503 }));
        return Promise.resolve(okResponse("fallback ok"));
      },
      async () => {
        // Three round trips drive the primary's consecutive-failure count up
        // to the default max (3); the fallback answers every time, so
        // sendMessage itself keeps succeeding throughout.
        for (let i = 0; i < 3; i++) {
          const text = await sendMessage({ messages: [{ role: "user", content: "hi" }] });
          assertEquals(text, "fallback ok");
        }
        assertEquals(calls.length, 6); // 3 rounds x (primary + fallback)

        // Fourth round: the primary's circuit is now open, so only the
        // fallback should be fetched.
        calls.length = 0;
        const text = await sendMessage({ messages: [{ role: "user", content: "hi" }] });
        assertEquals(text, "fallback ok");
        assertEquals(calls, ["http://127.0.0.1:11434/v1/chat/completions"]);
      },
    ));
});

Deno.test("a success resets a backend's consecutive-failure count", async () => {
  resetLocalBackendCircuit();
  const calls: string[] = [];
  let primaryShouldFail = true;
  await withEnv(CIRCUIT_ENV, () =>
    withFetch(
      (url) => {
        calls.push(url);
        if (url.includes("11435")) {
          return Promise.resolve(
            primaryShouldFail ? new Response("down", { status: 503 }) : okResponse("primary ok"),
          );
        }
        return Promise.resolve(okResponse("fallback ok"));
      },
      async () => {
        // Two failures — below the default max of 3.
        await sendMessage({ messages: [{ role: "user", content: "hi" }] });
        await sendMessage({ messages: [{ role: "user", content: "hi" }] });

        // A success on the primary must reset its count to zero.
        primaryShouldFail = false;
        const text = await sendMessage({ messages: [{ role: "user", content: "hi" }] });
        assertEquals(text, "primary ok");
        primaryShouldFail = true;

        // Two more failures — still below max=3 since the counter was reset —
        // so the primary must still be attempted, not skipped.
        calls.length = 0;
        await sendMessage({ messages: [{ role: "user", content: "hi" }] });
        await sendMessage({ messages: [{ role: "user", content: "hi" }] });
        assertEquals(calls.filter((u) => u.includes("11435")).length, 2);
      },
    ));
});

Deno.test("resetLocalBackendCircuit clears failure counts between tests", async () => {
  resetLocalBackendCircuit();
  await withEnv(CIRCUIT_ENV, () =>
    withFetch(
      () => Promise.resolve(new Response("down", { status: 503 })),
      async () => {
        // Trip the primary's circuit: 3 rounds, both backends fail every time,
        // so each round ends in the Anthropic leg, which throws (no API key).
        for (let i = 0; i < 3; i++) {
          await assertRejects(() => sendMessage({ messages: [{ role: "user", content: "hi" }] }));
        }
      },
    ));

  resetLocalBackendCircuit();

  const calls: string[] = [];
  await withEnv(CIRCUIT_ENV, () =>
    withFetch(
      (url) => {
        calls.push(url);
        return Promise.resolve(new Response("down", { status: 503 }));
      },
      async () => {
        // After the reset, a fresh run must try the primary again from zero.
        await assertRejects(() => sendMessage({ messages: [{ role: "user", content: "hi" }] }));
        assertEquals(calls, [
          "http://127.0.0.1:11435/v1/chat/completions",
          "http://127.0.0.1:11434/v1/chat/completions",
        ]);
      },
    ));
});
