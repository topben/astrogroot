#!/usr/bin/env -S deno run --allow-all

import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { timeout } from "hono/timeout";
import { handleMCPRequest } from "./lib/mcp.ts";
import { getLibraryStats } from "./lib/stats.ts";
import { searchLibrary } from "./lib/search.ts";
import { getLocaleFromRequest, interpolate, loadDictionary } from "./lib/i18n.ts";
import {
  INCLUDE_ERROR_DATA,
  MAX_SEARCH_QUERY_LENGTH,
  MCP_ALLOWED_ORIGINS,
  MCP_MAX_BODY_BYTES,
  RATE_LIMITS,
  REQUEST_TIMEOUT_MS,
} from "./lib/config.ts";
import { rateLimit } from "./lib/rate-limit.ts";
import { db } from "./db/client.ts";
import { nasaContent, papers, translations, videos } from "./db/schema.ts";
import { and, eq } from "drizzle-orm";
import { DashboardPage } from "./components/pages/dashboard.tsx";
import { SearchPage } from "./components/pages/search.tsx";
import { NotFoundPage } from "./components/pages/not-found.tsx";
import { DetailPage } from "./components/pages/detail.tsx";
import { renderMarkdown } from "./lib/markdown.ts";

const defaultPort = Number(Deno.env.get("PORT")) || 8000;
const maxPortAttempts = 10;

const app = new Hono();
const HTML_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=600";
const API_CACHE_CONTROL = "public, max-age=60";
const STATIC_CACHE_CONTROL = "public, max-age=604800";

// ─────────────────────────────────────────────────────────────────────────────
// Global Security Headers
// ─────────────────────────────────────────────────────────────────────────────
app.use("*", secureHeaders());

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting per Route Group
// ─────────────────────────────────────────────────────────────────────────────
app.use("/", rateLimit(RATE_LIMITS.html));
app.use("/search", rateLimit(RATE_LIMITS.html));
app.use("/detail", rateLimit(RATE_LIMITS.html));
app.use("/api/health", rateLimit(RATE_LIMITS.health));
app.use("/sitemap.xml", rateLimit(RATE_LIMITS.html));
app.use("/api/search", rateLimit(RATE_LIMITS.api));
app.use("/api/stats", rateLimit(RATE_LIMITS.api));

// ─────────────────────────────────────────────────────────────────────────────
// MCP Middleware Stack
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  "/api/mcp",
  cors({
    origin: MCP_ALLOWED_ORIGINS,
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);
app.use("/api/mcp", bodyLimit({ maxSize: MCP_MAX_BODY_BYTES }));
app.use("/api/mcp", rateLimit(RATE_LIMITS.mcp));
app.use("/api/mcp", timeout(REQUEST_TIMEOUT_MS));

// ─────────────────────────────────────────────────────────────────────────────
// Timeout on Search API
// ─────────────────────────────────────────────────────────────────────────────
app.use("/api/search", timeout(REQUEST_TIMEOUT_MS));

function normalizeUrl(url: URL): string {
  if ([...url.searchParams.keys()].length === 0) {
    url.search = "";
  }
  return url.toString();
}

function stripTransientParams(url: URL): void {
  url.searchParams.delete("page");
  url.searchParams.delete("sortBy");
}

function buildCanonicalUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.searchParams.delete("lang");
  stripTransientParams(url);
  return normalizeUrl(url);
}

function buildAlternateUrls(requestUrl: string): { en: string; "zh-TW": string; "zh-CN": string } {
  const base = new URL(requestUrl);
  const build = (locale: "en" | "zh-TW" | "zh-CN") => {
    const url = new URL(base.toString());
    stripTransientParams(url);
    if (locale === "en") {
      url.searchParams.delete("lang");
    } else {
      url.searchParams.set("lang", locale);
    }
    return normalizeUrl(url);
  };
  return {
    en: build("en"),
    "zh-TW": build("zh-TW"),
    "zh-CN": build("zh-CN"),
  };
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  const trimmed = value.slice(0, Math.max(0, maxLen - 3));
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > 80 ? trimmed.slice(0, lastSpace) : trimmed).trimEnd() + "...";
}

function formatDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function addLangToUrl(urlStr: string, locale: "en" | "zh-TW" | "zh-CN"): string {
  const url = new URL(urlStr);
  if (locale === "en") {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", locale);
  }
  return normalizeUrl(url);
}

function setHtmlHeaders(c: { header: (name: string, value: string) => void }, locale: string): void {
  c.header("Cache-Control", HTML_CACHE_CONTROL);
  c.header("Content-Language", locale);
  c.header("Vary", "Accept-Language");
}

app.use("/api/*", async (c, next) => {
  await next();
  if (c.req.method === "GET") {
    c.header("Cache-Control", API_CACHE_CONTROL);
  }
});

// Static: logo
app.get("/static/astrogroot-logo.png", async (c) => {
  const path = new URL("./static/astrogroot-logo.png", import.meta.url);
  const file = await Deno.readFile(path);
  c.header("Content-Type", "image/png");
  c.header("Cache-Control", STATIC_CACHE_CONTROL);
  return c.body(file, 200);
});

app.get("/static/favicon.png", async (c) => {
  const path = new URL("./static/favicon.png", import.meta.url);
  const file = await Deno.readFile(path);
  c.header("Content-Type", "image/png");
  c.header("Cache-Control", STATIC_CACHE_CONTROL);
  return c.body(file, 200);
});

app.get("/favicon.ico", async (c) => {
  const path = new URL("./static/favicon.png", import.meta.url);
  const file = await Deno.readFile(path);
  c.header("Content-Type", "image/png");
  c.header("Cache-Control", STATIC_CACHE_CONTROL);
  return c.body(file, 200);
});

app.get("/robots.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`;
  c.header("Content-Type", "text/plain; charset=utf-8");
  c.header("Cache-Control", HTML_CACHE_CONTROL);
  return c.text(body, 200);
});

app.get("/sitemap.xml", async (c) => {
  const origin = new URL(c.req.url).origin;
  const urls: string[] = [];
  const pushUrl = (loc: string, lastmod?: string, changefreq?: string, priority?: string) => {
    const alternates = [
      { hreflang: "en", href: addLangToUrl(loc, "en") },
      { hreflang: "zh-Hant", href: addLangToUrl(loc, "zh-TW") },
      { hreflang: "zh-Hans", href: addLangToUrl(loc, "zh-CN") },
      { hreflang: "x-default", href: addLangToUrl(loc, "en") },
    ];
    let xml = "  <url>\n";
    xml += `    <loc>${escapeXml(loc)}</loc>\n`;
    if (changefreq) {
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
    }
    if (priority) {
      xml += `    <priority>${priority}</priority>\n`;
    }
    if (lastmod) {
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
    }
    for (const alt of alternates) {
      xml += `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(alt.href)}" />\n`;
    }
    xml += "  </url>";
    urls.push(xml);
  };

  pushUrl(`${origin}/`, undefined, "daily", "1.0");
  pushUrl(`${origin}/search`, undefined, undefined, "0.5");

  const paperRows = await db
    .select({ id: papers.id, publishedDate: papers.publishedDate, updatedDate: papers.updatedDate })
    .from(papers);
  for (const row of paperRows) {
    const loc = `${origin}/detail?type=paper&id=${encodeURIComponent(row.id)}`;
    const lastmod = formatDate(row.updatedDate ?? row.publishedDate);
    pushUrl(loc, lastmod, undefined, "0.7");
  }

  const videoRows = await db
    .select({ id: videos.id, publishedDate: videos.publishedDate, updatedAt: videos.updatedAt })
    .from(videos);
  for (const row of videoRows) {
    const loc = `${origin}/detail?type=video&id=${encodeURIComponent(row.id)}`;
    const lastmod = formatDate(row.updatedAt ?? row.publishedDate);
    pushUrl(loc, lastmod, undefined, "0.7");
  }

  const nasaRows = await db
    .select({ id: nasaContent.id, date: nasaContent.date, updatedAt: nasaContent.updatedAt })
    .from(nasaContent);
  for (const row of nasaRows) {
    const loc = `${origin}/detail?type=nasa&id=${encodeURIComponent(row.id)}`;
    const lastmod = formatDate(row.date ?? row.updatedAt);
    pushUrl(loc, lastmod, undefined, "0.7");
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${urls.join("\n")}\n` +
    `</urlset>\n`;

  c.header("Content-Type", "application/xml; charset=utf-8");
  c.header("Cache-Control", HTML_CACHE_CONTROL);
  return c.body(xml, 200);
});

// API
app.get("/api/health", (c) =>
  c.json({ ok: true, service: "astrogroot", timestamp: new Date().toISOString() })
);
app.get("/api/stats", async (c) => c.json(await getLibraryStats()));

app.get("/api/search", async (c) => {
  const q = c.req.query("q") ?? "";

  // Query length validation
  if (q.length > MAX_SEARCH_QUERY_LENGTH) {
    return c.json(
      {
        error: "Bad Request",
        message: `Query exceeds maximum length of ${MAX_SEARCH_QUERY_LENGTH} characters`,
      },
      400,
    );
  }

  const type = (c.req.query("type") ?? "all") as "all" | "papers" | "videos" | "nasa";
  const limit = parseInt(c.req.query("limit") ?? "20", 10) || 20;
  const page = parseInt(c.req.query("page") ?? "1", 10) || 1;
  const dateFrom = c.req.query("dateFrom") ?? "";
  const dateTo = c.req.query("dateTo") ?? "";
  const locale = getLocaleFromRequest(
    c.req.query("lang"),
    c.req.header("Accept-Language"),
  );
  try {
    const result = await searchLibrary({ q, type, limit, page, locale, dateFrom, dateTo });
    return c.json(result);
  } catch (err) {
    console.error("Search error:", err);
    return c.json(
      {
        query: q,
        papers: [],
        videos: [],
        nasa: [],
        total: 0,
        error: INCLUDE_ERROR_DATA ? String(err) : "Internal server error",
      },
      500,
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
  const canonicalUrl = buildCanonicalUrl(c.req.url);
  const alternateUrls = buildAlternateUrls(c.req.url);
  const pageTitle = dict.seo?.homeTitle ?? "AstroGroot - Astronomy Research Library";
  const pageDescription = dict.seo?.homeDescription ?? "Explore astronomy papers, videos, and NASA content";
  const origin = new URL(c.req.url).origin;
  const searchActionUrl = `${origin}/search?q={search_term_string}`;
  setHtmlHeaders(c, locale);
  return c.html(
    <DashboardPage
      stats={stats}
      locale={locale}
      dict={dict}
      pageTitle={pageTitle}
      pageDescription={pageDescription}
      canonicalUrl={canonicalUrl}
      alternateUrls={alternateUrls}
      siteUrl={origin}
      searchActionUrl={searchActionUrl}
    />,
  );
});
app.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";

  // Query length validation
  if (q.length > MAX_SEARCH_QUERY_LENGTH) {
    const locale = getLocaleFromRequest(
      c.req.query("lang"),
      c.req.header("Accept-Language"),
    );
    const dict = await loadDictionary(locale);
    setHtmlHeaders(c, locale);
    return c.html(
      <NotFoundPage
        locale={locale}
        dict={dict}
        pageTitle="Bad Request - AstroGroot"
        pageDescription={`Query exceeds maximum length of ${MAX_SEARCH_QUERY_LENGTH} characters`}
        canonicalUrl={buildCanonicalUrl(c.req.url)}
        alternateUrls={buildAlternateUrls(c.req.url)}
      />,
      400,
    );
  }

  const type = c.req.query("type") ?? "all";
  const sortBy = c.req.query("sortBy") ?? "relevance";
  const dateFrom = c.req.query("dateFrom") ?? "";
  const dateTo = c.req.query("dateTo") ?? "";
  const page = parseInt(c.req.query("page") ?? "1", 10) || 1;
  const locale = getLocaleFromRequest(
    c.req.query("lang"),
    c.req.header("Accept-Language"),
  );
  const dict = await loadDictionary(locale);
  const canonicalUrl = buildCanonicalUrl(c.req.url);
  const alternateUrls = buildAlternateUrls(c.req.url);
  const queryText = q.trim();
  const pageTitle = queryText
    ? interpolate(dict.seo?.searchResultsTitle ?? "\"{query}\" - Search - AstroGroot", { query: queryText })
    : dict.seo?.searchTitle ?? "Search - AstroGroot";
  const pageDescription = queryText
    ? interpolate(
        dict.seo?.searchResultsDescription ?? "Search results for \"{query}\" in astronomy papers, videos, and NASA content",
        { query: queryText },
      )
    : dict.seo?.searchDescription ?? "Search astronomy research papers, videos, and NASA content";
  const robots = queryText && page > 1 ? "noindex,follow" : undefined;
  setHtmlHeaders(c, locale);
  return c.html(
    <SearchPage
      query={q}
      type={type}
      sortBy={sortBy}
      dateFrom={dateFrom}
      dateTo={dateTo}
      locale={locale}
      dict={dict}
      pageTitle={pageTitle}
      pageDescription={pageDescription}
      canonicalUrl={canonicalUrl}
      alternateUrls={alternateUrls}
      robots={robots}
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
  const canonicalUrl = buildCanonicalUrl(c.req.url);
  const alternateUrls = buildAlternateUrls(c.req.url);
  if (!id || !type) {
    setHtmlHeaders(c, locale);
    return c.html(
      <NotFoundPage
        locale={locale}
        dict={dict}
        pageTitle={dict.seo?.notFoundTitle ?? "Page Not Found - AstroGroot"}
        pageDescription={dict.seo?.notFoundDescription ?? "The requested page could not be found."}
        canonicalUrl={canonicalUrl}
        alternateUrls={alternateUrls}
      />,
      404,
    );
  }

  const trans = await db.query.translations.findFirst({
    where: and(eq(translations.itemType, type), eq(translations.itemId, id), eq(translations.lang, locale)),
    columns: { title: true, summary: true },
  });

  if (type === "paper") {
    const row = await db.query.papers.findFirst({ where: eq(papers.id, id) });
    if (!row) {
      setHtmlHeaders(c, locale);
      return c.html(
        <NotFoundPage
          locale={locale}
          dict={dict}
          pageTitle={dict.seo?.notFoundTitle ?? "Page Not Found - AstroGroot"}
          pageDescription={dict.seo?.notFoundDescription ?? "The requested page could not be found."}
          canonicalUrl={canonicalUrl}
          alternateUrls={alternateUrls}
        />,
        404,
      );
    }
    const summary = trans?.summary ?? row.summary ?? row.abstract ?? "";
    const title = trans?.title ?? row.title;
    const cleanSummary = cleanText(summary);
    const pageDescription = cleanSummary
      ? truncateText(cleanSummary, 155)
      : dict.seo?.searchDescription ?? "Search astronomy research papers, videos, and NASA content";
    const pageTitle = `${title} - ${(dict.seo?.siteName ?? "AstroGroot")}`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      headline: title,
      datePublished: formatDate(row.publishedDate),
      abstract: cleanSummary || undefined,
      url: canonicalUrl,
      inLanguage: locale,
    };
    setHtmlHeaders(c, locale);
    return c.html(
      <DetailPage
        title={title}
        typeLabel={dict.common.paper}
        publishedDate={row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined}
        summaryHtml={renderMarkdown(summary)}
        sourceUrl={row.arxivUrl ?? row.pdfUrl ?? undefined}
        locale={locale}
        dict={dict}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        canonicalUrl={canonicalUrl}
        alternateUrls={alternateUrls}
        jsonLd={jsonLd}
      />,
    );
  }

  if (type === "video") {
    const row = await db.query.videos.findFirst({ where: eq(videos.id, id) });
    if (!row) {
      setHtmlHeaders(c, locale);
      return c.html(
        <NotFoundPage
          locale={locale}
          dict={dict}
          pageTitle={dict.seo?.notFoundTitle ?? "Page Not Found - AstroGroot"}
          pageDescription={dict.seo?.notFoundDescription ?? "The requested page could not be found."}
          canonicalUrl={canonicalUrl}
          alternateUrls={alternateUrls}
        />,
        404,
      );
    }
    const summary = trans?.summary ?? row.summary ?? row.description ?? "";
    const title = trans?.title ?? row.title;
    const cleanSummary = cleanText(summary);
    const pageDescription = cleanSummary
      ? truncateText(cleanSummary, 155)
      : dict.seo?.searchDescription ?? "Search astronomy research papers, videos, and NASA content";
    const pageTitle = `${title} - ${(dict.seo?.siteName ?? "AstroGroot")}`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: title,
      description: cleanSummary || undefined,
      uploadDate: formatDate(row.publishedDate),
      thumbnailUrl: row.thumbnailUrl ? [row.thumbnailUrl] : undefined,
      contentUrl: row.videoUrl,
      url: canonicalUrl,
      inLanguage: locale,
    };
    setHtmlHeaders(c, locale);
    return c.html(
      <DetailPage
        title={title}
        typeLabel={dict.common.video}
        publishedDate={row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined}
        summaryHtml={renderMarkdown(summary)}
        sourceUrl={row.videoUrl}
        locale={locale}
        dict={dict}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        canonicalUrl={canonicalUrl}
        alternateUrls={alternateUrls}
        ogImage={row.thumbnailUrl ?? undefined}
        jsonLd={jsonLd}
      />,
    );
  }

  if (type === "nasa") {
    const row = await db.query.nasaContent.findFirst({ where: eq(nasaContent.id, id) });
    if (!row) {
      setHtmlHeaders(c, locale);
      return c.html(
        <NotFoundPage
          locale={locale}
          dict={dict}
          pageTitle={dict.seo?.notFoundTitle ?? "Page Not Found - AstroGroot"}
          pageDescription={dict.seo?.notFoundDescription ?? "The requested page could not be found."}
          canonicalUrl={canonicalUrl}
          alternateUrls={alternateUrls}
        />,
        404,
      );
    }
    const summary = trans?.summary ?? row.summary ?? row.explanation ?? row.description ?? "";
    const title = trans?.title ?? row.title;
    const cleanSummary = cleanText(summary);
    const pageDescription = cleanSummary
      ? truncateText(cleanSummary, 155)
      : dict.seo?.searchDescription ?? "Search astronomy research papers, videos, and NASA content";
    const pageTitle = `${title} - ${(dict.seo?.siteName ?? "AstroGroot")}`;
    const isImage = row.mediaType === "image" || row.contentType === "image" || row.contentType === "apod";
    const imageUrl = row.hdUrl ?? row.thumbnailUrl ?? row.url ?? undefined;
    const jsonLd = isImage
      ? {
          "@context": "https://schema.org",
          "@type": "ImageObject",
          name: title,
          description: cleanSummary || undefined,
          datePublished: formatDate(row.date),
          contentUrl: row.hdUrl ?? row.url,
          thumbnailUrl: row.thumbnailUrl ?? undefined,
          url: canonicalUrl,
          inLanguage: locale,
        }
      : {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description: cleanSummary || undefined,
          datePublished: formatDate(row.date),
          url: canonicalUrl,
          inLanguage: locale,
        };
    setHtmlHeaders(c, locale);
    return c.html(
      <DetailPage
        title={title}
        typeLabel={dict.common.nasa}
        publishedDate={row.date ? new Date(row.date).toISOString().slice(0, 10) : undefined}
        summaryHtml={renderMarkdown(summary)}
        sourceUrl={row.url}
        locale={locale}
        dict={dict}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        canonicalUrl={canonicalUrl}
        alternateUrls={alternateUrls}
        ogImage={imageUrl}
        jsonLd={jsonLd}
      />,
    );
  }

  setHtmlHeaders(c, locale);
  return c.html(
    <NotFoundPage
      locale={locale}
      dict={dict}
      pageTitle={dict.seo?.notFoundTitle ?? "Page Not Found - AstroGroot"}
      pageDescription={dict.seo?.notFoundDescription ?? "The requested page could not be found."}
      canonicalUrl={canonicalUrl}
      alternateUrls={alternateUrls}
    />,
    404,
  );
});

app.post("/api/mcp", async (c) => {
  try {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch (error) {
      const response = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
          data: INCLUDE_ERROR_DATA ? String(error) : undefined,
        },
      };
      return c.json(response, 400);
    }

    const response = await handleMCPRequest(body);
    if (response === null) {
      return c.body(null, 202);
    }
    return c.json(response, 200);
  } catch (error) {
    const response = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: "Internal error",
        data: INCLUDE_ERROR_DATA ? String(error) : undefined,
      },
    };
    return c.json(response, 500);
  }
});

// 404
app.notFound(async (c) => {
  const locale = getLocaleFromRequest(
    c.req.query("lang"),
    c.req.header("Accept-Language"),
  );
  const dict = await loadDictionary(locale);
  const canonicalUrl = buildCanonicalUrl(c.req.url);
  const alternateUrls = buildAlternateUrls(c.req.url);
  setHtmlHeaders(c, locale);
  return c.html(
    <NotFoundPage
      locale={locale}
      dict={dict}
      pageTitle={dict.seo?.notFoundTitle ?? "Page Not Found - AstroGroot"}
      pageDescription={dict.seo?.notFoundDescription ?? "The requested page could not be found."}
      canonicalUrl={canonicalUrl}
      alternateUrls={alternateUrls}
    />,
    404,
  );
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
