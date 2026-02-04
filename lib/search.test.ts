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

function createDbMock(options?: {
  videosFindMany?: () => Promise<unknown[]>;
  nasaFindMany?: () => Promise<unknown[]>;
}) {
  return {
    query: {
      papers: { findMany: () => Promise.resolve([]) },
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

Deno.test("searchLibrary in production skips video and NASA searches for type=all", async () => {
  const collections = createCollections({
    papersQuery: () => Promise.resolve({ ids: [["paper-1"]], distances: [[0.1]] }),
    videosQuery: () => Promise.reject(new Error("videos query should not run")),
    nasaQuery: () => Promise.reject(new Error("nasa query should not run")),
  });
  const dbMock = createDbMock({
    videosFindMany: () => Promise.reject(new Error("videos findMany should not run")),
    nasaFindMany: () => Promise.reject(new Error("nasa findMany should not run")),
  });

  const result = await searchLibrary(
    { q: "test query", type: "all", locale: "en" },
    {
      environment: "production",
      db: dbMock as unknown as typeof import("../db/client.ts").db,
      initializeCollections: (() => Promise.resolve(
        collections as unknown as Awaited<ReturnType<typeof import("./vector.ts").initializeCollections>>,
      )) as unknown as typeof import("./vector.ts").initializeCollections,
      initializeLegacyCollections: ((
        () => Promise.reject(new Error("legacy collections should not run"))
      )) as unknown as typeof import("./vector.ts").initializeLegacyCollections,
    },
  );

  assertEquals(result.videos.length, 0);
  assertEquals(result.nasa.length, 0);
});

Deno.test("searchLibrary in production short-circuits when only videos or nasa requested", async () => {
  const resultVideos = await searchLibrary(
    { q: "test query", type: "videos", locale: "en" },
    {
      environment: "production",
      initializeCollections: ((
        () => Promise.reject(new Error("collections should not run"))
      )) as unknown as typeof import("./vector.ts").initializeCollections,
      initializeLegacyCollections: ((
        () => Promise.reject(new Error("legacy collections should not run"))
      )) as unknown as typeof import("./vector.ts").initializeLegacyCollections,
    },
  );
  assertEquals(resultVideos.videos.length, 0);
  assertEquals(resultVideos.nasa.length, 0);

  const resultNasa = await searchLibrary(
    { q: "test query", type: "nasa", locale: "en" },
    {
      environment: "production",
      initializeCollections: ((
        () => Promise.reject(new Error("collections should not run"))
      )) as unknown as typeof import("./vector.ts").initializeCollections,
      initializeLegacyCollections: ((
        () => Promise.reject(new Error("legacy collections should not run"))
      )) as unknown as typeof import("./vector.ts").initializeLegacyCollections,
    },
  );
  assertEquals(resultNasa.videos.length, 0);
  assertEquals(resultNasa.nasa.length, 0);
});
