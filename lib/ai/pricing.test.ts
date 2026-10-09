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

Deno.test("local model calls are free and never consume the daily budget", () => {
  // Recorded as `local:<model>`; without this they would hit FALLBACK_PRICING
  // ($5/$25 per Mtok) and a local-only crawl would still trip AI_DAILY_BUDGET_USD.
  assertEquals(estimateCostUsd("local:unsloth/gemma-4-26b-a4b-it", 1_000_000, 1_000_000), 0);
  assertEquals(estimateCostUsd("local:gemma4-12b-ctx32k", 500_000, 250_000), 0);
});

Deno.test("pricing: Haiku 5.5 is $0.10/$0.50 per MTok for prompts up to 100K tokens", () => {
  assertEquals(estimateCostUsd("claude-haiku-5-5", 1000, 0), 0.0001);
  assertEquals(estimateCostUsd("claude-haiku-5-5", 100_000, 1_000_000), 0.01 + 0.5);
});

Deno.test("pricing: Haiku 5.5 prompts over 100K tokens bill at $0.50/$2.50", () => {
  assertEquals(estimateCostUsd("claude-haiku-5-5", 100_001, 0), 100_001 * 0.5 / 1_000_000);
  assertEquals(estimateCostUsd("claude-haiku-5-5", 200_000, 1_000_000), 0.1 + 2.5);
  // The long-prompt tier is Haiku 5.5 only.
  assertEquals(estimateCostUsd("claude-haiku-4-5", 200_000, 0), 0.2);
});

Deno.test("pricing: Sonnet 5 and 5.5 cost $2/$10; Fable $10/$50", () => {
  assertEquals(estimateCostUsd("claude-sonnet-5-5", 1_000_000, 1_000_000), 12);
  assertEquals(estimateCostUsd("claude-sonnet-5", 1_000_000, 1_000_000), 12);
  assertEquals(estimateCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000), 18);
  assertEquals(estimateCostUsd("claude-fable-5-1", 1_000_000, 1_000_000), 60);
});

Deno.test("pricing: Opus 5.5 ($4/$20) takes precedence over Opus 5 ($5/$25) and Opus 4", () => {
  assertEquals(estimateCostUsd("claude-opus-5-5", 1_000_000, 1_000_000), 24);
  assertEquals(estimateCostUsd("claude-opus-5", 1_000_000, 1_000_000), 30);
  assertEquals(estimateCostUsd("claude-opus-4-6", 1_000_000, 1_000_000), 30);
});
