import { db } from "../db/client.ts";
import { papers, videos, nasaContent, translations } from "../db/schema.ts";
import { inArray, and, eq } from "drizzle-orm";
import { initializeCollections, initializeLegacyCollections } from "./vector.ts";
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

export interface SearchDeps {
  db?: typeof db;
  initializeCollections?: typeof initializeCollections;
  initializeLegacyCollections?: typeof initializeLegacyCollections;
}

/** Run vector search in the given locale's collections; then load full rows and localized title/snippet from DB. */
export async function searchLibrary(params: {
  q: string;
  type?: SearchType;
  limit?: number;
  locale?: Locale;
  dateFrom?: string;
  dateTo?: string;
}, deps?: SearchDeps): Promise<SearchResponse> {
  const { q, type = "all", limit = DEFAULT_LIMIT, locale: requestedLocale, dateFrom, dateTo } =
    params;
  // Video and NASA search now enabled in all environments
  // (previously disabled in production when ChromaDB collections were empty)
  const db_ = deps?.db ?? db;
  const initializeCollections_ = deps?.initializeCollections ?? initializeCollections;
  const initializeLegacyCollections_ = deps?.initializeLegacyCollections ?? initializeLegacyCollections;
  const locale = requestedLocale && SUPPORTED_LOCALES.includes(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE;

  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const normalizedDateFrom = dateFrom && dateOnlyPattern.test(dateFrom) ? dateFrom : undefined;
  const normalizedDateTo = dateTo && dateOnlyPattern.test(dateTo) ? dateTo : undefined;

  const trimmed = q.trim();
  if (!trimmed) {
    return { query: trimmed, papers: [], videos: [], nasa: [], total: 0 };
  }

  const searchPapers = type === "all" || type === "papers";
  const searchVideos = type === "all" || type === "videos";
  const searchNasa = type === "all" || type === "nasa";

  if (!searchPapers && !searchVideos && !searchNasa) {
    return { query: trimmed, papers: [], videos: [], nasa: [], total: 0 };
  }

  const collections = await initializeCollections_();
  const n = Math.min(PER_COLLECTION_LIMIT, Math.max(1, limit));
  const paperIds: string[] = [];
  const videoIds: string[] = [];
  const nasaIds: string[] = [];
  const paperScores: Record<string, number> = {};
  const videoScores: Record<string, number> = {};
  const nasaScores: Record<string, number> = {};

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

  // Fallback 1: when using zh-TW/zh-CN and locale-specific collection has no docs, query English collection
  let hasNoResults = paperIds.length === 0 && videoIds.length === 0 && nasaIds.length === 0;
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

  // Fallback 2: query legacy collections (pre-i18n) if still no results
  hasNoResults = paperIds.length === 0 && videoIds.length === 0 && nasaIds.length === 0;
  if (hasNoResults) {
    const legacy = await initializeLegacyCollections_();
    const [legacyPaperRes, legacyVideoRes, legacyNasaRes] = await Promise.all([
      searchPapers ? legacy.papers.query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
      searchVideos ? legacy.videos.query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
      searchNasa ? legacy.nasa.query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
    ]);
    if (searchPapers && legacyPaperRes.ids[0]?.length) {
      legacyPaperRes.ids[0].forEach((id, i) => {
        paperIds.push(id);
        const dist = legacyPaperRes.distances?.[0]?.[i];
        if (dist != null) paperScores[id] = 1 - dist / 2;
      });
    }
    if (searchVideos && legacyVideoRes.ids[0]?.length) {
      legacyVideoRes.ids[0].forEach((id, i) => {
        videoIds.push(id);
        const dist = legacyVideoRes.distances?.[0]?.[i];
        if (dist != null) videoScores[id] = 1 - dist / 2;
      });
    }
    if (searchNasa && legacyNasaRes.ids[0]?.length) {
      legacyNasaRes.ids[0].forEach((id, i) => {
        nasaIds.push(id);
        const dist = legacyNasaRes.distances?.[0]?.[i];
        if (dist != null) nasaScores[id] = 1 - dist / 2;
      });
    }
  }

  const [paperRows, videoRows, nasaRows] = await Promise.all([
    paperIds.length
      ? db_.query.papers.findMany({ where: inArray(papers.id, paperIds) })
      : [],
    videoIds.length
      ? db_.query.videos.findMany({ where: inArray(videos.id, videoIds) })
      : [],
    nasaIds.length
      ? db_.query.nasaContent.findMany({ where: inArray(nasaContent.id, nasaIds) })
      : [],
  ]);

  const orderByIds = <T extends { id: string }>(rows: T[], ids: string[]) => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is T => r != null);
  };

  const paperOrdered = orderByIds(paperRows, paperIds);
  const videoOrdered = orderByIds(videoRows, videoIds);
  const nasaOrdered = orderByIds(nasaRows, nasaIds);

  const toDateOnly = (value: Date | string | null | undefined): string | null => {
    if (!value) return null;
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  };

  const inDateRange = (dateOnly: string | null): boolean => {
    if (!normalizedDateFrom && !normalizedDateTo) return true;
    if (!dateOnly) return false;
    if (normalizedDateFrom && dateOnly < normalizedDateFrom) return false;
    if (normalizedDateTo && dateOnly > normalizedDateTo) return false;
    return true;
  };

  const filteredPapers = paperOrdered.filter((row) =>
    inDateRange(toDateOnly(row.publishedDate))
  );
  const filteredVideos = videoOrdered.filter((row) =>
    inDateRange(toDateOnly(row.publishedDate))
  );
  const filteredNasa = nasaOrdered.filter((row) => inDateRange(toDateOnly(row.date)));

  // Load localized title/summary from translations when not English
  const transByKey = new Map<string, { title: string | null; summary: string | null }>();
  if (locale !== "en" && (filteredPapers.length || filteredVideos.length || filteredNasa.length)) {
    const allIds = [
      ...filteredPapers.map((r) => ({ type: "paper" as const, id: r.id })),
      ...filteredVideos.map((r) => ({ type: "video" as const, id: r.id })),
      ...filteredNasa.map((r) => ({ type: "nasa" as const, id: r.id })),
    ];
    const transRows = await db_.query.translations.findMany({
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

  const tokenizeQuery = (query: string): string[] => {
    const lower = query.toLowerCase();
    if (/[\u4e00-\u9fff]/.test(lower)) {
      return [lower];
    }
    return lower.split(/[^a-z0-9]+/i).filter((term) => term.length >= 2);
  };

  const computeKeywordScore = (text: string, terms: string[]): number => {
    if (terms.length === 0) return 0;
    const hits = terms.filter((term) => text.includes(term)).length;
    return hits / terms.length;
  };

  const rerank = (items: SearchResultItem[]): SearchResultItem[] => {
    const terms = tokenizeQuery(trimmed);
    return items
      .map((item, index) => {
        const baseScore = Math.max(0, Math.min(1, item.score ?? 0));
        const haystack = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
        const keywordScore = computeKeywordScore(haystack, terms);
        const combined = terms.length ? baseScore * 0.7 + keywordScore * 0.3 : baseScore;
        return { item: { ...item, score: combined }, index, combined };
      })
      .sort((a, b) => (b.combined - a.combined) || (a.index - b.index))
      .map((entry) => entry.item);
  };

  const paperItems = rerank(filteredPapers.map(toPaperItem));
  const videoItems = rerank(filteredVideos.map(toVideoItem));
  const nasaItems = rerank(filteredNasa.map(toNasaItem));

  return {
    query: trimmed,
    papers: paperItems,
    videos: videoItems,
    nasa: nasaItems,
    total: paperItems.length + videoItems.length + nasaItems.length,
  };
}
