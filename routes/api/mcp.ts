import { Handlers } from "fresh";
import { db } from "../../db/client.ts";
import { papers, videos, nasaContent } from "../../db/schema.ts";
import { initializeCollections } from "../../lib/vector.ts";
import { eq } from "drizzle-orm";

// MCP (Model Context Protocol) Server for Claude Desktop Integration
// This enables Claude Desktop to query the AstroGroot library

interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const request: MCPRequest = await req.json();
      const response = await handleMCPRequest(request);

      return new Response(JSON.stringify(response), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: -32603,
            message: `Internal error: ${error}`,
          },
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  },

  // Handle SSE (Server-Sent Events) for streaming
  async GET(req) {
    const url = new URL(req.url);
    const method = url.searchParams.get("method");

    if (!method) {
      return new Response("Method parameter required", { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const result = await handleMCPRequest({ method });

          // Send result as SSE
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(result)}\n\n`),
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: String(error) })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  },
};

async function handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  const { method, params } = request;

  switch (method) {
    case "search":
      return await handleSearch(params);
    case "getPaper":
      return await handleGetPaper(params);
    case "getVideo":
      return await handleGetVideo(params);
    case "getNasaContent":
      return await handleGetNasaContent(params);
    case "getStats":
      return await handleGetStats();
    case "listMethods":
      return handleListMethods();
    default:
      return {
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

async function handleSearch(
  params?: Record<string, unknown>,
): Promise<MCPResponse> {
  if (!params || !params.query) {
    return {
      error: {
        code: -32602,
        message: "Invalid params: query is required",
      },
    };
  }

  const query = String(params.query);
  const type = params.type ? String(params.type) : "all";
  const limit = params.limit ? Number(params.limit) : 10;

  try {
    const collections = await initializeCollections();
    const results = [];

    if (type === "all" || type === "papers") {
      const paperResults = await collections.papers.query({
        queryText: query,
        nResults: limit,
      });

      for (let i = 0; i < paperResults.ids[0].length; i++) {
        results.push({
          id: paperResults.ids[0][i],
          type: "paper",
          title: paperResults.metadatas[0][i]?.title,
          snippet: paperResults.documents[0][i]?.substring(0, 200),
          score: 1 - paperResults.distances[0][i],
        });
      }
    }

    if (type === "all" || type === "videos") {
      const videoResults = await collections.videos.query({
        queryText: query,
        nResults: limit,
      });

      for (let i = 0; i < videoResults.ids[0].length; i++) {
        results.push({
          id: videoResults.ids[0][i],
          type: "video",
          title: videoResults.metadatas[0][i]?.title,
          snippet: videoResults.documents[0][i]?.substring(0, 200),
          score: 1 - videoResults.distances[0][i],
        });
      }
    }

    if (type === "all" || type === "nasa") {
      const nasaResults = await collections.nasa.query({
        queryText: query,
        nResults: limit,
      });

      for (let i = 0; i < nasaResults.ids[0].length; i++) {
        results.push({
          id: nasaResults.ids[0][i],
          type: "nasa",
          title: nasaResults.metadatas[0][i]?.title,
          snippet: nasaResults.documents[0][i]?.substring(0, 200),
          score: 1 - nasaResults.distances[0][i],
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return { result: { results, total: results.length } };
  } catch (error) {
    return {
      error: {
        code: -32603,
        message: `Search error: ${error}`,
      },
    };
  }
}

async function handleGetPaper(
  params?: Record<string, unknown>,
): Promise<MCPResponse> {
  if (!params || !params.id) {
    return {
      error: {
        code: -32602,
        message: "Invalid params: id is required",
      },
    };
  }

  try {
    const paper = await db.query.papers.findFirst({
      where: eq(papers.id, String(params.id)),
    });

    if (!paper) {
      return {
        error: {
          code: -32600,
          message: "Paper not found",
        },
      };
    }

    return { result: paper };
  } catch (error) {
    return {
      error: {
        code: -32603,
        message: `Error retrieving paper: ${error}`,
      },
    };
  }
}

async function handleGetVideo(
  params?: Record<string, unknown>,
): Promise<MCPResponse> {
  if (!params || !params.id) {
    return {
      error: {
        code: -32602,
        message: "Invalid params: id is required",
      },
    };
  }

  try {
    const video = await db.query.videos.findFirst({
      where: eq(videos.id, String(params.id)),
    });

    if (!video) {
      return {
        error: {
          code: -32600,
          message: "Video not found",
        },
      };
    }

    return { result: video };
  } catch (error) {
    return {
      error: {
        code: -32603,
        message: `Error retrieving video: ${error}`,
      },
    };
  }
}

async function handleGetNasaContent(
  params?: Record<string, unknown>,
): Promise<MCPResponse> {
  if (!params || !params.id) {
    return {
      error: {
        code: -32602,
        message: "Invalid params: id is required",
      },
    };
  }

  try {
    const content = await db.query.nasaContent.findFirst({
      where: eq(nasaContent.id, String(params.id)),
    });

    if (!content) {
      return {
        error: {
          code: -32600,
          message: "NASA content not found",
        },
      };
    }

    return { result: content };
  } catch (error) {
    return {
      error: {
        code: -32603,
        message: `Error retrieving NASA content: ${error}`,
      },
    };
  }
}

async function handleGetStats(): Promise<MCPResponse> {
  try {
    const [paperCount, videoCount, nasaCount] = await Promise.all([
      db.select().from(papers),
      db.select().from(videos),
      db.select().from(nasaContent),
    ]);

    return {
      result: {
        papers: paperCount.length,
        videos: videoCount.length,
        nasa: nasaCount.length,
        total: paperCount.length + videoCount.length + nasaCount.length,
      },
    };
  } catch (error) {
    return {
      error: {
        code: -32603,
        message: `Error retrieving stats: ${error}`,
      },
    };
  }
}

function handleListMethods(): MCPResponse {
  return {
    result: {
      methods: [
        {
          name: "search",
          description: "Search the library using natural language",
          params: {
            query: "string (required)",
            type: "'all' | 'papers' | 'videos' | 'nasa' (optional, default: 'all')",
            limit: "number (optional, default: 10)",
          },
        },
        {
          name: "getPaper",
          description: "Get a specific paper by arXiv ID",
          params: {
            id: "string (required) - arXiv ID",
          },
        },
        {
          name: "getVideo",
          description: "Get a specific video by YouTube ID",
          params: {
            id: "string (required) - YouTube video ID",
          },
        },
        {
          name: "getNasaContent",
          description: "Get specific NASA content by ID",
          params: {
            id: "string (required) - NASA content ID",
          },
        },
        {
          name: "getStats",
          description: "Get library statistics",
          params: {},
        },
        {
          name: "listMethods",
          description: "List all available MCP methods",
          params: {},
        },
      ],
    },
  };
}
