import type { Client } from "@libsql/client";

// FTS5 table creation SQL
const CREATE_PAPERS_FTS = `CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
  doc_id UNINDEXED, title, abstract, summary
)`;
const CREATE_VIDEOS_FTS = `CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
  doc_id UNINDEXED, title, summary, description
)`;
const CREATE_NASA_FTS = `CREATE VIRTUAL TABLE IF NOT EXISTS nasa_fts USING fts5(
  doc_id UNINDEXED, title, summary, explanation, description
)`;
const CREATE_TRANSLATIONS_FTS = `CREATE VIRTUAL TABLE IF NOT EXISTS translations_fts USING fts5(
  item_type UNINDEXED, item_id UNINDEXED, lang UNINDEXED,
  title, summary
)`;

/** Ensure FTS5 virtual tables exist and backfill from source tables if empty. */
export async function ensureFtsTables(client: Client): Promise<void> {
  await client.execute(CREATE_PAPERS_FTS);
  await client.execute(CREATE_VIDEOS_FTS);
  await client.execute(CREATE_NASA_FTS);
  await client.execute(CREATE_TRANSLATIONS_FTS);

  // Backfill from source tables if FTS tables are empty
  const [papersCount, videosCount, nasaCount, transCount] = await Promise.all([
    client.execute("SELECT COUNT(*) as cnt FROM papers_fts"),
    client.execute("SELECT COUNT(*) as cnt FROM videos_fts"),
    client.execute("SELECT COUNT(*) as cnt FROM nasa_fts"),
    client.execute("SELECT COUNT(*) as cnt FROM translations_fts"),
  ]);

  if (Number(papersCount.rows[0]?.cnt) === 0) {
    await client.execute(
      "INSERT INTO papers_fts(doc_id, title, abstract, summary) SELECT id, title, abstract, COALESCE(summary, '') FROM papers",
    );
  }
  if (Number(videosCount.rows[0]?.cnt) === 0) {
    await client.execute(
      "INSERT INTO videos_fts(doc_id, title, summary, description) SELECT id, title, COALESCE(summary, ''), COALESCE(description, '') FROM videos",
    );
  }
  if (Number(nasaCount.rows[0]?.cnt) === 0) {
    await client.execute(
      "INSERT INTO nasa_fts(doc_id, title, summary, explanation, description) SELECT id, title, COALESCE(summary, ''), COALESCE(explanation, ''), COALESCE(description, '') FROM nasa_content",
    );
  }
  if (Number(transCount.rows[0]?.cnt) === 0) {
    await client.execute(
      "INSERT INTO translations_fts(item_type, item_id, lang, title, summary) SELECT item_type, item_id, lang, COALESCE(title, ''), COALESCE(summary, '') FROM translations",
    );
  }
}

/** Insert a paper into the FTS index. */
export async function ftsInsertPaper(
  client: Client,
  data: { id: string; title: string; abstract: string; summary: string },
): Promise<void> {
  await client.execute({
    sql: "INSERT INTO papers_fts(doc_id, title, abstract, summary) VALUES (?, ?, ?, ?)",
    args: [data.id, data.title, data.abstract, data.summary],
  });
}

/** Insert a video into the FTS index. */
export async function ftsInsertVideo(
  client: Client,
  data: { id: string; title: string; summary: string; description: string },
): Promise<void> {
  await client.execute({
    sql: "INSERT INTO videos_fts(doc_id, title, summary, description) VALUES (?, ?, ?, ?)",
    args: [data.id, data.title, data.summary, data.description],
  });
}

/** Insert a NASA content item into the FTS index. */
export async function ftsInsertNasa(
  client: Client,
  data: { id: string; title: string; summary: string; explanation: string; description: string },
): Promise<void> {
  await client.execute({
    sql: "INSERT INTO nasa_fts(doc_id, title, summary, explanation, description) VALUES (?, ?, ?, ?, ?)",
    args: [data.id, data.title, data.summary, data.explanation, data.description],
  });
}

/** Insert a translation into the FTS index. */
export async function ftsInsertTranslation(
  client: Client,
  data: { itemType: string; itemId: string; lang: string; title: string; summary: string },
): Promise<void> {
  await client.execute({
    sql: "INSERT INTO translations_fts(item_type, item_id, lang, title, summary) VALUES (?, ?, ?, ?, ?)",
    args: [data.itemType, data.itemId, data.lang, data.title, data.summary],
  });
}

/** Escape user input for safe use in FTS5 MATCH expressions. */
export function escapeFtsQuery(query: string): string {
  // Remove FTS5 special operators and wrap each term in double quotes
  return query
    .replace(/['"*(){}[\]:^~@#$\\]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"`)
    .join(" OR ");
}

export interface FtsResult {
  id: string;
  score: number;
}

/**
 * Search an FTS5 table, returning doc IDs with normalized BM25 scores.
 * Score is normalized to the 0.5–0.9 range.
 */
export async function ftsSearch(
  client: Client,
  table: "papers_fts" | "videos_fts" | "nasa_fts" | "translations_fts",
  query: string,
  limit: number,
): Promise<FtsResult[]> {
  const escaped = escapeFtsQuery(query);
  if (!escaped) return [];

  const idCol = table === "translations_fts" ? "item_id" : "doc_id";

  const result = await client.execute({
    sql: `SELECT ${idCol} as id, rank FROM ${table} WHERE ${table} MATCH ? ORDER BY rank LIMIT ?`,
    args: [escaped, limit],
  });

  if (result.rows.length === 0) return [];

  // BM25 rank values are negative (more negative = better match)
  const ranks = result.rows.map((r) => Math.abs(Number(r.rank)));
  const maxRank = Math.max(...ranks);

  return result.rows.map((row, i) => ({
    id: String(row.id),
    // Normalize: best match → 0.9, worst → 0.5
    score: maxRank > 0
      ? 0.5 + 0.4 * (ranks[i] / maxRank)
      : 0.7,
  }));
}
