#!/usr/bin/env -S deno run --allow-all

import { Hono } from "hono";

import { renderHomePage, renderNotFoundPage, renderSearchPage } from "./lib/pages.ts";
import { mcpHandler } from "./routes/api/mcp.ts";

const port = Number(Deno.env.get("PORT")) || 8000;

console.log("AstroGroot Research Library starting...");

export const app = new Hono();

// Add a simple test route
app.get("/", (c) => c.html(renderHomePage()));

app.get("/search", (c) => c.html(renderSearchPage()));

app.get("/api/stats", (c) =>
  c.json({
    papers: 0,
    videos: 0,
    nasa: 0,
    total: 0,
  }),
);

app.all("/api/mcp", mcpHandler);
app.notFound((c) => c.html(renderNotFoundPage(), 404));

if (import.meta.main) {
  console.log(`Server running on http://localhost:${port}`);
  Deno.serve({ port }, app.fetch);
}
