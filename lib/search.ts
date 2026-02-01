import { db } from "../db/client.ts";
import { papers, videos, nasaContent, translations } from "../db/schema.ts";
import { inArray, and, eq } from "drizzle-orm";
import { initializeCollections } from "./vector.ts";
import type { Locale } from "./i18n.ts";
import { SUPPORTED_LOCALES } from "./i18n.ts";

export type SearchType = "all" | "papers" | "videos" | "nasa";

export interface SearchResultItem {
  type: "paper" | "video" | "nasa";
  id: string;
  title: string;
  snippet?: string;
  score?: number;
  url?: string;
  publishedDate?: string;
  meta?: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  papers: SearchResultItem[];
  videos: SearchResultItem[];
  nasa: SearchResultItem[];
  total: number;
}

const DEFAULT_LIMIT = 20;
const PER_COLLECTION_LIMIT = 15;
const DEFAULT_LOCALE: Locale = "en";

/** Run vector search in the given locale's collections; then load full rows and localized title/snippet from DB. */
export async function searchLibrary(params: {
  q: string;
  type?: SearchType;
  limit?: number;
  locale?: Locale;
}): Promise<SearchResponse> {
  const { q, type = "all", limit = DEFAULT_LIMIT, locale: requestedLocale } = params;
  const locale = requestedLocale && SUPPORTED_LOCALES.includes(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE;

  const trimmed = q.trim();
  if (!trimmed) {
    return { query: trimmed, papers: [], videos: [], nasa: [], total: 0 };
  }

  const collections = await initializeCollections();
  const n = Math.min(PER_COLLECTION_LIMIT, Math.max(1, limit));
  const paperIds: string[] = [];
  const videoIds: string[] = [];
  const nasaIds: string[] = [];
  const paperScores: Record<string, number> = {};
  const videoScores: Record<string, number> = {};
  const nasaScores: Record<string, number> = {};

  const searchPapers = type === "all" || type === "papers";
  const searchVideos = type === "all" || type === "videos";
  const searchNasa = type === "all" || type === "nasa";

  const [paperRes, videoRes, nasaRes] = await Promise.all([
    searchPapers
      ? collections.papers[locale].query({ queryText: trimmed, nResults: n })
      : Promise.resolve({ ids: [[]], distances: [[]] }),
    searchVideos
      ? collections.videos[locale].query({ queryText: trimmed, nResults: n })
      : Promise.resolve({ ids: [[]], distances: [[]] }),
    searchNasa
      ? collections.nasa[locale].query({ queryText: trimmed, nResults: n })
      : Promise.resolve({ ids: [[]], distances: [[]] }),
  ]);

  if (searchPapers && paperRes.ids[0]?.length) {
    paperRes.ids[0].forEach((id, i) => {
      paperIds.push(id);
      const dist = paperRes.distances?.[0]?.[i];
      if (dist != null) paperScores[id] = 1 - dist / 2;
    });
  }
  if (searchVideos && videoRes.ids[0]?.length) {
    videoRes.ids[0].forEach((id, i) => {
      videoIds.push(id);
      const dist = videoRes.distances?.[0]?.[i];
      if (dist != null) videoScores[id] = 1 - dist / 2;
    });
  }
  if (searchNasa && nasaRes.ids[0]?.length) {
    nasaRes.ids[0].forEach((id, i) => {
      nasaIds.push(id);
      const dist = nasaRes.distances?.[0]?.[i];
      if (dist != null) nasaScores[id] = 1 - dist / 2;
    });
  }

  // Fallback: when using zh-TW/zh-CN and locale-specific collection has no docs, query English collection
  const hasNoResults = paperIds.length === 0 && videoIds.length === 0 && nasaIds.length === 0;
  if (locale !== "en" && hasNoResults) {
    const [enPaperRes, enVideoRes, enNasaRes] = await Promise.all([
      searchPapers ? collections.papers["en"].query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
      searchVideos ? collections.videos["en"].query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
      searchNasa ? collections.nasa["en"].query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
    ]);
    if (searchPapers && enPaperRes.ids[0]?.length) {
      enPaperRes.ids[0].forEach((id, i) => {
        paperIds.push(id);
        const dist = enPaperRes.distances?.[0]?.[i];
        if (dist != null) paperScores[id] = 1 - dist / 2;
      });
    }
    if (searchVideos && enVideoRes.ids[0]?.length) {
      enVideoRes.ids[0].forEach((id, i) => {
        videoIds.push(id);
        const dist = enVideoRes.distances?.[0]?.[i];
        if (dist != null) videoScores[id] = 1 - dist / 2;
      });
    }
    if (searchNasa && enNasaRes.ids[0]?.length) {
      enNasaRes.ids[0].forEach((id, i) => {
        nasaIds.push(id);
        const dist = enNasaRes.distances?.[0]?.[i];
        if (dist != null) nasaScores[id] = 1 - dist / 2;
      });
    }
  }

  const [paperRows, videoRows, nasaRows] = await Promise.all([
    paperIds.length
      ? db.query.papers.findMany({ where: inArray(papers.id, paperIds) })
      : [],
    videoIds.length
      ? db.query.videos.findMany({ where: inArray(videos.id, videoIds) })
      : [],
    nasaIds.length
      ? db.query.nasaContent.findMany({ where: inArray(nasaContent.id, nasaIds) })
      : [],
  ]);

  const orderByIds = <T extends { id: string }>(rows: T[], ids: string[]) => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is T => r != null);
  };

  const paperOrdered = orderByIds(paperRows, paperIds);
  const videoOrdered = orderByIds(videoRows, videoIds);
  const nasaOrdered = orderByIds(nasaRows, nasaIds);

  // Load localized title/summary from translations when not English
  const transByKey = new Map<string, { title: string | null; summary: string | null }>();
  if (locale !== "en" && (paperOrdered.length || videoOrdered.length || nasaOrdered.length)) {
    const allIds = [
      ...paperOrdered.map((r) => ({ type: "paper" as const, id: r.id })),
      ...videoOrdered.map((r) => ({ type: "video" as const, id: r.id })),
      ...nasaOrdered.map((r) => ({ type: "nasa" as const, id: r.id })),
    ];
    const transRows = await db.query.translations.findMany({
      where: and(
        eq(translations.lang, locale),
        inArray(
          translations.itemId,
          allIds.map((x) => x.id),
        ),
      ),
      columns: { itemType: true, itemId: true, title: true, summary: true },
    });
    for (const t of transRows) {
      transByKey.set(`${t.itemType}:${t.itemId}`, { title: t.title, summary: t.summary });
    }
  }

  const getTrans = (itemType: "paper" | "video" | "nasa", id: string) =>
    transByKey.get(`${itemType}:${id}`);

  const toPaperItem = (row: (typeof paperRows)[0]): SearchResultItem => {
    const trans = getTrans("paper", row.id);
    return {
      type: "paper",
      id: row.id,
      title: (trans?.title ?? row.title) || row.title,
      snippet: (trans?.summary ?? row.summary ?? row.abstract?.slice(0, 200)) ?? undefined,
      score: paperScores[row.id],
      url: row.arxivUrl ?? row.pdfUrl ?? undefined,
      publishedDate: row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined,
      meta: { authors: row.authors, categories: row.categories },
    };
  };
  const toVideoItem = (row: (typeof videoRows)[0]): SearchResultItem => {
    const trans = getTrans("video", row.id);
    return {
      type: "video",
      id: row.id,
      title: (trans?.title ?? row.title) || row.title,
      snippet: (trans?.summary ?? row.summary ?? row.description?.slice(0, 200)) ?? undefined,
      score: videoScores[row.id],
      url: row.videoUrl,
      publishedDate: row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined,
      meta: { channelName: row.channelName },
    };
  };
  const toNasaItem = (row: (typeof nasaRows)[0]): SearchResultItem => {
    const trans = getTrans("nasa", row.id);
    return {
      type: "nasa",
      id: row.id,
      title: (trans?.title ?? row.title) || row.title,
      snippet: (trans?.summary ?? row.summary ?? row.explanation ?? row.description?.slice(0, 200)) ?? undefined,
      score: nasaScores[row.id],
      url: row.url,
      publishedDate: row.date ? new Date(row.date).toISOString().slice(0, 10) : undefined,
      meta: { contentType: row.contentType },
    };
  };

  return {
    query: trimmed,
    papers: paperOrdered.map(toPaperItem),
    videos: videoOrdered.map(toVideoItem),
    nasa: nasaOrdered.map(toNasaItem),
    total: paperOrdered.length + videoOrdered.length + nasaOrdered.length,
  };
}
