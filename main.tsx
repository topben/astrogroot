#!/usr/bin/env -S deno run --allow-all

import { Hono } from "hono";
import { handleMCPRequest } from "./lib/mcp.ts";
import { DashboardPage } from "./components/pages/dashboard.tsx";
import { SearchPage } from "./components/pages/search.tsx";
import { NotFoundPage } from "./components/pages/not-found.tsx";

const defaultPort = Number(Deno.env.get("PORT")) || 8000;
const maxPortAttempts = 10;

const app = new Hono();

// Static: logo
app.get("/static/astrogroot-logo.png", async (c) => {
  const path = new URL("./static/astrogroot-logo.png", import.meta.url);
  const file = await Deno.readFile(path);
  c.header("Content-Type", "image/png");
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(file, 200);
});

// Pages
app.get("/", (c) => c.html(<DashboardPage />));
app.get("/search", (c) => c.html(<SearchPage />));

// API
app.get("/api/stats", (c) =>
  c.json({ papers: 0, videos: 0, nasa: 0, total: 0 })
);

app.post("/api/mcp", async (c) => {
  try {
    const body = await c.req.json();
    const response = await handleMCPRequest(body);
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
      500
    );
  }
});

app.get("/api/mcp", async (c) => {
  const method = c.req.query("method");
  if (!method) {
    return c.text("Method parameter required", 400);
  }
  const result = await handleMCPRequest({ method });
  return c.json(result);
});

// 404
app.notFound((c) => c.html(<NotFoundPage />, 404));

console.log("AstroGroot Research Library starting...");

if (import.meta.main) {
  for (let attempt = 0; attempt < maxPortAttempts; attempt++) {
    const p = defaultPort + attempt;
    try {
      const listener = Deno.listen({ port: p });
      listener.close();
      Deno.serve({ port: p, handler: app.fetch });
      console.log(`Server running on http://localhost:${p}`);
      if (attempt > 0) {
        console.log(`(Port ${defaultPort} was in use)`);
      }
      break;
    } catch (err) {
      const addrInUse =
        err instanceof Error &&
        ("code" in err ? (err as { code: string }).code === "AddrInUse" : false);
      if (addrInUse && attempt < maxPortAttempts - 1) continue;
      throw err;
    }
  }
}

export default app;
