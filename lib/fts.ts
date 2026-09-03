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

/** Ensure FTS5 virtual tables exist and backfill any rows missing from them. */
export async function ensureFtsTables(client: Client): Promise<void> {
  await client.execute(CREATE_PAPERS_FTS);
  await client.execute(CREATE_VIDEOS_FTS);
  await client.execute(CREATE_NASA_FTS);
  await client.execute(CREATE_TRANSLATIONS_FTS);

  // Backfill anything the index is missing. This used to run only when an FTS
  // table was completely empty, so a gap opened by failed incremental inserts
  // was never repaired. A correlated `WHERE NOT EXISTS` against an FTS5 table
  // has no usable index on its UNINDEXED id column, so on Turso it degenerates
  // into an unbounded cross-scan (8.5k papers x 7.2k fts rows = ~60M
  // comparisons) that never returns — confirmed hanging past 60s directly
  // against the source table. Diffing plain id lists in memory instead keeps
  // every round trip a simple single-column table scan.
  await backfillPapers(client);
  await backfillVideos(client);
  await backfillNasa(client);
  await backfillTranslations(client);
}

async function backfillPapers(client: Client): Promise<void> {
  const [source, indexed] = await Promise.all([
    client.execute("SELECT id FROM papers"),
    client.execute("SELECT doc_id FROM papers_fts"),
  ]);
  const have = new Set(indexed.rows.map((r) => String(r.doc_id)));
  const missingIds = source.rows.map((r) => String(r.id)).filter((id) => !have.has(id));
  if (missingIds.length === 0) return;
  console.log(`  \u{1f527} papers_fts: backfilling ${missingIds.length} missing row(s)`);
  await client.execute({
    sql: `INSERT INTO papers_fts(doc_id, title, abstract, summary)
          SELECT id, title, abstract, COALESCE(summary, '') FROM papers WHERE id IN (SELECT value FROM json_each(?))`,
    args: [JSON.stringify(missingIds)],
  });
}

async function backfillVideos(client: Client): Promise<void> {
  const [source, indexed] = await Promise.all([
    client.execute("SELECT id FROM videos"),
    client.execute("SELECT doc_id FROM videos_fts"),
  ]);
  const have = new Set(indexed.rows.map((r) => String(r.doc_id)));
  const missingIds = source.rows.map((r) => String(r.id)).filter((id) => !have.has(id));
  if (missingIds.length === 0) return;
  console.log(`  \u{1f527} videos_fts: backfilling ${missingIds.length} missing row(s)`);
  await client.execute({
    sql: `INSERT INTO videos_fts(doc_id, title, summary, description)
          SELECT id, title, COALESCE(summary, ''), COALESCE(description, '') FROM videos WHERE id IN (SELECT value FROM json_each(?))`,
    args: [JSON.stringify(missingIds)],
  });
}

async function backfillNasa(client: Client): Promise<void> {
  const [source, indexed] = await Promise.all([
    client.execute("SELECT id FROM nasa_content"),
    client.execute("SELECT doc_id FROM nasa_fts"),
  ]);
  const have = new Set(indexed.rows.map((r) => String(r.doc_id)));
  const missingIds = source.rows.map((r) => String(r.id)).filter((id) => !have.has(id));
  if (missingIds.length === 0) return;
  console.log(`  \u{1f527} nasa_fts: backfilling ${missingIds.length} missing row(s)`);
  await client.execute({
    sql: `INSERT INTO nasa_fts(doc_id, title, summary, explanation, description)
          SELECT id, title, COALESCE(summary, ''), COALESCE(explanation, ''), COALESCE(description, '') FROM nasa_content WHERE id IN (SELECT value FROM json_each(?))`,
    args: [JSON.stringify(missingIds)],
  });
}

async function backfillTranslations(client: Client): Promise<void> {
  const [source, indexed] = await Promise.all([
    client.execute("SELECT item_type, item_id, lang FROM translations"),
    client.execute("SELECT item_type, item_id, lang FROM translations_fts"),
  ]);
  const key = (item_type: unknown, item_id: unknown, lang: unknown) => `${item_type} ${item_id} ${lang}`;
  const have = new Set(indexed.rows.map((r) => key(r.item_type, r.item_id, r.lang)));
  const missing = source.rows.filter((r) => !have.has(key(r.item_type, r.item_id, r.lang)));
  if (missing.length === 0) return;
  console.log(`  \u{1f527} translations_fts: backfilling ${missing.length} missing row(s)`);
  // No composite key to match against with json_each, so insert row by row —
  // translations_fts rows should rarely go missing since every write comes
  // through ftsInsertTranslation right after the source insert.
  for (const row of missing) {
    const t = await client.execute({
      sql: "SELECT title, summary FROM translations WHERE item_type = ? AND item_id = ? AND lang = ?",
      args: [row.item_type as string, row.item_id as string, row.lang as string],
    });
    const t0 = t.rows[0];
    if (!t0) continue;
    await client.execute({
      sql: "INSERT INTO translations_fts(item_type, item_id, lang, title, summary) VALUES (?, ?, ?, ?, ?)",
      args: [row.item_type as string, row.item_id as string, row.lang as string, String(t0.title ?? ""), String(t0.summary ?? "")],
    });
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
