/**
 * USD price per million tokens, keyed by model ID prefix. The lookup takes the
 * first match in array order, so a more specific prefix must be listed before
 * any broader one it shares a start with (opus-5-5 before opus-5 before opus-4).
 */
const PRICING_PER_MTOK: { prefix: string; input: number; output: number }[] = [
  { prefix: "claude-haiku-5-5", input: 0.1, output: 0.5 },
  { prefix: "claude-sonnet-5", input: 2, output: 10 }, // sonnet-5 and sonnet-5-5
  { prefix: "claude-opus-5-5", input: 4, output: 20 },
  { prefix: "claude-opus-5", input: 5, output: 25 },
  { prefix: "claude-fable", input: 10, output: 50 },
  { prefix: "claude-haiku-4-5", input: 1, output: 5 },
  { prefix: "claude-3-5-haiku", input: 0.8, output: 4 },
  { prefix: "claude-opus-4", input: 5, output: 25 },
  { prefix: "claude-sonnet-4", input: 3, output: 15 },
  { prefix: "claude-3-5-sonnet", input: 3, output: 15 },
  { prefix: "claude-3-opus", input: 15, output: 75 },
];

/** Fallback price if a model isn't in the table above (assume the expensive tier). */
const FALLBACK_PRICING = { input: 5, output: 25 };

/** Local models (recorded as `local:<model>`) cost nothing — no API is billed. */
const LOCAL_MODEL_PREFIX = "local:";

/** Haiku 5.5 bills prompts above this many input tokens at the long-context rate. */
const HAIKU_5_5_LONG_PROMPT_TOKENS = 100_000;
const HAIKU_5_5_LONG_PRICING = { input: 0.5, output: 2.5 };

function getPricing(model: string, inputTokens = 0): { input: number; output: number } {
  if (model.startsWith(LOCAL_MODEL_PREFIX)) return { input: 0, output: 0 };
  if (model.startsWith("claude-haiku-5-5") && inputTokens > HAIKU_5_5_LONG_PROMPT_TOKENS) {
    return HAIKU_5_5_LONG_PRICING;
  }
  const match = PRICING_PER_MTOK.find((p) => model.startsWith(p.prefix));
  return match ?? FALLBACK_PRICING;
}

/** Estimate the USD cost of a single Claude API call from its token usage. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getPricing(model, inputTokens);
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
