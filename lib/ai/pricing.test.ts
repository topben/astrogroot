import { assertEquals } from "jsr:@std/assert@1";
import { estimateCostUsd } from "./pricing.ts";

Deno.test("pricing: Haiku 4.5 costs $1/$5 per MTok", () => {
  const cost = estimateCostUsd("claude-haiku-4-5-20251001", 1_000_000, 1_000_000);
  assertEquals(cost, 6);
});

Deno.test("pricing: scales linearly with token count", () => {
  const cost = estimateCostUsd("claude-haiku-4-5-20251001", 500_000, 0);
  assertEquals(cost, 0.5);
});

Deno.test("pricing: zero tokens costs zero", () => {
  assertEquals(estimateCostUsd("claude-haiku-4-5-20251001", 0, 0), 0);
});

Deno.test("pricing: unknown model falls back to the expensive tier", () => {
  const cost = estimateCostUsd("some-future-model", 1_000_000, 1_000_000);
  assertEquals(cost, 30);
});

Deno.test("pricing: matches by prefix regardless of dated snapshot suffix", () => {
  const dated = estimateCostUsd("claude-haiku-4-5-20251001", 1_000_000, 0);
  const alias = estimateCostUsd("claude-haiku-4-5", 1_000_000, 0);
  assertEquals(dated, alias);
});
