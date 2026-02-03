#!/usr/bin/env -S deno run --allow-all --env
/**
 * Reindex a single item by type + id.
 *
 * Usage:
 *   deno task reindex-one --type paper --id 2601.22121
 *   deno task reindex-one --type video --id <youtube_id>
 *   deno task reindex-one --type nasa --id <nasa_id>
 */
import { db } from "../db/client.ts";
import { papers, videos, nasaContent, translations } from "../db/schema.ts";
import { and, eq } from "drizzle-orm";
import { processMultilingualContent } from "../lib/ai/processor.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n.ts";
import { initializeCollections } from "../lib/vector.ts";

type ItemType = "paper" | "video" | "nasa";

const MAX_PAPER_TEXT = 50000;
const MAX_VIDEO_TEXT = 5000;
const MAX_NASA_TEXT = 5000;

function getArg(name: string): string | null {
  const index = Deno.args.indexOf(name);
  if (index === -1) return null;
  return Deno.args[index + 1] ?? null;
}

function snip(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) : text;
}

async function upsertTranslations(itemType: ItemType, itemId: string, items: {
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

async function reindexPaper(id: string) {
  const row = await db.query.papers.findFirst({ where: eq(papers.id, id) });
  if (!row) throw new Error(`Paper ${id} not found`);
  const text = snip(row.abstract, MAX_PAPER_TEXT);
  if (!text) throw new Error(`Paper ${id} has no abstract`);
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

  const collections = await initializeCollections();
  for (const t of trans) {
    const locale = t.lang as typeof SUPPORTED_LOCALES[number];
    if (!SUPPORTED_LOCALES.includes(locale)) continue;
    await collections.papers[locale].add({
      id: row.id,
      text: `${t.title}\n\n${t.summary}\n\n${text}`,
      metadata: {
        title: t.title,
        published: row.publishedDate ? new Date(row.publishedDate).toISOString() : undefined,
        categories: row.categories,
      },
    });
  }
}

async function reindexVideo(id: string) {
  const row = await db.query.videos.findFirst({ where: eq(videos.id, id) });
  if (!row) throw new Error(`Video ${id} not found`);
  const sourceText = row.transcript || row.description || "";
  const text = snip(sourceText, MAX_VIDEO_TEXT);
  if (!text) throw new Error(`Video ${id} has no transcript/description`);
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

  const collections = await initializeCollections();
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
}

async function reindexNasa(id: string) {
  const row = await db.query.nasaContent.findFirst({ where: eq(nasaContent.id, id) });
  if (!row) throw new Error(`NASA ${id} not found`);
  const sourceText = row.explanation || row.description || "";
  const text = snip(sourceText, MAX_NASA_TEXT);
  if (!text) throw new Error(`NASA ${id} has no explanation/description`);
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

  const collections = await initializeCollections();
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
}

async function main() {
  const type = (getArg("--type") || getArg("-t")) as ItemType | null;
  const id = getArg("--id") || getArg("-i");
  if (!type || !id) {
    console.error("Usage: deno task reindex-one --type <paper|video|nasa> --id <id>");
    Deno.exit(1);
  }

  console.log(`Reindexing ${type} ${id}...`);
  if (type === "paper") await reindexPaper(id);
  else if (type === "video") await reindexVideo(id);
  else if (type === "nasa") await reindexNasa(id);
  else throw new Error(`Unsupported type: ${type}`);
  console.log("✅ Done");
}

await main();
