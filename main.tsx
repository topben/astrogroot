#!/usr/bin/env -S deno run --allow-all

import { Hono } from "hono";
import { handleMCPRequest } from "./lib/mcp.ts";
import { getLibraryStats } from "./lib/stats.ts";
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

// API
app.get("/api/health", (c) =>
  c.json({ ok: true, service: "astrogroot", timestamp: new Date().toISOString() })
);
app.get("/api/stats", async (c) => c.json(await getLibraryStats()));

// Pages
app.get("/", async (c) => {
  const stats = await getLibraryStats();
  return c.html(<DashboardPage stats={stats} />);
});
app.get("/search", (c) => c.html(<SearchPage />));

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
      const code = err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : null;
      const name = err instanceof Error ? err.name : "";
      const msg = err instanceof Error ? err.message : String(err);
      const addrInUse =
        name === "AddrInUse" ||
        code === "AddrInUse" ||
        code === 48 ||
        code === "48" ||
        /address already in use|addrinuse/i.test(msg);
      if (addrInUse && attempt < maxPortAttempts - 1) continue;
      throw err;
    }
  }
}
