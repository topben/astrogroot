import { db } from "../db/client.ts";
import { papers, videos, nasaContent } from "../db/schema.ts";
import { inArray } from "drizzle-orm";
import { initializeCollections } from "./vector.ts";

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

/** Run vector search across papers, videos, and NASA content; then load full rows from DB. */
export async function searchLibrary(params: {
  q: string;
  type?: SearchType;
  limit?: number;
}): Promise<SearchResponse> {
  const { q, type = "all", limit = DEFAULT_LIMIT } = params;
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
      ? collections.papers.query({ queryText: trimmed, nResults: n })
      : Promise.resolve({ ids: [[]], distances: [[]] }),
    searchVideos
      ? collections.videos.query({ queryText: trimmed, nResults: n })
      : Promise.resolve({ ids: [[]], distances: [[]] }),
    searchNasa
      ? collections.nasa.query({ queryText: trimmed, nResults: n })
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

  const toPaperItem = (row: typeof paperRows[0]): SearchResultItem => ({
    type: "paper",
    id: row.id,
    title: row.title,
    snippet: row.summary ?? row.abstract?.slice(0, 200),
    score: paperScores[row.id],
    url: row.arxivUrl ?? row.pdfUrl ?? undefined,
    publishedDate: row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined,
    meta: { authors: row.authors, categories: row.categories },
  });
  const toVideoItem = (row: typeof videoRows[0]): SearchResultItem => ({
    type: "video",
    id: row.id,
    title: row.title,
    snippet: row.summary ?? row.description?.slice(0, 200),
    score: videoScores[row.id],
    url: row.videoUrl,
    publishedDate: row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined,
    meta: { channelName: row.channelName },
  });
  const toNasaItem = (row: typeof nasaRows[0]): SearchResultItem => ({
    type: "nasa",
    id: row.id,
    title: row.title,
    snippet: row.summary ?? row.explanation ?? row.description?.slice(0, 200),
    score: nasaScores[row.id],
    url: row.url,
    publishedDate: row.date ? new Date(row.date).toISOString().slice(0, 10) : undefined,
    meta: { contentType: row.contentType },
  });

  return {
    query: trimmed,
    papers: paperOrdered.map(toPaperItem),
    videos: videoOrdered.map(toVideoItem),
    nasa: nasaOrdered.map(toNasaItem),
    total: paperOrdered.length + videoOrdered.length + nasaOrdered.length,
  };
}
