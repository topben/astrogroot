import type { RateLimitConfig } from "./rate-limit.ts";

export const INCLUDE_ERROR_DATA = Deno.env.get("ASTROGROOT_DEBUG") === "1";

// CORS origins for MCP endpoint - comma-separated list or "*" for all
const mcpOriginsEnv = Deno.env.get("MCP_ALLOWED_ORIGINS");
export const MCP_ALLOWED_ORIGINS: string | string[] = mcpOriginsEnv
  ? mcpOriginsEnv === "*"
    ? "*"
    : mcpOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean)
  : "*";

// Maximum body size for MCP requests (default: 100 KB)
export const MCP_MAX_BODY_BYTES = parseInt(
  Deno.env.get("MCP_MAX_BODY_BYTES") ?? "102400",
  10,
) || 102400;

// Maximum search query length (characters)
export const MAX_SEARCH_QUERY_LENGTH = 500;

// Request timeout in milliseconds (30 seconds)
export const REQUEST_TIMEOUT_MS = 30000;

// Rate limit configurations per tier
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // HTML pages - normal browsing
  html: { tier: "html", limit: 60, windowSec: 60 },
  // API endpoints - search, stats
  api: { tier: "api", limit: 30, windowSec: 60 },
  // MCP endpoint - AI tool calls
  mcp: { tier: "mcp", limit: 10, windowSec: 60 },
  // Health endpoint - monitoring probes
  health: { tier: "health", limit: 120, windowSec: 60 },
};
