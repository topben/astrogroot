import type { Context } from "hono";

// MCP (Model Context Protocol) Server for Claude Desktop Integration
export async function mcpHandler(c: Context): Promise<Response> {
  if (c.req.method === "POST") {
    try {
      const request = await c.req.json();
      const response = await handleMCPRequest(request);

      return c.json(response, 200, {
        "Access-Control-Allow-Origin": "*",
      });
    } catch (error) {
      return c.json(
        {
          error: {
            code: -32603,
            message: `Internal error: ${error}`,
          },
        },
        500,
      );
    }
  }

  if (c.req.method === "GET") {
    const method = c.req.query("method");

    if (!method) {
      return c.text("Method parameter required", 400);
    }

    const result = await handleMCPRequest({ method });
    return c.json(result);
  }

  return c.text("Method not allowed", 405);
}

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

async function handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  const { method } = request;

  switch (method) {
    case "getStats":
      return {
        result: {
          papers: 0,
          videos: 0,
          nasa: 0,
          total: 0,
        },
      };
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

function handleListMethods(): MCPResponse {
  return {
    result: {
      methods: [
        {
          name: "search",
          description: "Search the library using natural language",
          params: {
            query: "string (required)",
            type: "'all' | 'papers' | 'videos' | 'nasa' (optional)",
            limit: "number (optional, default: 10)",
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
