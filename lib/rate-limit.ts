/// <reference lib="deno.unstable" />
// Deno KV-backed fixed-window rate limiter middleware for Hono

import type { Context, MiddlewareHandler } from "hono";

export interface RateLimitConfig {
  tier: string;
  limit: number;
  windowSec: number;
}

let kvInstance: Deno.Kv | null = null;

/**
 * Lazy singleton for Deno.openKv() - works on Deploy + local
 */
export async function getKv(): Promise<Deno.Kv> {
  if (!kvInstance) {
    kvInstance = await Deno.openKv();
  }
  return kvInstance;
}

/**
 * Close the KV instance (useful for tests)
 */
export function closeKv(): void {
  if (kvInstance) {
    kvInstance.close();
    kvInstance = null;
  }
}

/**
 * Extract client IP from request headers
 * Priority: X-Forwarded-For (Deno Deploy sets this) > cf-connecting-ip > "unknown"
 */
export function getClientIp(c: Context): string {
  // X-Forwarded-For may contain multiple IPs: "client, proxy1, proxy2"
  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const firstIp = xff.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  // Cloudflare header
  const cfIp = c.req.header("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Fallback
  return "unknown";
}

/**
 * Get the current window key based on timestamp and window size
 */
function getWindowKey(windowSec: number): number {
  return Math.floor(Date.now() / 1000 / windowSec);
}

/**
 * Rate limit middleware factory
 *
 * Uses Deno KV for distributed rate limiting with atomic check-and-set.
 * Sets X-RateLimit-* headers on every response.
 * Returns 429 JSON with Retry-After header when limit exceeded.
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const { tier, limit, windowSec } = config;

  return async (c, next) => {
    const ip = getClientIp(c);

    // Can't rate limit without an identifier
    if (ip === "unknown") {
      await next();
      return;
    }

    const windowKey = getWindowKey(windowSec);
    const key = ["ratelimit", tier, ip, windowKey];
    const kv = await getKv();

    // Atomic check-and-set with one retry on contention
    let count = 0;
    let success = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      const entry = await kv.get<number>(key);
      const currentCount = entry.value ?? 0;

      // Calculate TTL - expire at end of current window plus buffer
      const windowEndSec = (windowKey + 1) * windowSec;
      const nowSec = Math.floor(Date.now() / 1000);
      const ttlMs = Math.max((windowEndSec - nowSec + 1) * 1000, 1000);

      const result = await kv.atomic()
        .check(entry)
        .set(key, currentCount + 1, { expireIn: ttlMs })
        .commit();

      if (result.ok) {
        count = currentCount + 1;
        success = true;
        break;
      }
      // Contention - retry
    }

    // If atomic failed twice, read current value
    if (!success) {
      const entry = await kv.get<number>(key);
      count = (entry.value ?? 0) + 1;
    }

    // Calculate reset time (end of current window)
    const resetTime = (windowKey + 1) * windowSec;
    const remaining = Math.max(0, limit - count);

    // Set rate limit headers on response
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(resetTime));

    // Check if rate limited
    if (count > limit) {
      const retryAfter = Math.max(1, resetTime - Math.floor(Date.now() / 1000));
      c.header("Retry-After", String(retryAfter));

      return c.json(
        {
          error: "Too Many Requests",
          message: `Rate limit exceeded for ${tier} tier. Try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        429,
      );
    }

    await next();
  };
}
