import { db } from "../db/client.ts";
import { papers, videos, nasaContent, translations } from "../db/schema.ts";
import { inArray, and, eq, like, or } from "drizzle-orm";
import { initializeCollections, initializeLegacyCollections } from "./vector.ts";
import type { Locale } from "./i18n.ts";
import { SUPPORTED_LOCALES } from "./i18n.ts";

export type SearchType = "all" | "papers" | "videos" | "nasa";

export interface SearchResultItem {
  type: "paper" | "video" | "nasa";
  id: string;
  title: string;
  snippet?: string;
  score?: number;
  url?: string;
  publishedDate?: string;
  meta?: Record<string, unknown>;
  /** True if this result is below the relevance threshold (shown as "related" content) */
  lowRelevance?: boolean;
}

export interface SearchResponse {
  query: string;
  papers: SearchResultItem[];
  videos: SearchResultItem[];
  nasa: SearchResultItem[];
  total: number;
  /** True if no highly relevant results were found and showing related content instead */
  showingRelated?: boolean;
  /** Pagination info */
  pagination?: {
    page: number;
    perPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const DEFAULT_LIMIT = 20;
const PER_COLLECTION_LIMIT = 15;
const MAX_COLLECTION_LIMIT = 60;
const DEFAULT_LOCALE: Locale = "en";
const MIN_RELEVANCE_SCORE = 0.15;

export interface SearchDeps {
  db?: typeof db;
  initializeCollections?: typeof initializeCollections;
  initializeLegacyCollections?: typeof initializeLegacyCollections;
}

/** Run vector search in the given locale's collections; then load full rows and localized title/snippet from DB. */
export async function searchLibrary(params: {
  q: string;
  type?: SearchType;
  limit?: number;
  page?: number;
  locale?: Locale;
  dateFrom?: string;
  dateTo?: string;
}, deps?: SearchDeps): Promise<SearchResponse> {
  const { q, type = "all", limit = DEFAULT_LIMIT, page = 1, locale: requestedLocale, dateFrom, dateTo } =
    params;
  // Video and NASA search now enabled in all environments
  // (previously disabled in production when ChromaDB collections were empty)
  const db_ = deps?.db ?? db;
  const initializeCollections_ = deps?.initializeCollections ?? initializeCollections;
  const initializeLegacyCollections_ = deps?.initializeLegacyCollections ?? initializeLegacyCollections;
  const locale = requestedLocale && SUPPORTED_LOCALES.includes(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE;

  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const normalizedDateFrom = dateFrom && dateOnlyPattern.test(dateFrom) ? dateFrom : undefined;
  const normalizedDateTo = dateTo && dateOnlyPattern.test(dateTo) ? dateTo : undefined;

  const trimmed = q.trim();
  if (!trimmed) {
    return { query: trimmed, papers: [], videos: [], nasa: [], total: 0 };
  }

  const searchPapers = type === "all" || type === "papers";
  const searchVideos = type === "all" || type === "videos";
  const searchNasa = type === "all" || type === "nasa";

  if (!searchPapers && !searchVideos && !searchNasa) {
    return { query: trimmed, papers: [], videos: [], nasa: [], total: 0 };
  }

  const perPage = Math.max(1, limit);
  const requestedResults = perPage * Math.max(1, page);
  const collections = await initializeCollections_();
  const n = Math.min(MAX_COLLECTION_LIMIT, Math.max(PER_COLLECTION_LIMIT, requestedResults));
  const paperIds: string[] = [];
  const videoIds: string[] = [];
  const nasaIds: string[] = [];
  const paperScores: Record<string, number> = {};
  const videoScores: Record<string, number> = {};
  const nasaScores: Record<string, number> = {};

  const [paperRes, videoRes, nasaRes] = await Promise.all([
    searchPapers
      ? collections.papers[locale].query({ queryText: trimmed, nResults: n })
      : Promise.resolve({ ids: [[]], distances: [[]] }),
    searchVideos
      ? collections.videos[locale].query({ queryText: trimmed, nResults: n })
      : Promise.resolve({ ids: [[]], distances: [[]] }),
    searchNasa
      ? collections.nasa[locale].query({ queryText: trimmed, nResults: n })
      : Promise.resolve({ ids: [[]], distances: [[]] }),
  ]);

  if (searchPapers && paperRes.ids[0]?.length) {
    paperRes.ids[0].forEach((id, i) => {
      paperIds.push(id);
      const dist = paperRes.distances?.[0]?.[i];
      if (dist != null) paperScores[id] = 1 - dist / 2;
    });
  }
  if (searchVideos && videoRes.ids[0]?.length) {
    videoRes.ids[0].forEach((id, i) => {
      videoIds.push(id);
      const dist = videoRes.distances?.[0]?.[i];
      if (dist != null) videoScores[id] = 1 - dist / 2;
    });
  }
  if (searchNasa && nasaRes.ids[0]?.length) {
    nasaRes.ids[0].forEach((id, i) => {
      nasaIds.push(id);
      const dist = nasaRes.distances?.[0]?.[i];
      if (dist != null) nasaScores[id] = 1 - dist / 2;
    });
  }

  // Fallback 1: when using zh-TW/zh-CN and locale-specific collection has no docs, query English collection
  let hasNoResults = paperIds.length === 0 && videoIds.length === 0 && nasaIds.length === 0;
  if (locale !== "en" && hasNoResults) {
    const [enPaperRes, enVideoRes, enNasaRes] = await Promise.all([
      searchPapers ? collections.papers["en"].query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
      searchVideos ? collections.videos["en"].query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
      searchNasa ? collections.nasa["en"].query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
    ]);
    if (searchPapers && enPaperRes.ids[0]?.length) {
      enPaperRes.ids[0].forEach((id, i) => {
        paperIds.push(id);
        const dist = enPaperRes.distances?.[0]?.[i];
        if (dist != null) paperScores[id] = 1 - dist / 2;
      });
    }
    if (searchVideos && enVideoRes.ids[0]?.length) {
      enVideoRes.ids[0].forEach((id, i) => {
        videoIds.push(id);
        const dist = enVideoRes.distances?.[0]?.[i];
        if (dist != null) videoScores[id] = 1 - dist / 2;
      });
    }
    if (searchNasa && enNasaRes.ids[0]?.length) {
      enNasaRes.ids[0].forEach((id, i) => {
        nasaIds.push(id);
        const dist = enNasaRes.distances?.[0]?.[i];
        if (dist != null) nasaScores[id] = 1 - dist / 2;
      });
    }
  }

  // Fallback 2: query legacy collections (pre-i18n) if still no results
  hasNoResults = paperIds.length === 0 && videoIds.length === 0 && nasaIds.length === 0;
  if (hasNoResults) {
    const legacy = await initializeLegacyCollections_();
    const [legacyPaperRes, legacyVideoRes, legacyNasaRes] = await Promise.all([
      searchPapers ? legacy.papers.query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
      searchVideos ? legacy.videos.query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
      searchNasa ? legacy.nasa.query({ queryText: trimmed, nResults: n }) : Promise.resolve({ ids: [[]], distances: [[]] }),
    ]);
    if (searchPapers && legacyPaperRes.ids[0]?.length) {
      legacyPaperRes.ids[0].forEach((id, i) => {
        paperIds.push(id);
        const dist = legacyPaperRes.distances?.[0]?.[i];
        if (dist != null) paperScores[id] = 1 - dist / 2;
      });
    }
    if (searchVideos && legacyVideoRes.ids[0]?.length) {
      legacyVideoRes.ids[0].forEach((id, i) => {
        videoIds.push(id);
        const dist = legacyVideoRes.distances?.[0]?.[i];
        if (dist != null) videoScores[id] = 1 - dist / 2;
      });
    }
    if (searchNasa && legacyNasaRes.ids[0]?.length) {
      legacyNasaRes.ids[0].forEach((id, i) => {
        nasaIds.push(id);
        const dist = legacyNasaRes.distances?.[0]?.[i];
        if (dist != null) nasaScores[id] = 1 - dist / 2;
      });
    }
  }

  // Fallback 3: keyword-based SQL search PER TYPE when vector search returns nothing
  // or when the best vector score is too low (below MIN_RELEVANCE_SCORE)
  // This catches cases where the query term isn't well-represented in vector embeddings
  const bestPaperScore = Math.max(0, ...Object.values(paperScores));
  const bestVideoScore = Math.max(0, ...Object.values(videoScores));
  const bestNasaScore = Math.max(0, ...Object.values(nasaScores));
  const needsPaperFallback = paperIds.length === 0 || bestPaperScore < MIN_RELEVANCE_SCORE;
  const needsVideoFallback = videoIds.length === 0 || bestVideoScore < MIN_RELEVANCE_SCORE;
  const needsNasaFallback = nasaIds.length === 0 || bestNasaScore < MIN_RELEVANCE_SCORE;

  // Build keyword patterns: for Chinese queries, generate patterns for each bigram
  const hasChinese = /[\u4e00-\u9fff]/.test(trimmed);
  const keywordPatterns: string[] = [`%${trimmed}%`];
  if (hasChinese && trimmed.length >= 2) {
    for (let i = 0; i < trimmed.length - 1; i++) {
      const bigram = trimmed.slice(i, i + 2);
      if (/[\u4e00-\u9fff]/.test(bigram)) {
        keywordPatterns.push(`%${bigram}%`);
      }
    }
  }
  const uniquePatterns = [...new Set(keywordPatterns)];
  const buildLikeOr = (...columns: Parameters<typeof like>[0][]) =>
    or(...columns.flatMap((col) => uniquePatterns.map((p) => like(col, p))));

  const needsTranslationFallback = locale !== "en" && (needsPaperFallback || needsVideoFallback || needsNasaFallback);

  const [keywordPapers, keywordVideos, keywordNasa, keywordTranslations] = await Promise.all([
    searchPapers && needsPaperFallback
      ? db_.query.papers.findMany({
          where: buildLikeOr(papers.title, papers.summary, papers.abstract),
          limit: n,
        })
      : [],
    searchVideos && needsVideoFallback
      ? db_.query.videos.findMany({
          where: buildLikeOr(videos.title, videos.summary),
          limit: n,
        })
      : [],
    searchNasa && needsNasaFallback
      ? db_.query.nasaContent.findMany({
          where: buildLikeOr(nasaContent.title, nasaContent.summary, nasaContent.explanation),
          limit: n,
        })
      : [],
    // Search translations table for Chinese keyword matches
    needsTranslationFallback
      ? db_.query.translations.findMany({
          where: and(
            eq(translations.lang, locale),
            buildLikeOr(translations.title, translations.summary),
          ),
          columns: { itemType: true, itemId: true },
          limit: n * 3,
        })
      : [],
  ]);
  // Add keyword results with a base score of 0.5 (keyword match)
  keywordPapers.forEach((p) => {
    paperIds.push(p.id);
    paperScores[p.id] = 0.5;
  });
  keywordVideos.forEach((v) => {
    videoIds.push(v.id);
    videoScores[v.id] = 0.5;
  });
  keywordNasa.forEach((item) => {
    nasaIds.push(item.id);
    nasaScores[item.id] = 0.5;
  });
  // Merge translation matches into the correct type lists
  for (const t of keywordTranslations) {
    if (t.itemType === "paper" && searchPapers) {
      paperIds.push(t.itemId);
      if (!paperScores[t.itemId]) paperScores[t.itemId] = 0.5;
    } else if (t.itemType === "video" && searchVideos) {
      videoIds.push(t.itemId);
      if (!videoScores[t.itemId]) videoScores[t.itemId] = 0.5;
    } else if (t.itemType === "nasa" && searchNasa) {
      nasaIds.push(t.itemId);
      if (!nasaScores[t.itemId]) nasaScores[t.itemId] = 0.5;
    }
  }

  const [paperRows, videoRows, nasaRows] = await Promise.all([
    paperIds.length
      ? db_.query.papers.findMany({ where: inArray(papers.id, paperIds) })
      : [],
    videoIds.length
      ? db_.query.videos.findMany({ where: inArray(videos.id, videoIds) })
      : [],
    nasaIds.length
      ? db_.query.nasaContent.findMany({ where: inArray(nasaContent.id, nasaIds) })
      : [],
  ]);

  const orderByIds = <T extends { id: string }>(rows: T[], ids: string[]) => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is T => r != null);
  };

  const paperOrdered = orderByIds(paperRows, paperIds);
  const videoOrdered = orderByIds(videoRows, videoIds);
  const nasaOrdered = orderByIds(nasaRows, nasaIds);

  const toDateOnly = (value: Date | string | null | undefined): string | null => {
    if (!value) return null;
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  };

  const inDateRange = (dateOnly: string | null): boolean => {
    if (!normalizedDateFrom && !normalizedDateTo) return true;
    if (!dateOnly) return false;
    if (normalizedDateFrom && dateOnly < normalizedDateFrom) return false;
    if (normalizedDateTo && dateOnly > normalizedDateTo) return false;
    return true;
  };

  const filteredPapers = paperOrdered.filter((row) =>
    inDateRange(toDateOnly(row.publishedDate))
  );
  const filteredVideos = videoOrdered.filter((row) =>
    inDateRange(toDateOnly(row.publishedDate))
  );
  const filteredNasa = nasaOrdered.filter((row) => inDateRange(toDateOnly(row.date)));

  // Load localized title/summary from translations when not English
  const transByKey = new Map<string, { title: string | null; summary: string | null }>();
  if (locale !== "en" && (filteredPapers.length || filteredVideos.length || filteredNasa.length)) {
    const allIds = [
      ...filteredPapers.map((r) => ({ type: "paper" as const, id: r.id })),
      ...filteredVideos.map((r) => ({ type: "video" as const, id: r.id })),
      ...filteredNasa.map((r) => ({ type: "nasa" as const, id: r.id })),
    ];
    const transRows = await db_.query.translations.findMany({
      where: and(
        eq(translations.lang, locale),
        inArray(
          translations.itemId,
          allIds.map((x) => x.id),
        ),
      ),
      columns: { itemType: true, itemId: true, title: true, summary: true },
    });
    for (const t of transRows) {
      transByKey.set(`${t.itemType}:${t.itemId}`, { title: t.title, summary: t.summary });
    }
  }

  const getTrans = (itemType: "paper" | "video" | "nasa", id: string) =>
    transByKey.get(`${itemType}:${id}`);

  const toPaperItem = (row: (typeof paperRows)[0]): SearchResultItem => {
    const trans = getTrans("paper", row.id);
    return {
      type: "paper",
      id: row.id,
      title: (trans?.title ?? row.title) || row.title,
      snippet: (trans?.summary ?? row.summary ?? row.abstract?.slice(0, 200)) ?? undefined,
      score: paperScores[row.id],
      url: row.arxivUrl ?? row.pdfUrl ?? undefined,
      publishedDate: row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined,
      meta: { authors: row.authors, categories: row.categories },
    };
  };
  const toVideoItem = (row: (typeof videoRows)[0]): SearchResultItem => {
    const trans = getTrans("video", row.id);
    return {
      type: "video",
      id: row.id,
      title: (trans?.title ?? row.title) || row.title,
      snippet: (trans?.summary ?? row.summary ?? row.description?.slice(0, 200)) ?? undefined,
      score: videoScores[row.id],
      url: row.videoUrl,
      publishedDate: row.publishedDate ? new Date(row.publishedDate).toISOString().slice(0, 10) : undefined,
      meta: { channelName: row.channelName },
    };
  };
  const toNasaItem = (row: (typeof nasaRows)[0]): SearchResultItem => {
    const trans = getTrans("nasa", row.id);
    return {
      type: "nasa",
      id: row.id,
      title: (trans?.title ?? row.title) || row.title,
      snippet: (trans?.summary ?? row.summary ?? row.explanation ?? row.description?.slice(0, 200)) ?? undefined,
      score: nasaScores[row.id],
      url: row.url,
      publishedDate: row.date ? new Date(row.date).toISOString().slice(0, 10) : undefined,
      meta: { contentType: row.contentType },
    };
  };

  // Chinese-English keyword mappings for cross-language search
  // Covers Traditional (zh-TW) and Simplified (zh-CN) variants
  const keywordMappings: Record<string, string[]> = {
    // --- Rocket & Propulsion ---
    "火箭": ["rocket", "launch vehicle", "booster"],
    "引擎": ["engine", "motor"],
    "發動機": ["engine", "motor"],
    "发动机": ["engine", "motor"],
    "推進": ["propulsion", "thrust"],
    "推进": ["propulsion", "thrust"],
    "推進器": ["thruster", "propulsion system"],
    "推进器": ["thruster", "propulsion system"],
    "推力": ["thrust", "propulsive force"],
    "燃料": ["fuel", "propellant"],
    "推進劑": ["propellant"],
    "推进剂": ["propellant"],
    "氧化劑": ["oxidizer"],
    "氧化剂": ["oxidizer"],
    "液態氧": ["liquid oxygen", "LOX"],
    "液态氧": ["liquid oxygen", "LOX"],
    "液態氫": ["liquid hydrogen", "LH2"],
    "液态氢": ["liquid hydrogen", "LH2"],
    "固態燃料": ["solid fuel", "solid propellant"],
    "固态燃料": ["solid fuel", "solid propellant"],
    "燃燒室": ["combustion chamber"],
    "燃烧室": ["combustion chamber"],
    "噴嘴": ["nozzle"],
    "喷嘴": ["nozzle"],
    "噴管": ["nozzle", "exhaust nozzle"],
    "喷管": ["nozzle", "exhaust nozzle"],
    "渦輪泵": ["turbopump"],
    "涡轮泵": ["turbopump"],
    "助推器": ["booster", "strap-on booster"],
    "級": ["stage"],
    "级": ["stage"],
    "多級火箭": ["multistage rocket"],
    "多级火箭": ["multistage rocket"],
    "比衝": ["specific impulse", "Isp"],
    "比冲": ["specific impulse", "Isp"],
    "降落傘": ["parachute", "recovery"],
    "降落伞": ["parachute", "recovery"],
    "回收": ["recovery", "reusable"],
    "再入": ["reentry", "re-entry"],
    "隔熱罩": ["heat shield", "thermal protection"],
    "隔热罩": ["heat shield", "thermal protection"],
    "整流罩": ["fairing", "payload fairing"],
    "點火": ["ignition"],
    "点火": ["ignition"],
    "發射": ["launch", "liftoff"],
    "发射": ["launch", "liftoff"],
    "發射台": ["launch pad", "launch site"],
    "发射台": ["launch pad", "launch site"],
    "酬載": ["payload"],
    "载荷": ["payload"],
    "有效載荷": ["payload"],
    "有效载荷": ["payload"],

    // --- Space & Orbital Mechanics ---
    "太空": ["space", "outer space"],
    "航太": ["aerospace", "space"],
    "航天": ["aerospace", "space"],
    "軌道": ["orbit", "orbital"],
    "轨道": ["orbit", "orbital"],
    "入軌": ["orbit insertion", "orbital insertion"],
    "入轨": ["orbit insertion", "orbital insertion"],
    "近地軌道": ["low earth orbit", "LEO"],
    "近地轨道": ["low earth orbit", "LEO"],
    "地球同步": ["geosynchronous", "GEO", "geostationary"],
    "轉移軌道": ["transfer orbit", "Hohmann"],
    "转移轨道": ["transfer orbit", "Hohmann"],
    "脫軌": ["deorbit", "de-orbit"],
    "脱轨": ["deorbit", "de-orbit"],
    "衛星": ["satellite"],
    "卫星": ["satellite"],
    "太空站": ["space station", "ISS"],
    "空间站": ["space station", "ISS"],
    "太空梭": ["space shuttle"],
    "航天飞机": ["space shuttle"],
    "太空船": ["spacecraft", "spaceship"],
    "飞船": ["spacecraft", "spaceship"],
    "太空艙": ["capsule", "space capsule"],
    "太空舱": ["capsule", "space capsule"],
    "對接": ["docking", "rendezvous"],
    "对接": ["docking", "rendezvous"],
    "太空漫步": ["spacewalk", "EVA", "extravehicular activity"],
    "太空人": ["astronaut", "cosmonaut"],
    "宇航员": ["astronaut", "cosmonaut"],
    "太空衣": ["spacesuit", "EVA suit"],
    "航天服": ["spacesuit", "EVA suit"],
    "失重": ["weightlessness", "microgravity", "zero gravity"],
    "微重力": ["microgravity"],

    // --- Astronomy & Astrophysics ---
    "天文": ["astronomy", "astronomical"],
    "天文學": ["astronomy"],
    "天文学": ["astronomy"],
    "天體物理": ["astrophysics"],
    "天体物理": ["astrophysics"],
    "宇宙": ["universe", "cosmos", "cosmology"],
    "宇宙學": ["cosmology"],
    "宇宙学": ["cosmology"],
    "黑洞": ["black hole"],
    "恆星": ["star", "stellar"],
    "恒星": ["star", "stellar"],
    "行星": ["planet", "planetary"],
    "系外行星": ["exoplanet", "extrasolar planet"],
    "星系": ["galaxy", "galactic"],
    "星雲": ["nebula"],
    "星云": ["nebula"],
    "超新星": ["supernova"],
    "脈衝星": ["pulsar"],
    "脉冲星": ["pulsar"],
    "中子星": ["neutron star"],
    "白矮星": ["white dwarf"],
    "紅巨星": ["red giant"],
    "红巨星": ["red giant"],
    "暗物質": ["dark matter"],
    "暗物质": ["dark matter"],
    "暗能量": ["dark energy"],
    "大爆炸": ["big bang"],
    "紅移": ["redshift"],
    "红移": ["redshift"],
    "藍移": ["blueshift"],
    "蓝移": ["blueshift"],
    "重力波": ["gravitational wave"],
    "引力波": ["gravitational wave"],
    "重力透鏡": ["gravitational lensing"],
    "引力透镜": ["gravitational lensing"],
    "類星體": ["quasar"],
    "类星体": ["quasar"],
    "磁星": ["magnetar"],
    "星團": ["star cluster"],
    "星团": ["star cluster"],
    "球狀星團": ["globular cluster"],
    "球状星团": ["globular cluster"],
    "星際": ["interstellar"],
    "星际": ["interstellar"],
    "星際介質": ["interstellar medium", "ISM"],
    "星际介质": ["interstellar medium", "ISM"],
    "吸積盤": ["accretion disk"],
    "吸积盘": ["accretion disk"],
    "事件視界": ["event horizon"],
    "事件视界": ["event horizon"],
    "奇點": ["singularity"],
    "奇点": ["singularity"],

    // --- Solar System ---
    "太陽": ["sun", "solar"],
    "太阳": ["sun", "solar"],
    "太陽系": ["solar system"],
    "太阳系": ["solar system"],
    "太陽風": ["solar wind"],
    "太阳风": ["solar wind"],
    "太陽閃焰": ["solar flare"],
    "太阳耀斑": ["solar flare"],
    "日冕": ["corona", "coronal"],
    "太陽能": ["solar energy", "solar power"],
    "太阳能": ["solar energy", "solar power"],
    "太陽能板": ["solar panel", "solar array"],
    "太阳能板": ["solar panel", "solar array"],
    "月球": ["moon", "lunar"],
    "火星": ["Mars", "Martian"],
    "木星": ["Jupiter", "Jovian"],
    "土星": ["Saturn"],
    "水星": ["Mercury"],
    "金星": ["Venus"],
    "天王星": ["Uranus"],
    "海王星": ["Neptune"],
    "冥王星": ["Pluto"],
    "小行星": ["asteroid"],
    "彗星": ["comet"],
    "隕石": ["meteorite", "meteor"],
    "陨石": ["meteorite", "meteor"],
    "流星": ["meteor", "shooting star"],
    "月食": ["lunar eclipse"],
    "日食": ["solar eclipse"],
    "潮汐": ["tidal", "tide"],

    // --- Instruments & Technology ---
    "望遠鏡": ["telescope"],
    "望远镜": ["telescope"],
    "光譜": ["spectrum", "spectroscopy", "spectral"],
    "光谱": ["spectrum", "spectroscopy", "spectral"],
    "紅外線": ["infrared", "IR"],
    "红外线": ["infrared", "IR"],
    "紫外線": ["ultraviolet", "UV"],
    "紫外线": ["ultraviolet", "UV"],
    "X射線": ["X-ray"],
    "X射线": ["X-ray"],
    "伽瑪射線": ["gamma ray"],
    "伽马射线": ["gamma ray"],
    "雷達": ["radar"],
    "雷达": ["radar"],
    "感測器": ["sensor", "detector"],
    "传感器": ["sensor", "detector"],
    "探測器": ["probe", "detector"],
    "探测器": ["probe", "detector"],
    "天線": ["antenna"],
    "天线": ["antenna"],
    "陀螺儀": ["gyroscope"],
    "陀螺仪": ["gyroscope"],
    "加速度計": ["accelerometer"],
    "加速度计": ["accelerometer"],
    "導航": ["navigation", "guidance"],
    "导航": ["navigation", "guidance"],
    "姿態控制": ["attitude control"],
    "姿态控制": ["attitude control"],
    "遙測": ["telemetry"],
    "遥测": ["telemetry"],

    // --- Missions & Programs ---
    "阿波羅": ["Apollo"],
    "阿波罗": ["Apollo"],
    "阿提米絲": ["Artemis"],
    "阿尔忒弥斯": ["Artemis"],
    "國際太空站": ["International Space Station", "ISS"],
    "国际空间站": ["International Space Station", "ISS"],
    "韋伯": ["Webb", "JWST", "James Webb"],
    "韦伯": ["Webb", "JWST", "James Webb"],
    "哈伯": ["Hubble", "HST"],
    "哈勃": ["Hubble", "HST"],
    "旅行者": ["Voyager"],
    "好奇號": ["Curiosity"],
    "好奇号": ["Curiosity"],
    "毅力號": ["Perseverance"],
    "毅力号": ["Perseverance"],
    "嫦娥": ["Chang'e"],
    "天問": ["Tianwen"],
    "天问": ["Tianwen"],

    // --- Physics & General Science ---
    "重力": ["gravity", "gravitational"],
    "引力": ["gravity", "gravitational"],
    "質量": ["mass"],
    "质量": ["mass"],
    "密度": ["density"],
    "溫度": ["temperature"],
    "温度": ["temperature"],
    "壓力": ["pressure"],
    "压力": ["pressure"],
    "輻射": ["radiation"],
    "辐射": ["radiation"],
    "磁場": ["magnetic field"],
    "磁场": ["magnetic field"],
    "電漿": ["plasma"],
    "等离子体": ["plasma"],
    "光年": ["light year", "light-year"],
    "天文單位": ["astronomical unit", "AU"],
    "天文单位": ["astronomical unit", "AU"],
    "紅外": ["infrared"],
    "红外": ["infrared"],

    // --- Aerodynamics & Engineering ---
    "空氣動力學": ["aerodynamics"],
    "空气动力学": ["aerodynamics"],
    "馬赫數": ["Mach number"],
    "马赫数": ["Mach number"],
    "超音速": ["supersonic"],
    "極超音速": ["hypersonic"],
    "高超音速": ["hypersonic"],
    "阻力": ["drag"],
    "升力": ["lift"],
    "熱傳導": ["heat transfer", "thermal conductivity"],
    "热传导": ["heat transfer", "thermal conductivity"],
    "冷卻": ["cooling", "regenerative cooling"],
    "冷却": ["cooling", "regenerative cooling"],
    "複合材料": ["composite material"],
    "复合材料": ["composite material"],
    "碳纖維": ["carbon fiber"],
    "碳纤维": ["carbon fiber"],
    "鈦合金": ["titanium alloy"],
    "钛合金": ["titanium alloy"],
  };

  const tokenizeQuery = (query: string): string[] => {
    const lower = query.toLowerCase();
    const terms: string[] = [];

    // Check for Chinese keywords and expand to English equivalents
    for (const [chinese, english] of Object.entries(keywordMappings)) {
      if (lower.includes(chinese.toLowerCase()) || lower.includes(chinese)) {
        terms.push(...english);
      }
    }

    if (/[\u4e00-\u9fff]/.test(lower)) {
      // Split Chinese text into individual characters and overlapping bigrams
      const chars: string[] = [];
      for (const ch of lower) {
        if (/[\u4e00-\u9fff]/.test(ch)) {
          chars.push(ch);
        }
      }
      // Add individual characters
      terms.push(...chars);
      // Add overlapping bigrams (most Chinese words are 2 chars)
      for (let i = 0; i < chars.length - 1; i++) {
        terms.push(chars[i] + chars[i + 1]);
      }
      // Keep the full query for exact matching
      terms.push(lower);
    } else {
      terms.push(...lower.split(/[^a-z0-9]+/i).filter((term) => term.length >= 2));
    }

    return [...new Set(terms)];
  };

  const computeKeywordScore = (text: string, terms: string[]): number => {
    if (terms.length === 0) return 0;
    const lowerText = text.toLowerCase();
    const hits = terms.filter((term) => lowerText.includes(term)).length;
    return hits / terms.length;
  };

  const rerank = (items: SearchResultItem[], keepLowRelevance = false): SearchResultItem[] => {
    const terms = tokenizeQuery(trimmed);
    const scored = items
      .map((item, index) => {
        const baseScore = Math.max(0, Math.min(1, item.score ?? 0));
        const haystack = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
        const keywordScore = computeKeywordScore(haystack, terms);
        // Higher weight for keyword match when vector score is low
        const combined = terms.length
          ? baseScore * 0.5 + keywordScore * 0.5
          : baseScore;
        const isLowRelevance = combined < MIN_RELEVANCE_SCORE;
        return {
          item: { ...item, score: combined, lowRelevance: isLowRelevance },
          index,
          combined,
          isLowRelevance
        };
      })
      .sort((a, b) => (b.combined - a.combined) || (a.index - b.index));

    // First pass: get only high-relevance items
    const highRelevance = scored.filter((entry) => !entry.isLowRelevance);

    // If keepLowRelevance is true, return all items (marking low relevance ones)
    // Otherwise only return high relevance items
    if (keepLowRelevance) {
      return scored.map((entry) => entry.item);
    }
    return highRelevance.map((entry) => entry.item);
  };

  // First pass: only high-relevance results
  let paperItems = rerank(filteredPapers.map(toPaperItem), false);
  let videoItems = rerank(filteredVideos.map(toVideoItem), false);
  let nasaItems = rerank(filteredNasa.map(toNasaItem), false);

  const hasHighRelevance = paperItems.length > 0 || videoItems.length > 0 || nasaItems.length > 0;
  let showingRelated = false;

  // If no high-relevance results, show low-relevance items marked as "related"
  if (!hasHighRelevance) {
    paperItems = rerank(filteredPapers.map(toPaperItem), true);
    videoItems = rerank(filteredVideos.map(toVideoItem), true);
    nasaItems = rerank(filteredNasa.map(toNasaItem), true);
    showingRelated = paperItems.length > 0 || videoItems.length > 0 || nasaItems.length > 0;
  }

  // Combine all results and sort by score for pagination
  const allItems = [
    ...paperItems,
    ...videoItems,
    ...nasaItems,
  ].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));
  const startIndex = (currentPage - 1) * perPage;
  const endIndex = startIndex + perPage;

  // Paginate the combined results
  const paginatedItems = allItems.slice(startIndex, endIndex);

  // Split paginated items back by type
  const paginatedPapers = paginatedItems.filter((item): item is SearchResultItem => item.type === "paper");
  const paginatedVideos = paginatedItems.filter((item): item is SearchResultItem => item.type === "video");
  const paginatedNasa = paginatedItems.filter((item): item is SearchResultItem => item.type === "nasa");

  return {
    query: trimmed,
    papers: paginatedPapers,
    videos: paginatedVideos,
    nasa: paginatedNasa,
    total: totalItems,
    showingRelated,
    pagination: {
      page: currentPage,
      perPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    },
  };
}
