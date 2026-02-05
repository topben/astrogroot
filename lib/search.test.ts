import { assertEquals } from "jsr:@std/assert@1";
import { searchLibrary } from "./search.ts";
import type { Locale } from "./i18n.ts";

function createCollections(options: {
  papersQuery?: () => Promise<{ ids: string[][]; distances: number[][] }>;
  videosQuery?: () => Promise<{ ids: string[][]; distances: number[][] }>;
  nasaQuery?: () => Promise<{ ids: string[][]; distances: number[][] }>;
}) {
  const queryPapers = options.papersQuery ??
    (() => Promise.resolve({ ids: [[]], distances: [[]] }));
  const queryVideos = options.videosQuery ??
    (() => Promise.resolve({ ids: [[]], distances: [[]] }));
  const queryNasa = options.nasaQuery ??
    (() => Promise.resolve({ ids: [[]], distances: [[]] }));

  const byLocale = (query: () => Promise<{ ids: string[][]; distances: number[][] }>) =>
    ({ en: { query } } as Record<Locale, { query: typeof query }>);

  return {
    papers: byLocale(queryPapers),
    videos: byLocale(queryVideos),
    nasa: byLocale(queryNasa),
  };
}

function createLegacyCollections(options?: {
  papersQuery?: () => Promise<{ ids: string[][]; distances: number[][] }>;
  videosQuery?: () => Promise<{ ids: string[][]; distances: number[][] }>;
  nasaQuery?: () => Promise<{ ids: string[][]; distances: number[][] }>;
}) {
  return {
    papers: { query: options?.papersQuery ?? (() => Promise.resolve({ ids: [[]], distances: [[]] })) },
    videos: { query: options?.videosQuery ?? (() => Promise.resolve({ ids: [[]], distances: [[]] })) },
    nasa: { query: options?.nasaQuery ?? (() => Promise.resolve({ ids: [[]], distances: [[]] })) },
  };
}

function createDbMock(options?: {
  papersFindMany?: () => Promise<unknown[]>;
  videosFindMany?: () => Promise<unknown[]>;
  nasaFindMany?: () => Promise<unknown[]>;
}) {
  return {
    query: {
      papers: { findMany: options?.papersFindMany ?? (() => Promise.resolve([])) },
      videos: {
        findMany: options?.videosFindMany ?? (() => Promise.resolve([])),
      },
      nasaContent: {
        findMany: options?.nasaFindMany ?? (() => Promise.resolve([])),
      },
      translations: { findMany: () => Promise.resolve([]) },
    },
  };
}

Deno.test("searchLibrary returns empty results for empty query", async () => {
  const result = await searchLibrary(
    { q: "", type: "all", locale: "en" },
    {
      db: createDbMock() as unknown as typeof import("../db/client.ts").db,
      initializeCollections: (() => Promise.reject(new Error("should not be called"))) as unknown as typeof import("./vector.ts").initializeCollections,
      initializeLegacyCollections: (() => Promise.reject(new Error("should not be called"))) as unknown as typeof import("./vector.ts").initializeLegacyCollections,
    },
  );

  assertEquals(result.query, "");
  assertEquals(result.papers.length, 0);
  assertEquals(result.videos.length, 0);
  assertEquals(result.nasa.length, 0);
  assertEquals(result.total, 0);
});

Deno.test("searchLibrary searches all collection types when type=all", async () => {
  let papersQueried = false;
  let videosQueried = false;
  let nasaQueried = false;

  const collections = createCollections({
    papersQuery: () => { papersQueried = true; return Promise.resolve({ ids: [[]], distances: [[]] }); },
    videosQuery: () => { videosQueried = true; return Promise.resolve({ ids: [[]], distances: [[]] }); },
    nasaQuery: () => { nasaQueried = true; return Promise.resolve({ ids: [[]], distances: [[]] }); },
  });

  const legacyCollections = createLegacyCollections();

  await searchLibrary(
    { q: "test query", type: "all", locale: "en" },
    {
      db: createDbMock() as unknown as typeof import("../db/client.ts").db,
      initializeCollections: (() => Promise.resolve(
        collections as unknown as Awaited<ReturnType<typeof import("./vector.ts").initializeCollections>>,
      )) as unknown as typeof import("./vector.ts").initializeCollections,
      initializeLegacyCollections: (() => Promise.resolve(
        legacyCollections as unknown as Awaited<ReturnType<typeof import("./vector.ts").initializeLegacyCollections>>,
      )) as unknown as typeof import("./vector.ts").initializeLegacyCollections,
    },
  );

  assertEquals(papersQueried, true, "papers collection should be queried");
  assertEquals(videosQueried, true, "videos collection should be queried");
  assertEquals(nasaQueried, true, "nasa collection should be queried");
});

Deno.test("searchLibrary only searches papers when type=papers", async () => {
  let papersQueried = false;
  let videosQueried = false;
  let nasaQueried = false;

  const collections = createCollections({
    papersQuery: () => { papersQueried = true; return Promise.resolve({ ids: [[]], distances: [[]] }); },
    videosQuery: () => { videosQueried = true; return Promise.resolve({ ids: [[]], distances: [[]] }); },
    nasaQuery: () => { nasaQueried = true; return Promise.resolve({ ids: [[]], distances: [[]] }); },
  });

  const legacyCollections = createLegacyCollections();

  await searchLibrary(
    { q: "test query", type: "papers", locale: "en" },
    {
      db: createDbMock() as unknown as typeof import("../db/client.ts").db,
      initializeCollections: (() => Promise.resolve(
        collections as unknown as Awaited<ReturnType<typeof import("./vector.ts").initializeCollections>>,
      )) as unknown as typeof import("./vector.ts").initializeCollections,
      initializeLegacyCollections: (() => Promise.resolve(
        legacyCollections as unknown as Awaited<ReturnType<typeof import("./vector.ts").initializeLegacyCollections>>,
      )) as unknown as typeof import("./vector.ts").initializeLegacyCollections,
    },
  );

  assertEquals(papersQueried, true, "papers collection should be queried");
  assertEquals(videosQueried, false, "videos collection should NOT be queried");
  assertEquals(nasaQueried, false, "nasa collection should NOT be queried");
});

Deno.test("searchLibrary paginates combined results and returns pagination info", async () => {
  const ids = ["p1", "p2", "p3", "p4", "p5"];
  const distances = [0.0, 0.4, 0.8, 1.2, 1.6]; // higher distance => lower score
  const collections = createCollections({
    papersQuery: () => Promise.resolve({ ids: [ids], distances: [distances] }),
  });
  const legacyCollections = createLegacyCollections();
  const dbMock = createDbMock({
    papersFindMany: () =>
      Promise.resolve(
        ids.map((id, i) => ({
          id,
          title: `Paper ${i + 1}`,
          summary: "",
          abstract: "",
          arxivUrl: "",
          pdfUrl: "",
          publishedDate: "2024-01-01",
        })),
      ),
  });

  const result = await searchLibrary(
    { q: "zz", type: "papers", locale: "en", limit: 2, page: 2 },
    {
      db: dbMock as unknown as typeof import("../db/client.ts").db,
      initializeCollections: (() => Promise.resolve(
        collections as unknown as Awaited<ReturnType<typeof import("./vector.ts").initializeCollections>>,
      )) as unknown as typeof import("./vector.ts").initializeCollections,
      initializeLegacyCollections: (() => Promise.resolve(
        legacyCollections as unknown as Awaited<ReturnType<typeof import("./vector.ts").initializeLegacyCollections>>,
      )) as unknown as typeof import("./vector.ts").initializeLegacyCollections,
    },
  );

  assertEquals(result.total, 4);
  assertEquals(result.papers.map((p) => p.id), ["p3", "p4"]);
  assertEquals(result.pagination?.page, 2);
  assertEquals(result.pagination?.perPage, 2);
  assertEquals(result.pagination?.totalPages, 2);
  assertEquals(result.pagination?.hasPrev, true);
  assertEquals(result.pagination?.hasNext, false);
});
