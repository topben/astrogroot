#!/usr/bin/env -S deno run --allow-all --env
/**
 * Purge off-topic arXiv papers from the library, per lib/relevance.ts.
 *
 * Dry run (default): classifies every paper, writes the candidate list to
 * a report file, deletes nothing.
 *
 *   deno run --allow-all --env scripts/purge-offtopic.ts
 *
 * Apply (destructive): backs up doomed papers+translations to a JSON file,
 * then deletes from papers, translations, FTS tables, and ChromaDB.
 *
 *   deno run --allow-all --env scripts/purge-offtopic.ts --apply
 *
 * NTRS reports, videos, and NASA content are never touched - NTRS queries
 * are already keyword-targeted, and the other two aren't part of this
 * classifier's scope.
 */
import { db } from "../db/client.ts";
import { papers, translations } from "../db/schema.ts";
import { eq, inArray, and, sql } from "drizzle-orm";
import { classifyPaper } from "../lib/relevance.ts";
import { initializeCollections } from "../lib/vector.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n.ts";

const BATCH_SIZE = 200;
const REPORT_PATH = "./purge-offtopic-report.json";
const BACKUP_PATH = "./purge-offtopic-backup.json";

interface Candidate {
  id: string;
  title: string;
  categories: string[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function findCandidates(): Promise<{ candidates: Candidate[]; total: number }> {
  const rows = await db
    .select({ id: papers.id, title: papers.title, abstract: papers.abstract, categories: papers.categories })
    .from(papers);

  // NTRS reports use NASA subject categories, not arXiv codes, and are
  // already collected via keyword-targeted queries - out of scope here.
  const arxivRows = rows.filter((r) => !r.id.startsWith("ntrs-"));

  const candidates: Candidate[] = [];
  for (const row of arxivRows) {
    let categories: string[] = [];
    try {
      categories = JSON.parse(row.categories || "[]");
    } catch {
      categories = [];
    }
    const result = classifyPaper({ title: row.title, abstract: row.abstract, categories });
    if (!result.keep) {
      candidates.push({ id: row.id, title: row.title, categories });
    }
  }

  return { candidates, total: arxivRows.length };
}

async function writeDryRunReport(candidates: Candidate[], total: number): Promise<void> {
  const report = {
    generatedAt: new Date().toISOString(),
    totalArxivPapers: total,
    candidateCount: candidates.length,
    keepCount: total - candidates.length,
    candidates,
  };
  await Deno.writeTextFile(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log("=".repeat(60));
  console.log("DRY RUN - nothing was deleted");
  console.log("=".repeat(60));
  console.log(`Total arXiv papers:  ${total}`);
  console.log(`Off-topic (purge):   ${candidates.length} (${(candidates.length / total * 100).toFixed(1)}%)`);
  console.log(`On-topic (keep):     ${total - candidates.length} (${((total - candidates.length) / total * 100).toFixed(1)}%)`);
  console.log(`\nFull candidate list written to: ${REPORT_PATH}`);
  console.log(`\nReview it, then re-run with --apply to delete.`);
}

async function backupDoomedRows(ids: string[]): Promise<void> {
  const paperRows: unknown[] = [];
  const translationRows: unknown[] = [];

  for (const batch of chunk(ids, BATCH_SIZE)) {
    paperRows.push(...(await db.select().from(papers).where(inArray(papers.id, batch))));
    translationRows.push(
      ...(await db
        .select()
        .from(translations)
        .where(and(eq(translations.itemType, "paper"), inArray(translations.itemId, batch)))),
    );
  }

  await Deno.writeTextFile(
    BACKUP_PATH,
    JSON.stringify({ backedUpAt: new Date().toISOString(), papers: paperRows, translations: translationRows }, null, 2),
  );
  console.log(`Backup written: ${BACKUP_PATH} (${paperRows.length} papers, ${translationRows.length} translations)`);
}

async function deleteFromSql(ids: string[]): Promise<void> {
  // Route every statement through the Drizzle `db` object (never the raw
  // libsql `client` directly) - mixing the two on the same connection
  // triggers an internal @libsql/client HTTP-transport bug
  // ("Cannot read private member #promiseLimitFunction...").
  //
  // FTS deletes are wrapped separately and tolerantly: the FTS tables are a
  // derived search index (not primary data) and are rebuilt wholesale by
  // ensureFtsTables()'s backfill after the core purge completes, so a
  // missing/errored FTS table here must never block the papers/translations
  // delete, which IS primary data.
  for (const batch of chunk(ids, BATCH_SIZE)) {
    await db.delete(translations).where(and(eq(translations.itemType, "paper"), inArray(translations.itemId, batch)));
    await db.delete(papers).where(inArray(papers.id, batch));

    try {
      const idList = sql.join(batch.map((id) => sql`${id}`), sql`, `);
      await db.run(sql`DELETE FROM papers_fts WHERE doc_id IN (${idList})`);
      await db.run(sql`DELETE FROM translations_fts WHERE item_type = 'paper' AND item_id IN (${idList})`);
    } catch (error) {
      console.warn(`  ⚠️  FTS delete failed for this batch (non-fatal, FTS is rebuilt after purge): ${error}`);
    }
  }
  console.log(`Deleted from papers and translations (FTS rebuilt separately after purge).`);
}

async function deleteFromChroma(ids: string[]): Promise<void> {
  const collections = await initializeCollections();
  let deleted = 0;
  let skipped = 0;

  for (const id of ids) {
    for (const locale of SUPPORTED_LOCALES) {
      try {
        await collections.papers[locale].delete(id);
        deleted++;
      } catch {
        // id may not exist in this locale's collection (e.g. never indexed) - non-fatal
        skipped++;
      }
    }
  }
  console.log(`ChromaDB: ${deleted} deletes ok, ${skipped} not found/skipped (across ${SUPPORTED_LOCALES.length} locales).`);
}

async function main() {
  const apply = Deno.args.includes("--apply");

  console.log("Classifying arXiv papers against lib/relevance.ts...");
  const { candidates, total } = await findCandidates();

  if (!apply) {
    await writeDryRunReport(candidates, total);
    return;
  }

  if (candidates.length === 0) {
    console.log("No off-topic papers found. Nothing to purge.");
    return;
  }

  const ids = candidates.map((c) => c.id);

  console.log(`\nApplying purge: ${ids.length} off-topic papers of ${total} total.`);
  await backupDoomedRows(ids);
  await deleteFromSql(ids);
  await deleteFromChroma(ids);

  const remaining = await db.select({ count: sql<number>`count(*)` }).from(papers);
  console.log(`\n✅ Purge complete. papers table now has ${remaining[0]?.count ?? "?"} rows.`);
  console.log(`Backup saved at ${BACKUP_PATH} if you need to restore.`);
}

await main();
