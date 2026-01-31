import { sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { papers, videos, nasaContent } from "../db/schema.ts";

export interface LibraryStats {
  papers: number;
  videos: number;
  nasa: number;
  total: number;
}

const ZERO: LibraryStats = { papers: 0, videos: 0, nasa: 0, total: 0 };

export async function getLibraryStats(): Promise<LibraryStats> {
  try {
    const [p] = await db
      .select({ count: sql<number>`count(*)` })
      .from(papers);
    const [v] = await db
      .select({ count: sql<number>`count(*)` })
      .from(videos);
    const [n] = await db
      .select({ count: sql<number>`count(*)` })
      .from(nasaContent);

    const papersCount = Number(p?.count ?? 0);
    const videosCount = Number(v?.count ?? 0);
    const nasaCount = Number(n?.count ?? 0);

    return {
      papers: papersCount,
      videos: videosCount,
      nasa: nasaCount,
      total: papersCount + videosCount + nasaCount,
    };
  } catch {
    return ZERO;
  }
}
