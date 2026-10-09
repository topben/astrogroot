import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@1";
import {
  _setAnthropicClientForTest,
  _setUsageRecorderForTest,
  buildRequest,
  ClaudeRefusalError,
  DEFAULT_MODEL,
  type Effort,
  modelGeneration,
  resetLocalBackendCircuit,
  sendMessage,
  sendViaLocal,
  streamMessage,
} from "./client.ts";

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

// --- Anthropic request shape (legacy vs current models) ----------------------

const MSGS = [{ role: "user" as const, content: "hi" }];
type Block = Record<string, unknown>;
const textBlock = (t: string): Block => ({ type: "text", text: t });
const thinkingBlock: Block = { type: "thinking", thinking: "hmm", signature: "sig" };
const USAGE = { input_tokens: 11, output_tokens: 7 };

Deno.test("DEFAULT_MODEL is claude-haiku-5-5 unless ANTHROPIC_MODEL overrides it", {
  ignore: Boolean(Deno.env.get("ANTHROPIC_MODEL")),
}, () => {
  assertEquals(DEFAULT_MODEL, "claude-haiku-5-5");
});

Deno.test("modelGeneration: legacy ids", () => {
  for (
    const id of [
      "claude-haiku-4-5-20251001",
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
      "claude-sonnet-4-20250514",
      "claude-opus-4-6",
      "claude-opus-4-20250514", // the 8-digit date is not a minor version
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
    ]
  ) {
    assertEquals(modelGeneration(id), "legacy", id);
  }
});

Deno.test("modelGeneration: current and unknown ids", () => {
  for (
    const id of [
      "claude-opus-4-7",
      "claude-sonnet-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
      "claude-opus-5-5",
      "claude-fable-5-1",
      "something-new",
    ]
  ) {
    assertEquals(modelGeneration(id), "current", id);
  }
});

Deno.test("buildRequest: legacy keeps temperature (default 0.7, explicit 0 stays 0)", () => {
  const model = "claude-haiku-4-5-20251001";
  assertEquals(buildRequest({ messages: MSGS }, model), {
    model,
    max_tokens: 4096,
    temperature: 0.7,
    messages: MSGS,
  });
  const zero = buildRequest(
    { messages: MSGS, temperature: 0, maxTokens: 80, effort: "low", systemPrompt: "sys" },
    model,
  );
  assertEquals(zero.temperature, 0);
  assertEquals(zero.max_tokens, 80);
  assertEquals(zero.system, "sys");
  assert(!("output_config" in zero), "effort is ignored on legacy models");
});

Deno.test("buildRequest: current models send no sampling params; effort only when given", () => {
  const body = buildRequest(
    { messages: MSGS, temperature: 0.4, maxTokens: 100, effort: "medium" },
    "claude-haiku-5-5",
  ) as unknown as Record<string, unknown>;
  for (const key of ["temperature", "top_p", "top_k", "thinking", "system"]) {
    assert(!(key in body), `${key} must not be sent`);
  }
  assertEquals(body.output_config, { effort: "medium" });
  assert(!("output_config" in buildRequest({ messages: MSGS }, "claude-haiku-5-5")));
});

Deno.test("buildRequest: current max_tokens follows the thinking-headroom formula", () => {
  const cases: Array<[string, number | undefined, Effort | undefined, number]> = [
    ["claude-haiku-5-5", 256, "low", 2048], // floor 1024 + 1024
    ["claude-haiku-5-5", 1024, "medium", 5120],
    ["claude-haiku-5-5", 4096, undefined, 8192], // Haiku 5.5 defaults to medium
    ["claude-sonnet-5-5", 4096, undefined, 12288], // default effort high
    ["claude-sonnet-5-5", 16384, "high", 20000], // capped
  ];
  for (const [model, maxTokens, effort, expected] of cases) {
    assertEquals(
      buildRequest({ messages: MSGS, maxTokens, effort }, model).max_tokens,
      expected,
      `${model} ${maxTokens} ${effort}`,
    );
  }
});

async function withStub<T>(
  response: Record<string, unknown>,
  fn: (calls: Array<Record<string, unknown>>, usage: Array<Record<string, unknown>>) => Promise<T>,
): Promise<T> {
  const calls: Array<Record<string, unknown>> = [];
  const usage: Array<Record<string, unknown>> = [];
  const client = {
    messages: {
      create: (body: Record<string, unknown>) => {
        calls.push(body);
        return Promise.resolve(response);
      },
    },
  };
  const origError = console.error;
  const prevMode = Deno.env.get("AI_LOCAL_MODE");
  console.error = () => {}; // sendMessage logs every failure
  Deno.env.delete("AI_LOCAL_MODE");
  // deno-lint-ignore no-explicit-any
  _setAnthropicClientForTest(client as any);
  _setUsageRecorderForTest((u) => {
    usage.push(u);
    return Promise.resolve();
  });
  try {
    return await fn(calls, usage);
  } finally {
    _setAnthropicClientForTest(null);
    _setUsageRecorderForTest(null);
    console.error = origError;
    if (prevMode !== undefined) Deno.env.set("AI_LOCAL_MODE", prevMode);
  }
}

Deno.test("sendMessage (Anthropic): skips a leading thinking block, records usage, sends no temperature", async () => {
  await withStub(
    { content: [thinkingBlock, textBlock("answer")], stop_reason: "end_turn", usage: USAGE },
    async (calls, usage) => {
      const out = await sendMessage({
        messages: MSGS,
        model: "claude-haiku-5-5",
        temperature: 0.3,
        maxTokens: 256,
        effort: "low",
        purpose: "translate_title",
      });
      assertEquals(out, "answer");
      assertEquals(calls[0].model, "claude-haiku-5-5");
      assert(!("temperature" in calls[0]));
      assertEquals(calls[0].max_tokens, 2048);
      assertEquals(usage, [{
        model: "claude-haiku-5-5",
        purpose: "translate_title",
        inputTokens: 11,
        outputTokens: 7,
      }]);
    },
  );
});

Deno.test("sendMessage (Anthropic): default model is DEFAULT_MODEL", {
  ignore: Boolean(Deno.env.get("ANTHROPIC_MODEL")),
}, async () => {
  await withStub(
    { content: [textBlock("ok")], stop_reason: "end_turn", usage: USAGE },
    async (calls) => {
      await sendMessage({ messages: MSGS });
      assertEquals(calls[0].model, "claude-haiku-5-5");
    },
  );
});

Deno.test("sendMessage (Anthropic): refusal throws ClaudeRefusalError", async () => {
  await withStub(
    {
      content: [],
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: "nope" },
      usage: USAGE,
    },
    async () => {
      const err = await assertRejects(
        () => sendMessage({ messages: MSGS, model: "claude-haiku-5-5" }),
        ClaudeRefusalError,
      );
      assertInstanceOf(err, ClaudeRefusalError);
      assertEquals(err.category, "cyber");
      assertEquals(err.explanation, "nope");
      assertEquals(err.model, "claude-haiku-5-5");
    },
  );
});

Deno.test("sendMessage (Anthropic): thinking-only max_tokens response throws 'no text'", async () => {
  await withStub(
    { content: [thinkingBlock], stop_reason: "max_tokens", usage: USAGE },
    async () => {
      await assertRejects(
        () => sendMessage({ messages: MSGS, model: "claude-haiku-5-5" }),
        Error,
        "Claude returned no text (model claude-haiku-5-5, stop_reason max_tokens)",
      );
    },
  );
});

Deno.test("sendMessage (Anthropic): pinned legacy model keeps temperature, system, and no effort", async () => {
  await withStub(
    { content: [textBlock("ok")], stop_reason: "end_turn", usage: USAGE },
    async (calls) => {
      await sendMessage({
        messages: MSGS,
        model: "claude-haiku-4-5-20251001",
        maxTokens: 80,
        effort: "low",
        systemPrompt: "sys",
      });
      assertEquals(calls[0], {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        temperature: 0.7,
        system: "sys",
        messages: MSGS,
      });
    },
  );
});

Deno.test("streamMessage: collects text_delta only, sends no temperature, throws on refusal", async () => {
  const events = (stop: string) => [
    { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "hm" } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "foo" } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "bar" } },
    { type: "message_delta", delta: { stop_reason: stop, stop_details: null } },
  ];
  const run = async (stop: string) => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      messages: {
        create: (body: Record<string, unknown>) => {
          calls.push(body);
          return Promise.resolve((async function* () {
            yield* events(stop);
          })());
        },
      },
    };
    // deno-lint-ignore no-explicit-any
    _setAnthropicClientForTest(client as any);
    const chunks: string[] = [];
    const origError = console.error;
    console.error = () => {};
    try {
      const out = await streamMessage({
        messages: MSGS,
        model: "claude-haiku-5-5",
        temperature: 0.2,
        onChunk: (c) => chunks.push(c),
      });
      return { out, chunks, calls };
    } finally {
      _setAnthropicClientForTest(null);
      console.error = origError;
    }
  };
  const ok = await run("end_turn");
  assertEquals(ok.out, "foobar");
  assertEquals(ok.chunks, ["foo", "bar"]);
  assertEquals(ok.calls[0].stream, true);
  assert(!("temperature" in ok.calls[0]));
  await assertRejects(() => run("refusal"), ClaudeRefusalError);
});
