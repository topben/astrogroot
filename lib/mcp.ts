// MCP (Model Context Protocol) Server over HTTP

import { searchLibrary } from "./search.ts";
import { getLibraryStats } from "./stats.ts";
import { db } from "../db/client.ts";
import { nasaContent, papers, translations, videos } from "../db/schema.ts";
import { and, eq } from "drizzle-orm";
import { SUPPORTED_LOCALES } from "./i18n.ts";
import { INCLUDE_ERROR_DATA, MAX_SEARCH_QUERY_LENGTH } from "./config.ts";
import type { Locale } from "./i18n.ts";
import type { SearchResponse } from "./search.ts";

const SERVER_NAME = "AstroGroot MCP Server";
const SERVER_VERSION = "1.0.0";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search",
    description: "Search the library using natural language.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        type: {
          type: "string",
          enum: ["all", "papers", "videos", "nasa"],
          default: "all",
          description: "Content type to search.",
        },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        page: { type: "integer", minimum: 1, default: 1 },
        locale: { type: "string", enum: ["en", "zh-TW", "zh-CN"], default: "en" },
        dateFrom: { type: "string", description: "YYYY-MM-DD" },
        dateTo: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_stats",
    description: "Return library statistics.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_detail",
    description: "Fetch a single paper, video, or NASA item by ID.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["paper", "video", "nasa"] },
        id: { type: "string" },
        locale: { type: "string", enum: ["en", "zh-TW", "zh-CN"], default: "en" },
      },
      required: ["type", "id"],
    },
  },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function okResponse(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data: INCLUDE_ERROR_DATA ? data : undefined } };
}

function toolResult(content: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(content) }] };
}

async function getDetail(params: {
  type: "paper" | "video" | "nasa";
  id: string;
  locale: Locale;
}): Promise<Record<string, unknown> | null> {
  const { type, id, locale } = params;
  const trans = await db.query.translations.findFirst({
    where: and(eq(translations.itemType, type), eq(translations.itemId, id), eq(translations.lang, locale)),
    columns: { title: true, summary: true },
  });

  if (type === "paper") {
    const row = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!row) return null;
    const summary = trans?.summary ?? row.summary ?? row.abstract ?? "";
    const title = trans?.title ?? row.title;
    return {
      type,
      id: row.id,
      title,
      summary,
      sourceUrl: row.arxivUrl ?? row.pdfUrl ?? null,
      metadata: {
        authors: row.authors,
        abstract: row.abstract,
        publishedDate: row.publishedDate,
        updatedDate: row.updatedDate,
        categories: row.categories,
        pdfUrl: row.pdfUrl,
        arxivUrl: row.arxivUrl,
        vectorId: row.vectorId,
        processed: row.processed,
      },
    };
  }

  if (type === "video") {
    const row = await db.query.videos.findFirst({ where: eq(videos.id, id) });
    if (!row) return null;
    const summary = trans?.summary ?? row.summary ?? row.description ?? "";
    const title = trans?.title ?? row.title;
    return {
      type,
      id: row.id,
      title,
      summary,
      sourceUrl: row.videoUrl,
      metadata: {
        channelName: row.channelName,
        channelId: row.channelId,
        description: row.description,
        transcript: row.transcript,
        publishedDate: row.publishedDate,
        duration: row.duration,
        viewCount: row.viewCount,
        likeCount: row.likeCount,
        tags: row.tags,
        thumbnailUrl: row.thumbnailUrl,
        videoUrl: row.videoUrl,
        vectorId: row.vectorId,
        processed: row.processed,
      },
    };
  }

  const row = await db.query.nasaContent.findFirst({ where: eq(nasaContent.id, id) });
  if (!row) return null;
  const summary = trans?.summary ?? row.summary ?? row.explanation ?? row.description ?? "";
  const title = trans?.title ?? row.title;
  return {
    type,
    id: row.id,
    title,
    summary,
    sourceUrl: row.url,
    metadata: {
      contentType: row.contentType,
      description: row.description,
      explanation: row.explanation,
      date: row.date,
      credit: row.credit,
      mediaType: row.mediaType,
      hdUrl: row.hdUrl,
      url: row.url,
      thumbnailUrl: row.thumbnailUrl,
      copyright: row.copyright,
      nasaId: row.nasaId,
      center: row.center,
      keywords: row.keywords,
      vectorId: row.vectorId,
      processed: row.processed,
    },
  };
}

export async function handleMCPRequest(raw: unknown): Promise<JsonRpcResponse | null> {
  if (!isObject(raw)) {
    return errorResponse(null, -32600, "Invalid request");
  }

  const { jsonrpc, id = null, method, params } = raw as Partial<JsonRpcRequest>;
  if (jsonrpc !== "2.0" || typeof method !== "string") {
    return errorResponse(id ?? null, -32600, "Invalid request");
  }

  try {
    if (id === undefined || id === null) {
      if (method === "notifications/initialized") {
        return null;
      }
      return null;
    }
    switch (method) {
      case "initialize":
        return okResponse(id, {
          protocolVersion: "2024-11-05",
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
        });
      case "ping":
        return okResponse(id, {});
      case "tools/list":
        return okResponse(id, { tools: TOOL_DEFINITIONS });
      case "tools/call": {
        if (!isObject(params)) {
          return errorResponse(id, -32602, "Invalid params");
        }
        const name = params.name;
        const args = isObject(params.arguments) ? params.arguments : {};
        if (typeof name !== "string") {
          return errorResponse(id, -32602, "Invalid params");
        }

        if (name === "search") {
          const query = args.query;
          if (typeof query !== "string") {
            return errorResponse(id, -32602, "Invalid params: query must be a string");
          }
          if (query.length > MAX_SEARCH_QUERY_LENGTH) {
            return errorResponse(
              id,
              -32602,
              `Invalid params: query exceeds maximum length of ${MAX_SEARCH_QUERY_LENGTH} characters`,
            );
          }
          const allowedTypes = ["all", "papers", "videos", "nasa"] as const;
          const type = typeof args.type === "string" && allowedTypes.includes(args.type as (typeof allowedTypes)[number])
            ? args.type
            : "all";
          const limit = typeof args.limit === "number" ? Math.max(1, Math.min(50, Math.trunc(args.limit))) : 20;
          const page = typeof args.page === "number" ? Math.max(1, Math.trunc(args.page)) : 1;
          const locale = isLocale(args.locale) ? args.locale : "en";
          const dateFrom = typeof args.dateFrom === "string" ? args.dateFrom : undefined;
          const dateTo = typeof args.dateTo === "string" ? args.dateTo : undefined;

          const result: SearchResponse = await searchLibrary({
            q: query,
            type: type as "all" | "papers" | "videos" | "nasa",
            limit,
            page,
            locale,
            dateFrom,
            dateTo,
          });
          return okResponse(id, toolResult(result));
        }

        if (name === "get_stats") {
          const stats = await getLibraryStats();
          return okResponse(id, toolResult(stats));
        }

        if (name === "get_detail") {
          const detailType = args.type;
          const detailId = args.id;
          const locale = isLocale(args.locale) ? args.locale : "en";
          if (
            (detailType !== "paper" && detailType !== "video" && detailType !== "nasa") ||
            typeof detailId !== "string" ||
            detailId.trim() === ""
          ) {
            return errorResponse(id, -32602, "Invalid params: type and id are required");
          }

          const detail = await getDetail({
            type: detailType,
            id: detailId,
            locale,
          });
          if (!detail) {
            return okResponse(id, {
              content: [{ type: "text", text: "Item not found" }],
              isError: true,
            });
          }
          return okResponse(id, toolResult(detail));
        }

        return errorResponse(id, -32602, "Invalid params: unknown tool");
      }
      default:
        return errorResponse(id, -32601, "Method not found");
    }
  } catch (error) {
    return errorResponse(id, -32603, "Internal error", String(error));
  }
}
