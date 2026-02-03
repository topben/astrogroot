#!/usr/bin/env -S deno run --allow-all

import { Hono } from "hono";
import { handleMCPRequest } from "./lib/mcp.ts";
import { getLibraryStats } from "./lib/stats.ts";
import { searchLibrary } from "./lib/search.ts";
import { getLocaleFromRequest, loadDictionary } from "./lib/i18n.ts";
import { db } from "./db/client.ts";
import { nasaContent, papers, translations, videos } from "./db/schema.ts";
import { and, eq } from "drizzle-orm";
import { DashboardPage } from "./components/pages/dashboard.tsx";
import { SearchPage } from "./components/pages/search.tsx";
import { NotFoundPage } from "./components/pages/not-found.tsx";
import { DetailPage } from "./components/pages/detail.tsx";

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

app.get("/api/search", async (c) => {
  const q = c.req.query("q") ?? "";
  const type = (c.req.query("type") ?? "all") as "all" | "papers" | "videos" | "nasa";
  const limit = parseInt(c.req.query("limit") ?? "20", 10) || 20;
  const dateFrom = c.req.query("dateFrom") ?? "";
  const dateTo = c.req.query("dateTo") ?? "";
  const locale = getLocaleFromRequest(
    c.req.query("lang"),
    c.req.header("Accept-Language"),
  );
  try {
    const result = await searchLibrary({ q, type, limit, locale, dateFrom, dateTo });
    return c.json(result);
  } catch (err) {
    console.error("Search error:", err);
    return c.json(
      { query: q, papers: [], videos: [], nasa: [], total: 0, error: String(err) },
      500
    );
  }
});

// Pages
app.get("/", async (c) => {
  const locale = getLocaleFromRequest(
    c.req.query("lang"),
    c.req.header("Accept-Language"),
  );
  const dict = await loadDictionary(locale);
  const stats = await getLibraryStats();
  return c.html(<DashboardPage stats={stats} locale={locale} dict={dict} />);
});
app.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  const type = c.req.query("type") ?? "all";
  const sortBy = c.req.query("sortBy") ?? "relevance";
  const dateFrom = c.req.query("dateFrom") ?? "";
  const dateTo = c.req.query("dateTo") ?? "";
  const locale = getLocaleFromRequest(
    c.req.query("lang"),
    c.req.header("Accept-Language"),
  );
  const dict = await loadDictionary(locale);
  return c.html(
    <SearchPage
      query={q}
      type={type}
      sortBy={sortBy}
      dateFrom={dateFrom}
      dateTo={dateTo}
      locale={locale}
      dict={dict}
    />
  );
});

app.get("/detail", async (c) => {
  const type = (c.req.query("type") ?? "") as "paper" | "video" | "nasa";
  const id = c.req.query("id") ?? "";
  const locale = getLocaleFromRequest(
    c.req.query("lang"),
    c.req.header("Accept-Language"),
  );
  const dict = await loadDictionary(locale);
  if (!id || !type) {
    return c.html(<NotFoundPage locale={locale} dict={dict} />);
  }

  const trans = await db.query.translations.findFirst({
    where: and(eq(translations.itemType, type), eq(translations.itemId, id), eq(translations.lang, locale)),
    columns: { title: true, summary: true },
  });

  if (type === "paper") {
    const row = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!row) return c.html(<NotFoundPage locale={locale} dict={dict} />);
    const summary = trans?.summary ?? row.summary ?? row.abstract ?? "";
    const title = trans?.title ?? row.title;
    return c.html(
      <DetailPage
        title={title}
        typeLabel={dict.common.paper}
        publishedDate={row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined}
        summary={summary}
        sourceUrl={row.arxivUrl ?? row.pdfUrl ?? undefined}
        locale={locale}
        dict={dict}
      />,
    );
  }

  if (type === "video") {
    const row = await db.query.videos.findFirst({ where: eq(videos.id, id) });
    if (!row) return c.html(<NotFoundPage locale={locale} dict={dict} />);
    const summary = trans?.summary ?? row.summary ?? row.description ?? "";
    const title = trans?.title ?? row.title;
    return c.html(
      <DetailPage
        title={title}
        typeLabel={dict.common.video}
        publishedDate={row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined}
        summary={summary}
        sourceUrl={row.videoUrl}
        locale={locale}
        dict={dict}
      />,
    );
  }

  if (type === "nasa") {
    const row = await db.query.nasaContent.findFirst({ where: eq(nasaContent.id, id) });
    if (!row) return c.html(<NotFoundPage locale={locale} dict={dict} />);
    const summary = trans?.summary ?? row.summary ?? row.explanation ?? row.description ?? "";
    const title = trans?.title ?? row.title;
    return c.html(
      <DetailPage
        title={title}
        typeLabel={dict.common.nasa}
        publishedDate={row.date ? new Date(row.date).toISOString().slice(0, 10) : undefined}
        summary={summary}
        sourceUrl={row.url}
        locale={locale}
        dict={dict}
      />,
    );
  }

  return c.html(<NotFoundPage locale={locale} dict={dict} />);
});

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
app.notFound(async (c) => {
  const locale = getLocaleFromRequest(
    c.req.query("lang"),
    c.req.header("Accept-Language"),
  );
  const dict = await loadDictionary(locale);
  return c.html(<NotFoundPage locale={locale} dict={dict} />, 404);
});

export { app };

// Deno Deploy: no port binding; platform invokes the handler
const isDeploy = typeof Deno.env.get("DENO_DEPLOYMENT_ID") === "string";

if (import.meta.main) {
  if (isDeploy) {
    Deno.serve(app.fetch);
  } else {
    console.log("AstroGroot Research Library starting...");
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
}
