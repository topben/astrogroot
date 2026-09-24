import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { app } from "../main.tsx";

Deno.test("developer guide is server-rendered in each supported language without a database", async () => {
  for (
    const [locale, title] of [
      ["en", "Tools for agents and developers"],
      ["zh-TW", "給 AI agent 與開發者的工具"],
      ["zh-CN", "面向 AI agent 与开发者的工具"],
    ]
  ) {
    const response = await app.request(`https://astrogroot.org/developers?lang=${locale}`);
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("content-language"), locale);
    assertStringIncludes(response.headers.get("content-type") ?? "", "text/html");
    assertStringIncludes(response.headers.get("vary") ?? "", "Accept-Language");
    const html = await response.text();
    assertStringIncludes(html, `<h1>${title}</h1>`);
    assertStringIncludes(html, 'href="https://ifandonlyif.io/sdk#mcp"');
    assertStringIncludes(html, 'href="https://ifandonlyif.io/apostille/docs#mcp"');
    assertStringIncludes(html, "https://iff-mcp-api-production.up.railway.app/mcp/iff");
    assertStringIncludes(html, "https://iff-mcp-api-production.up.railway.app/mcp/apostille");
    assertStringIncludes(html, 'href="/llms.txt"');
    assert(!html.includes("tokimi.eth"));
  }
});

Deno.test("discovery text and HEAD requests are available without executing a tool", async () => {
  const response = await app.request("https://astrogroot.org/llms.txt");
  assertEquals(response.status, 200);
  assertStringIncludes(response.headers.get("content-type") ?? "", "text/plain");
  assertEquals(response.headers.get("content-language"), "en");
  const text = await response.text();
  assertStringIncludes(text, "https://astrogroot.org/developers");
  assertStringIncludes(text, "https://ifandonlyif.io/apostille/docs#mcp");
  for (const path of ["/developers", "/llms.txt"]) {
    const head = await app.request(`https://astrogroot.org${path}`, { method: "HEAD" });
    assertEquals(head.status, 200);
    assertEquals(await head.text(), "");
  }
});
