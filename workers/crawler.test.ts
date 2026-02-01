import { assertEquals } from "jsr:@std/assert";
import {
  runCrawler,
  type CrawlerDeps,
  type CrawlerStats,
} from "./crawler.ts";
import type { ArxivEntry } from "../lib/collectors/arxiv.ts";
import type { ApodData, NasaAsset } from "../lib/collectors/nasa.ts";
import type { ProcessMultilingualResult } from "../lib/ai/processor.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n.ts";

// --- Mocks (minimal shape; cast to CrawlerDeps so we don't need full VectorStore/db) ---

const asyncNoop = async () => {};

function createMockDb() {
  return {
    query: {
      papers: { findFirst: async () => undefined },
      videos: { findFirst: async () => undefined },
      nasaContent: { findFirst: async () => undefined },
    },
    insert: () => ({ values: asyncNoop }),
  };
}

const mockStore = { add: asyncNoop };

function createMockCollections() {
  const byLocale = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, mockStore]),
  ) as Record<(typeof SUPPORTED_LOCALES)[number], { add: typeof asyncNoop }>;
  return {
    papers: byLocale,
    videos: byLocale,
    nasa: byLocale,
  };
}

function createMockProcessMultilingual(
  result: ProcessMultilingualResult = {
    baseSummary: "Test summary",
    translations: [
      { lang: "en", title: "Test title", summary: "Test summary" },
      { lang: "zh-TW", title: "測試標題", summary: "測試摘要" },
      { lang: "zh-CN", title: "测试标题", summary: "测试摘要" },
    ],
  },
) {
  return async (): Promise<ProcessMultilingualResult> => result;
}

const emptyArxiv: ArxivEntry[] = [];
const onePaper: ArxivEntry[] = [
  {
    id: "2401.00001",
    title: "Test Paper Title",
    summary: "Abstract here.",
    authors: ["Alice", "Bob"],
    published: "2024-01-01T00:00:00Z",
    categories: ["astro-ph.CO"],
    arxivUrl: "https://arxiv.org/abs/2401.00001",
  },
];

const emptyVideoList: Array<{ videoId: string; title: string; channelName: string }> = [];

const emptyNasa = { apod: null as ApodData | null, libraryItems: [] as NasaAsset[] };

const oneNasaLibraryItem: NasaAsset = {
  href: "https://images-assets.nasa.gov/foo",
  nasa_id: "test-nasa-1",
  title: "Test NASA Image",
  description: "Description",
  date_created: "2024-01-01",
  media_type: "image",
  center: "GSFC",
};

// --- Tests ---

Deno.test("runCrawler with empty mocks returns zero counts and no errors", async () => {
  const deps = {
    db: createMockDb(),
    initializeCollections: async () => createMockCollections(),
    processMultilingualContent: createMockProcessMultilingual(),
    collectAstronomyPapers: async () => emptyArxiv,
    collectAstronomyVideos: async () => emptyVideoList,
    fetchCompleteVideoData: async () => {
      throw new Error("should not be called");
    },
    collectNasaContent: async () => emptyNasa,
  } as unknown as CrawlerDeps;

  const stats = await runCrawler(deps);

  assertEquals(stats.papersCollected, 0);
  assertEquals(stats.videosCollected, 0);
  assertEquals(stats.nasaItemsCollected, 0);
  assertEquals(stats.errors.length, 0);
});

Deno.test("runCrawler with one arXiv paper increments papersCollected", async () => {
  const deps = {
    db: createMockDb(),
    initializeCollections: async () => createMockCollections(),
    processMultilingualContent: createMockProcessMultilingual(),
    collectAstronomyPapers: async () => onePaper,
    collectAstronomyVideos: async () => emptyVideoList,
    fetchCompleteVideoData: async () => {
      throw new Error("should not be called");
    },
    collectNasaContent: async () => emptyNasa,
  } as unknown as CrawlerDeps;

  const stats = await runCrawler(deps);

  assertEquals(stats.papersCollected, 1);
  assertEquals(stats.videosCollected, 0);
  assertEquals(stats.nasaItemsCollected, 0);
  assertEquals(stats.errors.length, 0);
});

Deno.test("runCrawler with one video increments videosCollected", async () => {
  const videoList = [
    { videoId: "abc123", title: "Test Video", channelName: "Channel" },
  ];
  const deps = {
    db: createMockDb(),
    initializeCollections: async () => createMockCollections(),
    processMultilingualContent: createMockProcessMultilingual(),
    collectAstronomyPapers: async () => emptyArxiv,
    collectAstronomyVideos: async () => videoList,
    fetchCompleteVideoData: async () => ({
      metadata: {
        id: "abc123",
        title: "Test Video",
        channelName: "Channel",
        publishedAt: "2024-01-01T00:00:00Z",
        thumbnailUrl: "https://example.com/thumb.jpg",
      },
      transcript: [],
      fullText: "Transcript text",
    }),
    collectNasaContent: async () => emptyNasa,
  } as unknown as CrawlerDeps;

  const stats = await runCrawler(deps);

  assertEquals(stats.papersCollected, 0);
  assertEquals(stats.videosCollected, 1);
  assertEquals(stats.nasaItemsCollected, 0);
  assertEquals(stats.errors.length, 0);
});

Deno.test("runCrawler with APOD increments nasaItemsCollected", async () => {
  const apod: ApodData = {
    date: "2024-01-01",
    title: "Test APOD",
    explanation: "Explanation text",
    media_type: "image",
    url: "https://example.com/apod.jpg",
  };
  const deps = {
    db: createMockDb(),
    initializeCollections: async () => createMockCollections(),
    processMultilingualContent: createMockProcessMultilingual(),
    collectAstronomyPapers: async () => emptyArxiv,
    collectAstronomyVideos: async () => emptyVideoList,
    fetchCompleteVideoData: async () => {
      throw new Error("should not be called");
    },
    collectNasaContent: async () => ({ apod, libraryItems: [] }),
  } as unknown as CrawlerDeps;

  const stats = await runCrawler(deps);

  assertEquals(stats.papersCollected, 0);
  assertEquals(stats.videosCollected, 0);
  assertEquals(stats.nasaItemsCollected, 1);
  assertEquals(stats.errors.length, 0);
});

Deno.test("runCrawler with NASA library item increments nasaItemsCollected", async () => {
  const deps = {
    db: createMockDb(),
    initializeCollections: async () => createMockCollections(),
    processMultilingualContent: createMockProcessMultilingual(),
    collectAstronomyPapers: async () => emptyArxiv,
    collectAstronomyVideos: async () => emptyVideoList,
    fetchCompleteVideoData: async () => {
      throw new Error("should not be called");
    },
    collectNasaContent: async () => ({
      apod: null,
      libraryItems: [oneNasaLibraryItem],
    }),
  } as unknown as CrawlerDeps;

  const stats = await runCrawler(deps);

  assertEquals(stats.papersCollected, 0);
  assertEquals(stats.videosCollected, 0);
  assertEquals(stats.nasaItemsCollected, 1);
  assertEquals(stats.errors.length, 0);
});

Deno.test("runCrawler records errors when processMultilingualContent throws", async () => {
  const deps = {
    db: createMockDb(),
    initializeCollections: async () => createMockCollections(),
    processMultilingualContent: async () => {
      throw new Error("AI processing failed");
    },
    collectAstronomyPapers: async () => onePaper,
    collectAstronomyVideos: async () => emptyVideoList,
    fetchCompleteVideoData: async () => {
      throw new Error("should not be called");
    },
    collectNasaContent: async () => emptyNasa,
  } as unknown as CrawlerDeps;

  const stats = await runCrawler(deps);

  assertEquals(stats.papersCollected, 0);
  assertEquals(stats.errors.length, 1);
  assertEquals(stats.errors[0].startsWith("Paper 2401.00001:"), true);
});

Deno.test("CrawlerStats has expected shape", () => {
  const stats: CrawlerStats = {
    papersCollected: 0,
    videosCollected: 0,
    nasaItemsCollected: 0,
    errors: [],
  };
  assertEquals(typeof stats.papersCollected, "number");
  assertEquals(typeof stats.videosCollected, "number");
  assertEquals(typeof stats.nasaItemsCollected, "number");
  assertEquals(Array.isArray(stats.errors), true);
});
