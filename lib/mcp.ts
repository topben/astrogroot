// MCP (Model Context Protocol) Server for Claude Desktop Integration

export interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export async function handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
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
