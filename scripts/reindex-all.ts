#!/usr/bin/env -S deno run --allow-all --env
/**
 * Rebuild summaries/translations and reindex ChromaDB for all content.
 *
 * Usage:
 *   deno task reindex-all
 */
import { db } from "../db/client.ts";
import { papers, videos, nasaContent, translations } from "../db/schema.ts";
import { and, eq } from "drizzle-orm";
import { processMultilingualContent } from "../lib/ai/processor.ts";
import {
  chromaClient,
  getCollectionName,
  LEGACY_COLLECTIONS,
  initializeCollections,
} from "../lib/vector.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n.ts";

const MAX_VIDEO_TEXT = 5000;
const MAX_NASA_TEXT = 5000;
const MAX_PAPER_TEXT = 50000;

function safeParseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function snip(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) : text;
}

async function resetCollections() {
  const names: string[] = [];
  for (const locale of SUPPORTED_LOCALES) {
    names.push(getCollectionName("PAPERS", locale));
    names.push(getCollectionName("VIDEOS", locale));
    names.push(getCollectionName("NASA", locale));
  }
  names.push(LEGACY_COLLECTIONS.PAPERS, LEGACY_COLLECTIONS.VIDEOS, LEGACY_COLLECTIONS.NASA);

  for (const name of names) {
    try {
      await chromaClient.deleteCollection({ name });
      console.log(`🗑️  Deleted collection ${name}`);
    } catch (error) {
      const message = String(error ?? "");
      if (!message.toLowerCase().includes("not found")) {
        console.warn(`⚠️  Failed to delete collection ${name}:`, error);
      }
    }
  }
}

async function upsertTranslations(itemType: "paper" | "video" | "nasa", itemId: string, items: {
  lang: string;
  title: string;
  summary: string;
}[]) {
  await db.delete(translations).where(and(eq(translations.itemType, itemType), eq(translations.itemId, itemId)));
  for (const t of items) {
    await db.insert(translations).values({
      itemType,
      itemId,
      lang: t.lang,
      title: t.title,
      summary: t.summary,
    });
  }
}

async function main() {
  console.log("============================================================");
  console.log("AstroGroot Full Reindex Script");
  console.log("============================================================");
  console.log("This will regenerate summaries/translations and rebuild vectors.");

  console.log("\n🧹 Resetting ChromaDB collections...");
  await resetCollections();

  const collections = await initializeCollections();

  const paperRows = await db.query.papers.findMany();
  const videoRows = await db.query.videos.findMany();
  const nasaRows = await db.query.nasaContent.findMany();

  console.log(`\n📚 Papers: ${paperRows.length}`);
  console.log(`🎥 Videos: ${videoRows.length}`);
  console.log(`🚀 NASA: ${nasaRows.length}`);

  let processed = 0;

  for (const row of paperRows) {
    const text = snip(row.abstract, MAX_PAPER_TEXT);
    if (!text) {
      console.warn(`⚠️  Paper ${row.id} has no abstract, skipping`);
      continue;
    }
    console.log(`\n📄 Reindexing paper ${row.id}: ${row.title.substring(0, 60)}...`);
    const { baseSummary, translations: trans } = await processMultilingualContent({
      text,
      title: row.title,
      sourceType: "paper",
    });

    await db.update(papers).set({
      summary: baseSummary,
      processed: true,
      vectorId: row.id,
      updatedAt: new Date(),
    }).where(eq(papers.id, row.id));

    await upsertTranslations("paper", row.id, trans);

    const categories = safeParseJsonArray(row.categories).join(", ");
    for (const t of trans) {
      const locale = t.lang as typeof SUPPORTED_LOCALES[number];
      if (!SUPPORTED_LOCALES.includes(locale)) continue;
      await collections.papers[locale].add({
        id: row.id,
        text: `${t.title}\n\n${t.summary}\n\n${text}`,
        metadata: {
          title: t.title,
          published: row.publishedDate ? new Date(row.publishedDate).toISOString() : undefined,
          categories,
        },
      });
    }
    processed++;
  }

  for (const row of videoRows) {
    const sourceText = row.transcript || row.description || "";
    const text = snip(sourceText, MAX_VIDEO_TEXT);
    if (!text) {
      console.warn(`⚠️  Video ${row.id} has no transcript/description, skipping`);
      continue;
    }
    console.log(`\n🎥 Reindexing video ${row.id}: ${row.title.substring(0, 60)}...`);
    const { baseSummary, translations: trans } = await processMultilingualContent({
      text: sourceText,
      title: row.title,
      sourceType: "video",
    });

    await db.update(videos).set({
      summary: baseSummary,
      processed: true,
      vectorId: row.id,
      updatedAt: new Date(),
    }).where(eq(videos.id, row.id));

    await upsertTranslations("video", row.id, trans);

    for (const t of trans) {
      const locale = t.lang as typeof SUPPORTED_LOCALES[number];
      if (!SUPPORTED_LOCALES.includes(locale)) continue;
      await collections.videos[locale].add({
        id: row.id,
        text: `${t.title}\n\n${t.summary}\n\n${text}`,
        metadata: {
          title: t.title,
          published: row.publishedDate ? new Date(row.publishedDate).toISOString() : undefined,
          channel: row.channelName,
        },
      });
    }
    processed++;
  }

  for (const row of nasaRows) {
    const sourceText = row.explanation || row.description || "";
    const text = snip(sourceText, MAX_NASA_TEXT);
    if (!text) {
      console.warn(`⚠️  NASA ${row.id} has no explanation/description, skipping`);
      continue;
    }
    console.log(`\n🚀 Reindexing NASA ${row.id}: ${row.title.substring(0, 60)}...`);
    const { baseSummary, translations: trans } = await processMultilingualContent({
      text: sourceText,
      title: row.title,
      sourceType: "article",
    });

    await db.update(nasaContent).set({
      summary: baseSummary,
      processed: true,
      vectorId: row.id,
      updatedAt: new Date(),
    }).where(eq(nasaContent.id, row.id));

    await upsertTranslations("nasa", row.id, trans);

    for (const t of trans) {
      const locale = t.lang as typeof SUPPORTED_LOCALES[number];
      if (!SUPPORTED_LOCALES.includes(locale)) continue;
      await collections.nasa[locale].add({
        id: row.id,
        text: `${t.title}\n\n${t.summary}\n\n${text}`,
        metadata: {
          title: t.title,
          date: row.date ? new Date(row.date).toISOString() : undefined,
          contentType: row.contentType,
        },
      });
    }
    processed++;
  }

  console.log("\n============================================================");
  console.log("✅ Reindex complete");
  console.log(`Processed items: ${processed}`);
  console.log("============================================================");
}

await main();
