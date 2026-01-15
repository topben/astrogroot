import type { FreshContext } from "fresh";

// MCP (Model Context Protocol) Server for Claude Desktop Integration
export default async function handler(
  req: Request,
  _ctx: FreshContext,
): Promise<Response> {
  if (req.method === "POST") {
    try {
      const request = await req.json();
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
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const method = url.searchParams.get("method");

    if (!method) {
      return new Response("Method parameter required", { status: 400 });
    }

    const result = await handleMCPRequest({ method });
    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return new Response("Method not allowed", { status: 405 });
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
