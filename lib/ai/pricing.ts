/** USD price per million tokens, keyed by model ID prefix (checked longest-match first). */
const PRICING_PER_MTOK: { prefix: string; input: number; output: number }[] = [
  { prefix: "claude-haiku-4-5", input: 1, output: 5 },
  { prefix: "claude-3-5-haiku", input: 0.8, output: 4 },
  { prefix: "claude-opus-4", input: 5, output: 25 },
  { prefix: "claude-sonnet-4", input: 3, output: 15 },
  { prefix: "claude-3-5-sonnet", input: 3, output: 15 },
  { prefix: "claude-3-opus", input: 15, output: 75 },
];

/** Fallback price if a model isn't in the table above (assume the expensive tier). */
const FALLBACK_PRICING = { input: 5, output: 25 };

function getPricing(model: string): { input: number; output: number } {
  const match = PRICING_PER_MTOK.find((p) => model.startsWith(p.prefix));
  return match ?? FALLBACK_PRICING;
}

/** Estimate the USD cost of a single Claude API call from its token usage. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getPricing(model);
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
