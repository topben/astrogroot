#!/usr/bin/env -S deno run --allow-all --env

/**
 * Rebuild ChromaDB vectors from existing Turso database.
 * This script does NOT call AI APIs - it uses existing translations.
 *
 * Usage:
 *   deno task rebuild-vectors
 *
 * Or directly:
 *   deno run --allow-all --env scripts/rebuild-vectors.ts
 */

import { db } from "../db/client.ts";
import { papers, videos, nasaContent, translations } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import { initializeCollections, type CollectionsByLocale } from "../lib/vector.ts";
import type { Locale } from "../lib/i18n.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n.ts";

interface RebuildStats {
  papers: number;
  videos: number;
  nasa: number;
  errors: string[];
}

async function getTranslationsForItem(
  itemType: "paper" | "video" | "nasa",
  itemId: string,
): Promise<Map<Locale, { title: string; summary: string }>> {
  const trans = await db.query.translations.findMany({
    where: eq(translations.itemId, itemId),
  });

  const result = new Map<Locale, { title: string; summary: string }>();
  for (const t of trans) {
    if (SUPPORTED_LOCALES.includes(t.lang as Locale)) {
      result.set(t.lang as Locale, {
        title: t.title,
        summary: t.summary,
      });
    }
  }
  return result;
}

async function rebuildPaperVectors(
  collections: { papers: CollectionsByLocale },
  stats: RebuildStats,
): Promise<void> {
  console.log("\n📄 Rebuilding paper vectors...");

  const allPapers = await db.select().from(papers);
  console.log(`  Found ${allPapers.length} papers in database`);

  for (const paper of allPapers) {
    try {
      const trans = await getTranslationsForItem("paper", paper.id);

      if (trans.size === 0) {
        // No translations - use original English content for all locales
        for (const locale of SUPPORTED_LOCALES) {
          await collections.papers[locale].add({
            id: paper.id,
            text: `${paper.title}\n\n${paper.summary || ""}\n\n${paper.abstract || ""}`,
            metadata: {
              title: paper.title,
              published: paper.publishedDate?.toISOString() || "",
              categories: paper.categories || "[]",
              source: paper.id.startsWith("ntrs-") ? "NASA NTRS" : "arXiv",
            },
          });
        }
      } else {
        // Use translations for each locale
        for (const [locale, t] of trans) {
          await collections.papers[locale].add({
            id: paper.id,
            text: `${t.title}\n\n${t.summary}\n\n${paper.abstract || ""}`,
            metadata: {
              title: t.title,
              published: paper.publishedDate?.toISOString() || "",
              categories: paper.categories || "[]",
              source: paper.id.startsWith("ntrs-") ? "NASA NTRS" : "arXiv",
            },
          });
        }
      }

      stats.papers++;
      if (stats.papers % 10 === 0) {
        console.log(`  ✅ Processed ${stats.papers} papers`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing paper ${paper.id}:`, error);
      stats.errors.push(`Paper ${paper.id}: ${error}`);
    }
  }

  console.log(`  ✅ Completed: ${stats.papers} papers`);
}

async function rebuildVideoVectors(
  collections: { videos: CollectionsByLocale },
  stats: RebuildStats,
): Promise<void> {
  console.log("\n🎥 Rebuilding video vectors...");

  const allVideos = await db.select().from(videos);
  console.log(`  Found ${allVideos.length} videos in database`);

  for (const video of allVideos) {
    try {
      const trans = await getTranslationsForItem("video", video.id);
      const transcriptPreview = (video.transcript || "").substring(0, 5000);

      if (trans.size === 0) {
        // No translations - use original English content
        for (const locale of SUPPORTED_LOCALES) {
          await collections.videos[locale].add({
            id: video.id,
            text: `${video.title}\n\n${video.summary || ""}\n\n${transcriptPreview}`,
            metadata: {
              title: video.title,
              channelName: video.channelName || "",
              published: video.publishedDate?.toISOString() || "",
            },
          });
        }
      } else {
        // Use translations for each locale
        for (const [locale, t] of trans) {
          await collections.videos[locale].add({
            id: video.id,
            text: `${t.title}\n\n${t.summary}\n\n${transcriptPreview}`,
            metadata: {
              title: t.title,
              channelName: video.channelName || "",
              published: video.publishedDate?.toISOString() || "",
            },
          });
        }
      }

      stats.videos++;
      if (stats.videos % 10 === 0) {
        console.log(`  ✅ Processed ${stats.videos} videos`);
      }
    } catch (error) {
      console.error(`  ❌ Error processing video ${video.id}:`, error);
      stats.errors.push(`Video ${video.id}: ${error}`);
    }
  }

  console.log(`  ✅ Completed: ${stats.videos} videos`);
}

async function rebuildNasaVectors(
  collections: { nasa: CollectionsByLocale },
  stats: RebuildStats,
): Promise<void> {
  console.log("\n🚀 Rebuilding NASA vectors...");

  const allNasa = await db.select().from(nasaContent);
  console.log(`  Found ${allNasa.length} NASA items in database`);

  for (const item of allNasa) {
    try {
      const trans = await getTranslationsForItem("nasa", item.id);
      const description = item.explanation || item.description || "";

      if (trans.size === 0) {
        // No translations - use original English content
        for (const locale of SUPPORTED_LOCALES) {
          await collections.nasa[locale].add({
            id: item.id,
            text: `${item.title}\n\n${item.summary || ""}\n\n${description}`,
            metadata: {
              title: item.title,
              date: item.date?.toISOString() || "",
              type: item.contentType || "",
            },
          });
        }
      } else {
        // Use translations for each locale
        for (const [locale, t] of trans) {
          await collections.nasa[locale].add({
            id: item.id,
            text: `${t.title}\n\n${t.summary}\n\n${description}`,
            metadata: {
              title: t.title,
              date: item.date?.toISOString() || "",
              type: item.contentType || "",
            },
          });
        }
      }

      stats.nasa++;
    } catch (error) {
      console.error(`  ❌ Error processing NASA item ${item.id}:`, error);
      stats.errors.push(`NASA ${item.id}: ${error}`);
    }
  }

  console.log(`  ✅ Completed: ${stats.nasa} NASA items`);
}

async function main() {
  console.log("=".repeat(60));
  console.log("AstroGroot Vector Rebuild Script");
  console.log("=".repeat(60));
  console.log("\nThis script rebuilds ChromaDB vectors from existing Turso data.");
  console.log("No AI API calls will be made.\n");

  const startTime = Date.now();
  const stats: RebuildStats = {
    papers: 0,
    videos: 0,
    nasa: 0,
    errors: [],
  };

  try {
    // Initialize ChromaDB collections
    console.log("🔌 Connecting to ChromaDB...");
    const collections = await initializeCollections();
    console.log("✅ Connected to ChromaDB\n");

    // Rebuild vectors for each content type
    await rebuildPaperVectors(collections, stats);
    await rebuildVideoVectors(collections, stats);
    await rebuildNasaVectors(collections, stats);

  } catch (error) {
    console.error("❌ Fatal error:", error);
    stats.errors.push(`Fatal: ${error}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(60));
  console.log("📊 Rebuild Summary");
  console.log("=".repeat(60));
  console.log(`Papers rebuilt:     ${stats.papers}`);
  console.log(`Videos rebuilt:     ${stats.videos}`);
  console.log(`NASA items rebuilt: ${stats.nasa}`);
  console.log(`Total:              ${stats.papers + stats.videos + stats.nasa}`);
  console.log(`Duration:           ${duration}s`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
    stats.errors.forEach((error) => console.log(`  - ${error}`));
  } else {
    console.log("\n✅ All vectors rebuilt successfully!");
  }

  console.log("=".repeat(60));
}

if (import.meta.main) {
  await main();
}
