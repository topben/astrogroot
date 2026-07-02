import { sql } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { aiUsage } from "../../db/schema.ts";
import { estimateCostUsd } from "./pricing.ts";

const DEFAULT_DAILY_BUDGET_USD = 0.5;

function getDailyBudgetUsd(): number {
  const raw = Deno.env.get("AI_DAILY_BUDGET_USD");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_BUDGET_USD;
}

function startOfTodayUtcUnix(): number {
  return Math.floor(Date.now() / 1000 / 86400) * 86400;
}

export class BudgetExceededError extends Error {
  constructor(spentUsd: number, budgetUsd: number) {
    super(
      `Daily AI budget exceeded: $${spentUsd.toFixed(4)} spent of $${budgetUsd.toFixed(2)} cap`,
    );
    this.name = "BudgetExceededError";
  }
}

// In-memory cache so a long-running crawler daemon doesn't hammer the DB once
// the cap is hit; it self-invalidates at UTC day rollover.
let cachedExceededDay: number | null = null;

/** Record token usage for a completed API call. Never throws - logging must not break the caller. */
export async function recordUsage(params: {
  model: string;
  purpose: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  try {
    const costUsd = estimateCostUsd(params.model, params.inputTokens, params.outputTokens);
    await db.insert(aiUsage).values({
      model: params.model,
      purpose: params.purpose,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsd,
    });
  } catch (error) {
    console.warn("⚠️  Failed to record AI usage (non-fatal):", error);
  }
}

/** Sum of costUsd for all AI calls since the start of the current UTC day. */
export async function getTodaySpendUsd(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)` })
    .from(aiUsage)
    .where(sql`${aiUsage.createdAt} >= ${startOfTodayUtcUnix()}`);
  return Number(row?.total ?? 0);
}

/** Non-throwing check, safe to call before starting a whole crawl/reindex run. */
export async function isBudgetExceededToday(): Promise<boolean> {
  const today = startOfTodayUtcUnix();
  if (cachedExceededDay === today) return true;

  const spent = await getTodaySpendUsd();
  const exceeded = spent >= getDailyBudgetUsd();
  if (exceeded) cachedExceededDay = today;
  return exceeded;
}

/** Throws BudgetExceededError if today's spend has hit the cap. Call before each AI-processing item. */
export async function checkBudget(): Promise<void> {
  const today = startOfTodayUtcUnix();
  const budget = getDailyBudgetUsd();

  if (cachedExceededDay === today) {
    throw new BudgetExceededError(budget, budget);
  }

  const spent = await getTodaySpendUsd();
  if (spent >= budget) {
    cachedExceededDay = today;
    throw new BudgetExceededError(spent, budget);
  }
}

export interface UsageSummary {
  todaySpendUsd: number;
  budgetUsd: number;
  last30DaysSpendUsd: number;
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const thirtyDaysAgoUnix = Math.floor(Date.now() / 1000) - 30 * 86400;
  const [today, last30] = await Promise.all([
    getTodaySpendUsd(),
    db
      .select({ total: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)` })
      .from(aiUsage)
      .where(sql`${aiUsage.createdAt} >= ${thirtyDaysAgoUnix}`)
      .then((rows) => Number(rows[0]?.total ?? 0)),
  ]);

  return {
    todaySpendUsd: today,
    budgetUsd: getDailyBudgetUsd(),
    last30DaysSpendUsd: last30,
  };
}
