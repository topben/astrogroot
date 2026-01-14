#!/usr/bin/env -S deno run --allow-all

import { db } from "../db/client.ts";
import { papers, videos, nasaContent } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import { initializeCollections } from "../lib/vector.ts";
import { processContent } from "../lib/ai/processor.ts";
import { collectAstronomyPapers } from "../lib/collectors/arxiv.ts";
import { collectNasaContent } from "../lib/collectors/nasa.ts";
import {
  collectAstronomyVideos,
  fetchCompleteVideoData,
} from "../lib/collectors/youtube.ts";

const CRAWLER_INTERVAL_HOURS = Number(Deno.env.get("CRAWLER_INTERVAL_HOURS")) || 24;
const MAX_ITEMS_PER_SOURCE = Number(Deno.env.get("MAX_ITEMS_PER_SOURCE")) || 50;

interface CrawlerStats {
  papersCollected: number;
  videosCollected: number;
  nasaItemsCollected: number;
  errors: string[];
}

// Main crawler function
async function runCrawler(): Promise<CrawlerStats> {
  console.log("🚀 Starting AstroGroot Crawler...");
  console.log(`Max items per source: ${MAX_ITEMS_PER_SOURCE}`);

  const stats: CrawlerStats = {
    papersCollected: 0,
    videosCollected: 0,
    nasaItemsCollected: 0,
    errors: [],
  };

  // Initialize vector store collections
  const collections = await initializeCollections();

  // Collect arXiv papers
  try {
    console.log("\n📄 Collecting arXiv papers...");
    const arxivPapers = await collectAstronomyPapers({
      maxResults: MAX_ITEMS_PER_SOURCE,
      daysBack: 7,
    });

    for (const paper of arxivPapers) {
      try {
        // Check if paper already exists
        const existing = await db.query.papers.findFirst({
          where: eq(papers.id, paper.id),
        });

        if (existing) {
          console.log(`  ⏭️  Paper ${paper.id} already exists, skipping`);
          continue;
        }

        // Process with AI
        console.log(`  🤖 Processing paper: ${paper.title.substring(0, 50)}...`);
        const processed = await processContent({
          text: paper.summary,
          title: paper.title,
          sourceType: "paper",
        });

        // Insert into database
        await db.insert(papers).values({
          id: paper.id,
          title: paper.title,
          authors: JSON.stringify(paper.authors),
          abstract: paper.summary,
          summary: processed.summary,
          publishedDate: new Date(paper.published),
          updatedDate: paper.updated ? new Date(paper.updated) : null,
          categories: JSON.stringify(paper.categories),
          pdfUrl: paper.pdfUrl,
          arxivUrl: paper.arxivUrl,
          processed: true,
          vectorId: paper.id,
        });

        // Add to vector store
        await collections.papers.add({
          id: paper.id,
          text: `${paper.title}\n\n${processed.summary}\n\n${paper.summary}`,
          metadata: {
            title: paper.title,
            published: paper.published,
            categories: paper.categories.join(", "),
          },
        });

        stats.papersCollected++;
        console.log(`  ✅ Saved paper: ${paper.id}`);
      } catch (error) {
        console.error(`  ❌ Error processing paper ${paper.id}:`, error);
        stats.errors.push(`Paper ${paper.id}: ${error}`);
      }
    }

    console.log(`\n✅ Collected ${stats.papersCollected} papers`);
  } catch (error) {
    console.error("❌ Error collecting arXiv papers:", error);
    stats.errors.push(`arXiv collection: ${error}`);
  }

  // Collect YouTube videos
  try {
    console.log("\n🎥 Collecting YouTube videos...");
    const videoList = await collectAstronomyVideos({
      maxResultsPerQuery: Math.floor(MAX_ITEMS_PER_SOURCE / 4),
    });

    for (const videoInfo of videoList.slice(0, MAX_ITEMS_PER_SOURCE)) {
      try {
        // Check if video already exists
        const existing = await db.query.videos.findFirst({
          where: eq(videos.id, videoInfo.videoId),
        });

        if (existing) {
          console.log(`  ⏭️  Video ${videoInfo.videoId} already exists, skipping`);
          continue;
        }

        // Fetch complete video data
        console.log(`  📥 Fetching video: ${videoInfo.title.substring(0, 50)}...`);
        const videoData = await fetchCompleteVideoData(videoInfo.videoId);

        // Process with AI
        console.log(`  🤖 Processing video transcript...`);
        const processed = await processContent({
          text: videoData.fullText,
          title: videoData.metadata.title,
          sourceType: "video",
        });

        // Insert into database
        await db.insert(videos).values({
          id: videoData.metadata.id,
          title: videoData.metadata.title,
          channelName: videoData.metadata.channelName,
          channelId: videoData.metadata.channelId,
          description: videoData.metadata.description,
          transcript: videoData.fullText,
          summary: processed.summary,
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

        // Add to vector store
        await collections.videos.add({
          id: videoData.metadata.id,
          text: `${videoData.metadata.title}\n\n${processed.summary}\n\n${videoData.fullText.substring(0, 5000)}`,
          metadata: {
            title: videoData.metadata.title,
            channelName: videoData.metadata.channelName,
            published: videoData.metadata.publishedAt,
          },
        });

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
    const nasaData = await collectNasaContent({
      includeApod: true,
      searchQueries: ["astronomy", "space telescope", "mars", "jupiter"],
      maxItemsPerQuery: Math.floor(MAX_ITEMS_PER_SOURCE / 4),
    });

    // Process APOD
    if (nasaData.apod) {
      try {
        const apodId = `apod-${nasaData.apod.date}`;

        // Check if APOD already exists
        const existing = await db.query.nasaContent.findFirst({
          where: eq(nasaContent.id, apodId),
        });

        if (!existing) {
          console.log(`  🌌 Processing APOD: ${nasaData.apod.title}`);

          const processed = await processContent({
            text: nasaData.apod.explanation,
            title: nasaData.apod.title,
            sourceType: "article",
          });

          await db.insert(nasaContent).values({
            id: apodId,
            contentType: "apod",
            title: nasaData.apod.title,
            explanation: nasaData.apod.explanation,
            summary: processed.summary,
            date: new Date(nasaData.apod.date),
            mediaType: nasaData.apod.media_type,
            hdUrl: nasaData.apod.hdurl,
            url: nasaData.apod.url,
            copyright: nasaData.apod.copyright,
            processed: true,
            vectorId: apodId,
          });

          await collections.nasa.add({
            id: apodId,
            text: `${nasaData.apod.title}\n\n${processed.summary}\n\n${nasaData.apod.explanation}`,
            metadata: {
              title: nasaData.apod.title,
              date: nasaData.apod.date,
              type: "apod",
            },
          });

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
        const existing = await db.query.nasaContent.findFirst({
          where: eq(nasaContent.id, itemId),
        });

        if (existing) {
          console.log(`  ⏭️  NASA item ${item.nasa_id} already exists, skipping`);
          continue;
        }

        console.log(`  📸 Processing NASA item: ${item.title.substring(0, 50)}...`);

        const description = item.description || "";
        const processed = await processContent({
          text: description,
          title: item.title,
          sourceType: "article",
        });

        await db.insert(nasaContent).values({
          id: itemId,
          contentType: "library",
          title: item.title,
          description: description,
          summary: processed.summary,
          date: new Date(item.date_created),
          mediaType: item.media_type,
          url: item.href,
          nasaId: item.nasa_id,
          center: item.center,
          keywords: JSON.stringify(item.keywords || []),
          processed: true,
          vectorId: itemId,
        });

        await collections.nasa.add({
          id: itemId,
          text: `${item.title}\n\n${processed.summary}\n\n${description}`,
          metadata: {
            title: item.title,
            nasaId: item.nasa_id,
            center: item.center || "",
            type: "library",
          },
        });

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
  console.log(`Papers collected: ${stats.papersCollected}`);
  console.log(`Videos collected: ${stats.videosCollected}`);
  console.log(`NASA items collected: ${stats.nasaItemsCollected}`);
  console.log(`Total items: ${stats.papersCollected + stats.videosCollected + stats.nasaItemsCollected}`);
  console.log(`Duration: ${duration}s`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
    stats.errors.forEach((error) => console.log(`  - ${error}`));
  }

  console.log("=".repeat(60));
}

// Run crawler on schedule (24/7 mode)
async function runScheduled() {
  console.log("=".repeat(60));
  console.log("AstroGroot Crawler - Scheduled Mode");
  console.log(`Running every ${CRAWLER_INTERVAL_HOURS} hours`);
  console.log("=".repeat(60));

  while (true) {
    const startTime = Date.now();
    console.log(`\n🕐 Starting crawl at ${new Date().toISOString()}`);

    try {
      const stats = await runCrawler();
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

      console.log("\n✅ Crawl completed");
      console.log(
        `Collected: ${stats.papersCollected} papers, ${stats.videosCollected} videos, ${stats.nasaItemsCollected} NASA items`,
      );
      console.log(`Duration: ${duration} minutes`);

      if (stats.errors.length > 0) {
        console.log(`⚠️  Encountered ${stats.errors.length} errors`);
      }
    } catch (error) {
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
