#!/usr/bin/env -S deno run --allow-all

import { db } from "../db/client.ts";
import { papers, videos, nasaContent, translations } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import { initializeCollections } from "../lib/vector.ts";
import { processMultilingualContent } from "../lib/ai/processor.ts";
import type { Locale } from "../lib/i18n.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n.ts";
import { collectAstronomyPapers, collectRocketPapers } from "../lib/collectors/arxiv.ts";
import { collectNasaContent } from "../lib/collectors/nasa.ts";
import {
  collectAstronomyVideos,
  fetchCompleteVideoData,
} from "../lib/collectors/youtube.ts";
import { collectRocketReports, type NtrsEntry } from "../lib/collectors/ntrs.ts";

const CRAWLER_INTERVAL_HOURS = Number(Deno.env.get("CRAWLER_INTERVAL_HOURS")) || 24;
const MAX_ITEMS_PER_SOURCE = Number(Deno.env.get("MAX_ITEMS_PER_SOURCE")) || 50;
const HEALTH_CHECK_PORT = Number(Deno.env.get("PORT")) || 8080;

// Track crawler state for health checks
let lastCrawlTime: Date | null = null;
let lastCrawlStats: CrawlerStats | null = null;
let isRunning = false;

export interface CrawlerStats {
  papersCollected: number;
  ntrsReportsCollected: number;
  videosCollected: number;
  nasaItemsCollected: number;
  errors: string[];
}

// Sync missing vectors from Turso to ChromaDB
interface SyncStats {
  synced: number;
  skipped: number;
  errors: string[];
}

async function syncMissingVectors(
  collections: {
    papers: Record<Locale, { add: (params: { id: string; text: string; metadata?: Record<string, string> }) => Promise<void>; get: (id: string) => Promise<unknown> }>;
    videos: Record<Locale, { add: (params: { id: string; text: string; metadata?: Record<string, string> }) => Promise<void>; get: (id: string) => Promise<unknown> }>;
    nasa: Record<Locale, { add: (params: { id: string; text: string; metadata?: Record<string, string> }) => Promise<void>; get: (id: string) => Promise<unknown> }>;
  },
  database: typeof db,
): Promise<SyncStats> {
  const stats: SyncStats = { synced: 0, skipped: 0, errors: [] };

  // Helper to get translations for an item
  async function getTranslations(itemId: string): Promise<Map<Locale, { title: string; summary: string }>> {
    const trans = await database.query.translations.findMany({
      where: eq(translations.itemId, itemId),
    });
    const result = new Map<Locale, { title: string; summary: string }>();
    for (const t of trans) {
      if (SUPPORTED_LOCALES.includes(t.lang as Locale)) {
        result.set(t.lang as Locale, { title: t.title || "", summary: t.summary || "" });
      }
    }
    return result;
  }

  // Sync papers
  const allPapers = await database.select().from(papers);
  for (const paper of allPapers) {
    try {
      // Check if exists in first locale (if missing in one, likely missing in all)
      const existing = await collections.papers["en"].get(paper.id);
      if (existing) {
        stats.skipped++;
        continue;
      }

      const trans = await getTranslations(paper.id);
      for (const locale of SUPPORTED_LOCALES) {
        const t = trans.get(locale);
        const title = t?.title || paper.title;
        const summary = t?.summary || paper.summary || "";
        await collections.papers[locale].add({
          id: paper.id,
          text: `${title}\n\n${summary}\n\n${paper.abstract || ""}`,
          metadata: {
            title,
            published: paper.publishedDate?.toISOString() || "",
            categories: paper.categories || "[]",
            source: paper.id.startsWith("ntrs-") ? "NASA NTRS" : "arXiv",
          },
        });
      }
      stats.synced++;
    } catch (error) {
      stats.errors.push(`Paper ${paper.id}: ${error}`);
    }
  }

  // Sync videos
  const allVideos = await database.select().from(videos);
  for (const video of allVideos) {
    try {
      const existing = await collections.videos["en"].get(video.id);
      if (existing) {
        stats.skipped++;
        continue;
      }

      const trans = await getTranslations(video.id);
      const transcriptPreview = (video.transcript || "").substring(0, 5000);
      for (const locale of SUPPORTED_LOCALES) {
        const t = trans.get(locale);
        const title = t?.title || video.title;
        const summary = t?.summary || video.summary || "";
        await collections.videos[locale].add({
          id: video.id,
          text: `${title}\n\n${summary}\n\n${transcriptPreview}`,
          metadata: {
            title,
            channelName: video.channelName || "",
            published: video.publishedDate?.toISOString() || "",
          },
        });
      }
      stats.synced++;
    } catch (error) {
      stats.errors.push(`Video ${video.id}: ${error}`);
    }
  }

  // Sync NASA content
  const allNasa = await database.select().from(nasaContent);
  for (const item of allNasa) {
    try {
      const existing = await collections.nasa["en"].get(item.id);
      if (existing) {
        stats.skipped++;
        continue;
      }

      const trans = await getTranslations(item.id);
      const description = item.explanation || item.description || "";
      for (const locale of SUPPORTED_LOCALES) {
        const t = trans.get(locale);
        const title = t?.title || item.title;
        const summary = t?.summary || item.summary || "";
        await collections.nasa[locale].add({
          id: item.id,
          text: `${title}\n\n${summary}\n\n${description}`,
          metadata: {
            title,
            date: item.date?.toISOString() || "",
            type: item.contentType || "",
          },
        });
      }
      stats.synced++;
    } catch (error) {
      stats.errors.push(`NASA ${item.id}: ${error}`);
    }
  }

  return stats;
}

/** Optional dependencies for testing (when provided, used instead of real db/collectors/vector). */
export interface CrawlerDeps {
  db: typeof db;
  initializeCollections: typeof initializeCollections;
  processMultilingualContent: typeof processMultilingualContent;
  collectAstronomyPapers: typeof collectAstronomyPapers;
  collectRocketPapers: typeof collectRocketPapers;
  collectRocketReports: typeof collectRocketReports;
  collectAstronomyVideos: typeof collectAstronomyVideos;
  fetchCompleteVideoData: typeof fetchCompleteVideoData;
  collectNasaContent: typeof collectNasaContent;
}

// Main crawler function
export async function runCrawler(deps?: CrawlerDeps): Promise<CrawlerStats> {
  const db_ = deps?.db ?? db;
  const initCollections_ = deps?.initializeCollections ?? initializeCollections;
  const processMultilingual_ = deps?.processMultilingualContent ?? processMultilingualContent;
  const collectAstronomyPapers_ = deps?.collectAstronomyPapers ?? collectAstronomyPapers;
  const collectRocketPapers_ = deps?.collectRocketPapers ?? collectRocketPapers;
  const collectRocketReports_ = deps?.collectRocketReports ?? collectRocketReports;
  const collectAstronomyVideos_ = deps?.collectAstronomyVideos ?? collectAstronomyVideos;
  const fetchCompleteVideoData_ = deps?.fetchCompleteVideoData ?? fetchCompleteVideoData;
  const collectNasaContent_ = deps?.collectNasaContent ?? collectNasaContent;

  console.log("🚀 Starting AstroGroot Crawler...");
  console.log(`Max items per source: ${MAX_ITEMS_PER_SOURCE}`);

  const stats: CrawlerStats = {
    papersCollected: 0,
    ntrsReportsCollected: 0,
    videosCollected: 0,
    nasaItemsCollected: 0,
    errors: [],
  };

  // Initialize vector store collections
  const collections = await initCollections_();

  // Collect arXiv papers
  try {
    console.log("\n📄 Collecting arXiv papers...");
    const arxivPapers = await collectAstronomyPapers_({
      maxResults: MAX_ITEMS_PER_SOURCE,
      daysBack: 7,
    });

    for (const paper of arxivPapers) {
      try {
        // Check if paper already exists
        const existing = await db_.query.papers.findFirst({
          where: eq(papers.id, paper.id),
        });

        if (existing) {
          console.log(`  ⏭️  Paper ${paper.id} already exists, skipping`);
          continue;
        }

        // Process with AI (summarize + translate to all supported languages)
        console.log(`  🤖 Processing paper: ${paper.title.substring(0, 50)}...`);
        const { baseSummary, translations: trans } = await processMultilingual_({
          text: paper.summary,
          title: paper.title,
          sourceType: "paper",
        });

        // Insert into database (main row: English summary)
        await db_.insert(papers).values({
          id: paper.id,
          title: paper.title,
          authors: JSON.stringify(paper.authors),
          abstract: paper.summary,
          summary: baseSummary,
          publishedDate: new Date(paper.published),
          updatedDate: paper.updated ? new Date(paper.updated) : null,
          categories: JSON.stringify(paper.categories),
          pdfUrl: paper.pdfUrl,
          arxivUrl: paper.arxivUrl,
          processed: true,
          vectorId: paper.id,
        });

        // Insert translations for each language
        for (const t of trans) {
          await db_.insert(translations).values({
            itemType: "paper",
            itemId: paper.id,
            lang: t.lang,
            title: t.title,
            summary: t.summary,
          });
        }

        // Add to per-locale vector stores
        for (const t of trans) {
          const locale = t.lang as Locale;
          if (!SUPPORTED_LOCALES.includes(locale)) continue;
          await collections.papers[locale].add({
            id: paper.id,
            text: `${t.title}\n\n${t.summary}\n\n${paper.summary}`,
            metadata: {
              title: t.title,
              published: paper.published,
              categories: paper.categories.join(", "),
            },
          });
        }

        stats.papersCollected++;
        console.log(`  ✅ Saved paper: ${paper.id}`);
      } catch (error) {
        console.error(`  ❌ Error processing paper ${paper.id}:`, error);
        stats.errors.push(`Paper ${paper.id}: ${error}`);
      }
    }

    console.log(`\n✅ Collected ${stats.papersCollected} arXiv papers`);
  } catch (error) {
    console.error("❌ Error collecting arXiv papers:", error);
    stats.errors.push(`arXiv collection: ${error}`);
  }

  // Collect rocket / launch system papers
  try {
    console.log("\n🛰️ Collecting rocket/launch system papers...");
    const rocketPapers = await collectRocketPapers_({
      maxResults: Math.min(MAX_ITEMS_PER_SOURCE, 20),
      daysBack: 14,
    });

    for (const paper of rocketPapers) {
      try {
        const existing = await db_.query.papers.findFirst({
          where: eq(papers.id, paper.id),
        });

        if (existing) {
          console.log(`  ⏭️  Paper ${paper.id} already exists, skipping`);
          continue;
        }

        console.log(`  🤖 Processing paper: ${paper.title.substring(0, 50)}...`);
        const { baseSummary, translations: trans } = await processMultilingual_({
          text: paper.summary,
          title: paper.title,
          sourceType: "paper",
        });

        await db_.insert(papers).values({
          id: paper.id,
          title: paper.title,
          authors: JSON.stringify(paper.authors),
          abstract: paper.summary,
          summary: baseSummary,
          publishedDate: new Date(paper.published),
          updatedDate: paper.updated ? new Date(paper.updated) : null,
          categories: JSON.stringify(paper.categories),
          pdfUrl: paper.pdfUrl,
          arxivUrl: paper.arxivUrl,
          processed: true,
          vectorId: paper.id,
        });

        for (const t of trans) {
          await db_.insert(translations).values({
            itemType: "paper",
            itemId: paper.id,
            lang: t.lang,
            title: t.title,
            summary: t.summary,
          });
        }

        for (const t of trans) {
          const locale = t.lang as Locale;
          if (!SUPPORTED_LOCALES.includes(locale)) continue;
          await collections.papers[locale].add({
            id: paper.id,
            text: `${t.title}\n\n${t.summary}\n\n${paper.summary}`,
            metadata: {
              title: t.title,
              published: paper.published,
              categories: paper.categories.join(", "),
            },
          });
        }

        stats.papersCollected++;
        console.log(`  ✅ Saved paper: ${paper.id}`);
      } catch (error) {
        console.error(`  ❌ Error processing paper ${paper.id}:`, error);
        stats.errors.push(`Rocket paper ${paper.id}: ${error}`);
      }
    }
  } catch (error) {
    console.error("❌ Error collecting rocket papers:", error);
    stats.errors.push(`Rocket arXiv collection: ${error}`);
  }

  // Collect NASA NTRS technical reports (rocket/propulsion focused)
  try {
    console.log("\n🚀 Collecting NASA NTRS technical reports...");
    const ntrsReports = await collectRocketReports_({
      maxResultsPerQuery: Math.floor(MAX_ITEMS_PER_SOURCE / 10),
    });

    for (const report of ntrsReports.slice(0, MAX_ITEMS_PER_SOURCE)) {
      try {
        const reportId = `ntrs-${report.id}`;

        // Check if report already exists
        const existing = await db_.query.papers.findFirst({
          where: eq(papers.id, reportId),
        });

        if (existing) {
          console.log(`  ⏭️  NTRS ${report.id} already exists, skipping`);
          continue;
        }

        // Process with AI (summarize + translate to all supported languages)
        console.log(`  🤖 Processing NTRS: ${report.title.substring(0, 50)}...`);
        const { baseSummary, translations: trans } = await processMultilingual_({
          text: report.abstract || report.title,
          title: report.title,
          sourceType: "paper",
        });

        // Insert into database (using papers table with ntrs- prefix)
        await db_.insert(papers).values({
          id: reportId,
          title: report.title,
          authors: JSON.stringify(report.authors),
          abstract: report.abstract || "",
          summary: baseSummary,
          publishedDate: report.publishedDate ? new Date(report.publishedDate) : new Date(),
          categories: JSON.stringify(report.subjectCategories),
          pdfUrl: report.pdfUrl,
          arxivUrl: report.ntrsUrl, // Store NTRS URL in arxivUrl field
          processed: true,
          vectorId: reportId,
        });

        // Insert translations for each language
        for (const t of trans) {
          await db_.insert(translations).values({
            itemType: "paper",
            itemId: reportId,
            lang: t.lang,
            title: t.title,
            summary: t.summary,
          });
        }

        // Add to per-locale vector stores
        for (const t of trans) {
          const locale = t.lang as Locale;
          if (!SUPPORTED_LOCALES.includes(locale)) continue;
          await collections.papers[locale].add({
            id: reportId,
            text: `${t.title}\n\n${t.summary}\n\n${report.abstract || ""}`,
            metadata: {
              title: t.title,
              published: report.publishedDate || "",
              categories: report.subjectCategories.join(", "),
              source: "NASA NTRS",
            },
          });
        }

        stats.ntrsReportsCollected++;
        console.log(`  ✅ Saved NTRS report: ${reportId}`);
      } catch (error) {
        console.error(`  ❌ Error processing NTRS ${report.id}:`, error);
        stats.errors.push(`NTRS ${report.id}: ${error}`);
      }
    }

    console.log(`\n✅ Collected ${stats.ntrsReportsCollected} NTRS reports`);
  } catch (error) {
    console.error("❌ Error collecting NTRS reports:", error);
    stats.errors.push(`NTRS collection: ${error}`);
  }

  // Collect YouTube videos
  try {
    console.log("\n🎥 Collecting YouTube videos...");
    const videoList = await collectAstronomyVideos_({
      maxResultsPerQuery: Math.floor(MAX_ITEMS_PER_SOURCE / 4),
    });

    for (const videoInfo of videoList.slice(0, MAX_ITEMS_PER_SOURCE)) {
      try {
        // Check if video already exists
        const existing = await db_.query.videos.findFirst({
          where: eq(videos.id, videoInfo.videoId),
        });

        if (existing) {
          console.log(`  ⏭️  Video ${videoInfo.videoId} already exists, skipping`);
          continue;
        }

        // Fetch complete video data
        console.log(`  📥 Fetching video: ${videoInfo.title.substring(0, 50)}...`);
        const videoData = await fetchCompleteVideoData_(videoInfo.videoId);

        // Process with AI (summarize + translate to all supported languages)
        console.log(`  🤖 Processing video transcript...`);
        const { baseSummary, translations: trans } = await processMultilingual_({
          text: videoData.fullText,
          title: videoData.metadata.title,
          sourceType: "video",
        });

        // Insert into database (main row: English summary)
        await db_.insert(videos).values({
          id: videoData.metadata.id,
          title: videoData.metadata.title,
          channelName: videoData.metadata.channelName,
          channelId: videoData.metadata.channelId,
          description: videoData.metadata.description,
          transcript: videoData.fullText,
          summary: baseSummary,
          publishedDate: new Date(videoData.metadata.publishedAt),
          duration: videoData.metadata.duration,
          viewCount: videoData.metadata.viewCount,
          likeCount: videoData.metadata.likeCount,
          tags: JSON.stringify(videoData.metadata.tags || []),
          thumbnailUrl: videoData.metadata.thumbnailUrl,
          videoUrl: `https://youtube.com/watch?v=${videoData.metadata.id}`,
          processed: true,
          vectorId: videoData.metadata.id,
        });

        // Insert translations for each language
        for (const t of trans) {
          await db_.insert(translations).values({
            itemType: "video",
            itemId: videoData.metadata.id,
            lang: t.lang,
            title: t.title,
            summary: t.summary,
          });
        }

        // Add to per-locale vector stores
        for (const t of trans) {
          const locale = t.lang as Locale;
          if (!SUPPORTED_LOCALES.includes(locale)) continue;
          await collections.videos[locale].add({
            id: videoData.metadata.id,
            text: `${t.title}\n\n${t.summary}\n\n${videoData.fullText.substring(0, 5000)}`,
            metadata: {
              title: t.title,
              channelName: videoData.metadata.channelName,
              published: videoData.metadata.publishedAt,
            },
          });
        }

        stats.videosCollected++;
        console.log(`  ✅ Saved video: ${videoData.metadata.id}`);
      } catch (error) {
        console.error(`  ❌ Error processing video ${videoInfo.videoId}:`, error);
        stats.errors.push(`Video ${videoInfo.videoId}: ${error}`);
      }
    }

    console.log(`\n✅ Collected ${stats.videosCollected} videos`);
  } catch (error) {
    console.error("❌ Error collecting YouTube videos:", error);
    stats.errors.push(`YouTube collection: ${error}`);
  }

  // Collect NASA content
  try {
    console.log("\n🚀 Collecting NASA content...");
    const nasaData = await collectNasaContent_({
      includeApod: true,
      searchQueries: ["astronomy", "space telescope", "mars", "jupiter"],
      maxItemsPerQuery: Math.floor(MAX_ITEMS_PER_SOURCE / 4),
    });

    // Process APOD
    if (nasaData.apod) {
      try {
        const apodId = `apod-${nasaData.apod.date}`;

        // Check if APOD already exists
        const existing = await db_.query.nasaContent.findFirst({
          where: eq(nasaContent.id, apodId),
        });

        if (!existing) {
          console.log(`  🌌 Processing APOD: ${nasaData.apod.title}`);

          const { baseSummary, translations: trans } = await processMultilingual_({
            text: nasaData.apod.explanation,
            title: nasaData.apod.title,
            sourceType: "article",
          });

          await db_.insert(nasaContent).values({
            id: apodId,
            contentType: "apod",
            title: nasaData.apod.title,
            explanation: nasaData.apod.explanation,
            summary: baseSummary,
            date: new Date(nasaData.apod.date),
            mediaType: nasaData.apod.media_type,
            hdUrl: nasaData.apod.hdurl,
            url: nasaData.apod.url,
            copyright: nasaData.apod.copyright,
            processed: true,
            vectorId: apodId,
          });

          for (const t of trans) {
            await db_.insert(translations).values({
              itemType: "nasa",
              itemId: apodId,
              lang: t.lang,
              title: t.title,
              summary: t.summary,
            });
          }

          for (const t of trans) {
            const locale = t.lang as Locale;
            if (!SUPPORTED_LOCALES.includes(locale)) continue;
            await collections.nasa[locale].add({
              id: apodId,
              text: `${t.title}\n\n${t.summary}\n\n${nasaData.apod.explanation}`,
              metadata: {
                title: t.title,
                date: nasaData.apod.date,
                type: "apod",
              },
            });
          }

          stats.nasaItemsCollected++;
          console.log(`  ✅ Saved APOD: ${apodId}`);
        }
      } catch (error) {
        console.error("  ❌ Error processing APOD:", error);
        stats.errors.push(`APOD: ${error}`);
      }
    }

    // Process library items
    for (const item of nasaData.libraryItems) {
      try {
        const itemId = `nasa-${item.nasa_id}`;

        // Check if item already exists
        const existing = await db_.query.nasaContent.findFirst({
          where: eq(nasaContent.id, itemId),
        });

        if (existing) {
          console.log(`  ⏭️  NASA item ${item.nasa_id} already exists, skipping`);
          continue;
        }

        console.log(`  📸 Processing NASA item: ${item.title.substring(0, 50)}...`);

        const description = item.description || "";
        const { baseSummary, translations: trans } = await processMultilingual_({
          text: description,
          title: item.title,
          sourceType: "article",
        });

        await db_.insert(nasaContent).values({
          id: itemId,
          contentType: "library",
          title: item.title,
          description: description,
          summary: baseSummary,
          date: new Date(item.date_created),
          mediaType: item.media_type,
          url: item.href,
          nasaId: item.nasa_id,
          center: item.center,
          keywords: JSON.stringify(item.keywords || []),
          processed: true,
          vectorId: itemId,
        });

        for (const t of trans) {
          await db_.insert(translations).values({
            itemType: "nasa",
            itemId: itemId,
            lang: t.lang,
            title: t.title,
            summary: t.summary,
          });
        }

        for (const t of trans) {
          const locale = t.lang as Locale;
          if (!SUPPORTED_LOCALES.includes(locale)) continue;
          await collections.nasa[locale].add({
            id: itemId,
            text: `${t.title}\n\n${t.summary}\n\n${description}`,
            metadata: {
              title: t.title,
              nasaId: item.nasa_id,
              center: item.center || "",
              type: "library",
            },
          });
        }

        stats.nasaItemsCollected++;
        console.log(`  ✅ Saved NASA item: ${itemId}`);
      } catch (error) {
        console.error(`  ❌ Error processing NASA item ${item.nasa_id}:`, error);
        stats.errors.push(`NASA ${item.nasa_id}: ${error}`);
      }
    }

    console.log(`\n✅ Collected ${stats.nasaItemsCollected} NASA items`);
  } catch (error) {
    console.error("❌ Error collecting NASA content:", error);
    stats.errors.push(`NASA collection: ${error}`);
  }

  // Sync missing vectors (ensures ChromaDB has all Turso data)
  // Skip if running with mocked dependencies (testing)
  if (!deps) {
    try {
      console.log("\n🔄 Syncing missing vectors...");
      const syncStats = await syncMissingVectors(collections, db_);
      console.log(`✅ Vector sync: ${syncStats.synced} items synced, ${syncStats.skipped} already exist`);
      if (syncStats.errors.length > 0) {
        console.log(`⚠️  Sync errors: ${syncStats.errors.length}`);
        stats.errors.push(...syncStats.errors);
      }
    } catch (error) {
      console.error("❌ Error syncing vectors:", error);
      stats.errors.push(`Vector sync: ${error}`);
    }
  }

  return stats;
}

// Run crawler once
async function runOnce() {
  console.log("=".repeat(60));
  console.log("AstroGroot Crawler - Single Run Mode");
  console.log("=".repeat(60));

  const startTime = Date.now();
  const stats = await runCrawler();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(60));
  console.log("📊 Crawler Summary");
  console.log("=".repeat(60));
  console.log(`arXiv papers collected: ${stats.papersCollected}`);
  console.log(`NTRS reports collected: ${stats.ntrsReportsCollected}`);
  console.log(`Videos collected: ${stats.videosCollected}`);
  console.log(`NASA items collected: ${stats.nasaItemsCollected}`);
  const total = stats.papersCollected + stats.ntrsReportsCollected + stats.videosCollected + stats.nasaItemsCollected;
  console.log(`Total items: ${total}`);
  console.log(`Duration: ${duration}s`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
    stats.errors.forEach((error) => console.log(`  - ${error}`));
  }

  console.log("=".repeat(60));
}

// Simple HTTP health check server for Fly.io
async function startHealthCheckServer() {
  console.log(`🏥 Starting health check server on port ${HEALTH_CHECK_PORT}...`);

  Deno.serve({ port: HEALTH_CHECK_PORT }, (req) => {
    const url = new URL(req.url);

    if (url.pathname === "/health" || url.pathname === "/") {
      const status = {
        ok: true,
        service: "astrogroot-crawler",
        mode: "scheduled",
        intervalHours: CRAWLER_INTERVAL_HOURS,
        isRunning,
        lastCrawl: lastCrawlTime?.toISOString() || null,
        lastStats: lastCrawlStats,
        nextCrawl: lastCrawlTime
          ? new Date(lastCrawlTime.getTime() + CRAWLER_INTERVAL_HOURS * 60 * 60 * 1000).toISOString()
          : null,
      };
      return new Response(JSON.stringify(status, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  });

  console.log(`✅ Health check server running at http://0.0.0.0:${HEALTH_CHECK_PORT}/health`);
}

// Run crawler on schedule (24/7 mode)
async function runScheduled() {
  console.log("=".repeat(60));
  console.log("AstroGroot Crawler - Scheduled Mode");
  console.log(`Running every ${CRAWLER_INTERVAL_HOURS} hours`);
  console.log("=".repeat(60));

  // Start health check server for Fly.io
  startHealthCheckServer();

  while (true) {
    const startTime = Date.now();
    console.log(`\n🕐 Starting crawl at ${new Date().toISOString()}`);
    isRunning = true;

    try {
      const stats = await runCrawler();
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

      lastCrawlTime = new Date();
      lastCrawlStats = stats;
      isRunning = false;

      console.log("\n✅ Crawl completed");
      console.log(
        `Collected: ${stats.papersCollected} arXiv, ${stats.ntrsReportsCollected} NTRS, ${stats.videosCollected} videos, ${stats.nasaItemsCollected} NASA items`,
      );
      console.log(`Duration: ${duration} minutes`);

      if (stats.errors.length > 0) {
        console.log(`⚠️  Encountered ${stats.errors.length} errors`);
      }
    } catch (error) {
      isRunning = false;
      console.error("❌ Crawler failed:", error);
    }

    // Wait for next interval
    const waitMs = CRAWLER_INTERVAL_HOURS * 60 * 60 * 1000;
    console.log(`\n💤 Sleeping for ${CRAWLER_INTERVAL_HOURS} hours...`);
    console.log(`Next crawl at: ${new Date(Date.now() + waitMs).toISOString()}`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

// Main entry point
if (import.meta.main) {
  const mode = Deno.args[0];

  if (mode === "scheduled" || mode === "daemon") {
    await runScheduled();
  } else {
    await runOnce();
  }
}
