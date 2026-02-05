import { assertEquals, assert } from "jsr:@std/assert@1";
import { handleMCPRequest } from "./mcp.ts";

// Validation-only tests; avoid DB-backed tool execution to keep tests hermetic.
Deno.test("MCP initialize returns protocolVersion and serverInfo", async () => {
  const response = await handleMCPRequest({ jsonrpc: "2.0", id: 1, method: "initialize" });
  assert(response !== null);
  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 1);
  const result = response.result as Record<string, unknown>;
  assertEquals(result.protocolVersion, "2024-11-05");
  const serverInfo = result.serverInfo as Record<string, unknown>;
  assertEquals(typeof serverInfo.name, "string");
  assertEquals(typeof serverInfo.version, "string");
});

Deno.test("MCP ping returns empty result", async () => {
  const response = await handleMCPRequest({ jsonrpc: "2.0", id: "ping-1", method: "ping" });
  assert(response !== null);
  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, "ping-1");
  assertEquals(response.result, {});
});

Deno.test("MCP notifications return null", async () => {
  const response = await handleMCPRequest({ jsonrpc: "2.0", method: "notifications/initialized" });
  assertEquals(response, null);
});

Deno.test("Unknown notifications are ignored", async () => {
  const response = await handleMCPRequest({ jsonrpc: "2.0", method: "notifications/unknown" });
  assertEquals(response, null);
});

Deno.test("tools/list returns tool definitions", async () => {
  const response = await handleMCPRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert(response !== null);
  assertEquals(response.jsonrpc, "2.0");
  const result = response.result as Record<string, unknown>;
  const tools = result.tools as Array<{ name: string }>;
  const toolNames = tools.map((t) => t.name).sort();
  assertEquals(toolNames, ["get_detail", "get_stats", "search"].sort());
});

Deno.test("tools/call rejects missing params", async () => {
  const response = await handleMCPRequest({ jsonrpc: "2.0", id: 3, method: "tools/call" });
  assert(response !== null);
  assertEquals(response.error?.code, -32602);
});

Deno.test("tools/call search requires query", async () => {
  const response = await handleMCPRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "search", arguments: {} },
  });
  assert(response !== null);
  assertEquals(response.error?.code, -32602);
});

Deno.test("tools/call get_detail requires type and id", async () => {
  const response = await handleMCPRequest({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "get_detail", arguments: { type: "paper" } },
  });
  assert(response !== null);
  assertEquals(response.error?.code, -32602);
});

Deno.test("tools/call rejects unknown tool", async () => {
  const response = await handleMCPRequest({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "nope", arguments: {} },
  });
  assert(response !== null);
  assertEquals(response.error?.code, -32602);
});

Deno.test("Invalid request returns -32600", async () => {
  const response = await handleMCPRequest("nope" as unknown);
  assert(response !== null);
  assertEquals(response.error?.code, -32600);
  assertEquals(response.id, null);
});
