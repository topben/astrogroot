/// <reference lib="deno.unstable" />
// Tests for rate limiter middleware

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { Hono } from "hono";
import { closeKv, getKv, rateLimit } from "./rate-limit.ts";

// Clean up KV after tests
async function clearRateLimitKeys(): Promise<void> {
  const kv = await getKv();
  const entries = kv.list({ prefix: ["ratelimit"] });
  for await (const entry of entries) {
    await kv.delete(entry.key);
  }
}

Deno.test({
  name: "rate-limit: allows requests within limit",
  async fn() {
    await clearRateLimitKeys();

    const app = new Hono();
    app.use("*", rateLimit({ tier: "test-allow", limit: 3, windowSec: 60 }));
    app.get("/", (c) => c.text("ok"));

    // All 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      assertEquals(res.status, 200);
      assertEquals(await res.text(), "ok");
      assertEquals(res.headers.get("X-RateLimit-Limit"), "3");
      assertEquals(res.headers.get("X-RateLimit-Remaining"), String(2 - i));
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "rate-limit: returns 429 when limit exceeded",
  async fn() {
    await clearRateLimitKeys();

    const app = new Hono();
    app.use("*", rateLimit({ tier: "test-exceed", limit: 2, windowSec: 60 }));
    app.get("/", (c) => c.text("ok"));

    // First 2 requests succeed
    for (let i = 0; i < 2; i++) {
      const res = await app.request("/", {
        headers: { "x-forwarded-for": "5.6.7.8" },
      });
      assertEquals(res.status, 200);
    }

    // 3rd request should be rate limited
    const res = await app.request("/", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    });
    assertEquals(res.status, 429);

    const body = await res.json();
    assertEquals(body.error, "Too Many Requests");
    assertExists(body.retryAfter);
    assertExists(res.headers.get("Retry-After"));
    assertEquals(res.headers.get("X-RateLimit-Remaining"), "0");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "rate-limit: tracks different IPs independently",
  async fn() {
    await clearRateLimitKeys();

    const app = new Hono();
    app.use("*", rateLimit({ tier: "test-ips", limit: 1, windowSec: 60 }));
    app.get("/", (c) => c.text("ok"));

    // IP A - first request succeeds
    const resA1 = await app.request("/", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    assertEquals(resA1.status, 200);

    // IP A - second request blocked
    const resA2 = await app.request("/", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    assertEquals(resA2.status, 429);

    // IP B - first request succeeds (separate bucket)
    const resB1 = await app.request("/", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    assertEquals(resB1.status, 200);

    // IP B - second request blocked
    const resB2 = await app.request("/", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    assertEquals(resB2.status, 429);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "rate-limit: sets correct rate limit headers",
  async fn() {
    await clearRateLimitKeys();

    const app = new Hono();
    app.use("*", rateLimit({ tier: "test-headers", limit: 10, windowSec: 60 }));
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });

    assertEquals(res.status, 200);
    assertEquals(res.headers.get("X-RateLimit-Limit"), "10");
    assertEquals(res.headers.get("X-RateLimit-Remaining"), "9");
    assertExists(res.headers.get("X-RateLimit-Reset"));

    // Reset should be a valid Unix timestamp
    const reset = parseInt(res.headers.get("X-RateLimit-Reset") ?? "0", 10);
    const now = Math.floor(Date.now() / 1000);
    assertEquals(reset > now, true, "Reset time should be in the future");
    assertEquals(reset <= now + 60, true, "Reset time should be within window");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "rate-limit: passes through for unknown IP",
  async fn() {
    await clearRateLimitKeys();

    const app = new Hono();
    app.use("*", rateLimit({ tier: "test-unknown", limit: 1, windowSec: 60 }));
    app.get("/", (c) => c.text("ok"));

    // Request without IP headers - should pass through unlimited
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/");
      assertEquals(res.status, 200);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// Cleanup KV after all tests
Deno.test({
  name: "rate-limit: cleanup",
  async fn() {
    await clearRateLimitKeys();
    closeKv();
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
