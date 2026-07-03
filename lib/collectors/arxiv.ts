import { parseString } from "xml2js";
import { z } from "zod";

const ARXIV_API_BASE = "https://export.arxiv.org/api/query";

// arXiv entry schema
const ArxivEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  authors: z.array(z.string()),
  published: z.string(),
  updated: z.string().optional(),
  categories: z.array(z.string()),
  pdfUrl: z.string().optional(),
  arxivUrl: z.string(),
});

export type ArxivEntry = z.infer<typeof ArxivEntrySchema>;

// Parse XML response from arXiv
function parseArxivXml(xml: string): Promise<ArxivEntry[]> {
  return new Promise((resolve, reject) => {
    parseString(xml, (err: unknown, result: unknown) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const entries = (result as { feed?: { entry?: unknown } })?.feed?.entry || [];
        if (!Array.isArray(entries)) {
          resolve([]);
          return;
        }

        type ArxivRawEntry = {
          id?: string[];
          title?: string[];
          summary?: string[];
          author?: Array<{ name?: string[] }>;
          published?: string[];
          updated?: string[];
          category?: Array<{ $?: { term?: string } }>;
          link?: Array<{ $?: { title?: string; href?: string } }>;
        };
        const parsed = (entries as ArxivRawEntry[]).map((entry: ArxivRawEntry) => {
          // Extract ID (remove version info)
          const fullId = entry.id?.[0] || "";
          const id = fullId.split("/").pop()?.split("v")[0] || fullId;

          // Extract authors
          const authors = (entry.author || [])
            .map((a) => a.name?.[0])
            .filter((name): name is string => !!name);

          // Extract categories
          const categories = (entry.category || [])
            .map((c) => c.$?.term)
            .filter((term): term is string => !!term);

          // Extract links
          const pdfLink = entry.link?.find((l) => l.$?.title === "pdf");
          const arxivLink = entry.link?.find((l) => l.$?.title === undefined);

          return ArxivEntrySchema.parse({
            id,
            title: entry.title?.[0]?.trim() || "",
            summary: entry.summary?.[0]?.trim() || "",
            authors,
            published: entry.published?.[0] || "",
            updated: entry.updated?.[0],
            categories,
            pdfUrl: pdfLink?.$?.href,
            arxivUrl: arxivLink?.$?.href || `https://arxiv.org/abs/${id}`,
          });
        });

        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Search arXiv
export async function searchArxiv(params: {
  query: string;
  maxResults?: number;
  sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
  sortOrder?: "ascending" | "descending";
  start?: number;
  categories?: string[];
}): Promise<ArxivEntry[]> {
  const {
    query,
    maxResults = 10,
    sortBy = "submittedDate",
    sortOrder = "descending",
    start = 0,
    categories,
  } = params;

  // Build search query
  let searchQuery = query;
  if (categories && categories.length > 0) {
    const catQuery = categories.map((cat) => `cat:${cat}`).join(" OR ");
    searchQuery = `(${query}) AND (${catQuery})`;
  }

  const url = new URL(ARXIV_API_BASE);
  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("max_results", maxResults.toString());
  url.searchParams.set("sortBy", sortBy);
  url.searchParams.set("sortOrder", sortOrder);
  url.searchParams.set("start", start.toString());

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url.toString());
      if (response.ok) {
        const xml = await response.text();
        return await parseArxivXml(xml);
      }
      if (response.status >= 500 && attempt < maxAttempts) {
        const delay = attempt * 2000;
        console.warn(
          `arXiv API ${response.status}, retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error(`arXiv API error: ${response.statusText}`);
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error("Error searching arXiv:", error);
        throw error;
      }
      const delay = attempt * 2000;
      console.warn(`arXiv request failed, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return [];
}

// Get papers by specific arXiv IDs
export async function getArxivPapers(ids: string[]): Promise<ArxivEntry[]> {
  if (ids.length === 0) return [];

  const url = new URL(ARXIV_API_BASE);
  url.searchParams.set("id_list", ids.join(","));
  url.searchParams.set("max_results", ids.length.toString());

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.statusText}`);
    }

    const xml = await response.text();
    return await parseArxivXml(xml);
  } catch (error) {
    console.error("Error fetching arXiv papers:", error);
    throw error;
  }
}

// Format date as YYYYMMDD for arXiv query
function formatArxivDate(date: Date): string {
  return date.toISOString().split("T")[0].replace(/-/g, "");
}

// Generate monthly date segments for a given range
function generateDateSegments(daysBack: number): Array<{ start: Date; end: Date }> {
  const segments: Array<{ start: Date; end: Date }> = [];
  const now = new Date();
  const finalStart = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  // For short ranges (<=30 days), use a single segment
  if (daysBack <= 30) {
    segments.push({ start: finalStart, end: now });
    return segments;
  }

  // For longer ranges, split into monthly segments (newest first)
  let segmentEnd = now;
  while (segmentEnd > finalStart) {
    const segmentStart = new Date(segmentEnd);
    segmentStart.setMonth(segmentStart.getMonth() - 1);

    // Don't go before the final start date
    if (segmentStart < finalStart) {
      segmentStart.setTime(finalStart.getTime());
    }

    segments.push({ start: segmentStart, end: segmentEnd });

    // Move to next segment
    segmentEnd = new Date(segmentStart.getTime() - 1); // 1ms before segment start
  }

  return segments;
}

// Build an arXiv abstract-search OR-query from keyword phrases, e.g.
// (abs:"rocket propulsion" OR abs:"turbopump" OR ...)
function buildKeywordQuery(keywords: string[]): string {
  return `(${keywords.map((kw) => `abs:"${kw}"`).join(" OR ")})`;
}

// Query arXiv for a single date segment
async function queryArxivSegment(params: {
  categories: string[];
  keywords?: string[];
  startDate: Date;
  endDate: Date;
  maxResults: number;
}): Promise<ArxivEntry[]> {
  const { categories, keywords, startDate, endDate, maxResults } = params;
  const capped = Math.min(maxResults, 30);

  const dateQuery = `submittedDate:[${formatArxivDate(startDate)}0000 TO ${formatArxivDate(endDate)}2359]`;
  const catQuery = categories.map((cat) => `cat:${cat}`).join(" OR ");
  const kwQuery = keywords && keywords.length > 0 ? buildKeywordQuery(keywords) : null;
  const fullQuery = kwQuery
    ? `${dateQuery} AND (${catQuery}) AND ${kwQuery}`
    : `${dateQuery} AND (${catQuery})`;

  try {
    return await searchArxiv({
      query: fullQuery,
      maxResults: capped,
      sortBy: "submittedDate",
      sortOrder: "descending",
    });
  } catch {
    // arXiv often returns 500 on complex queries; drop the date bound but
    // keep category + keywords so a broad-category collector doesn't
    // degrade into "everything in the field" (see getRecentArxivPapers).
    console.warn(`  arXiv segment query failed for ${formatArxivDate(startDate)}-${formatArxivDate(endDate)}, retrying without date bound`);
    try {
      return await searchArxiv({
        query: kwQuery ? `(${catQuery}) AND ${kwQuery}` : catQuery,
        maxResults: capped,
        sortBy: "submittedDate",
        sortOrder: "descending",
      });
    } catch {
      console.warn(`  arXiv segment fallback also failed for ${formatArxivDate(startDate)}-${formatArxivDate(endDate)}, skipping`);
      return [];
    }
  }
}

// Get recent papers in specific categories with segmented date queries
export async function getRecentArxivPapers(params: {
  categories: string[];
  keywords?: string[];
  maxResults?: number;
  daysBack?: number;
}): Promise<ArxivEntry[]> {
  const { categories, keywords, maxResults = 30, daysBack = 7 } = params;
  const kwQuery = keywords && keywords.length > 0 ? buildKeywordQuery(keywords) : null;

  // For short ranges, use single query (original behavior)
  if (daysBack <= 30) {
    const capped = Math.min(maxResults, 30);
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const dateQuery = `submittedDate:[${formatArxivDate(startDate)}0000 TO ${formatArxivDate(endDate)}2359]`;
    const catQuery = categories.map((cat) => `cat:${cat}`).join(" OR ");
    const fullQuery = kwQuery
      ? `${dateQuery} AND (${catQuery}) AND ${kwQuery}`
      : `${dateQuery} AND (${catQuery})`;

    try {
      return await searchArxiv({
        query: fullQuery,
        maxResults: capped,
        sortBy: "submittedDate",
        sortOrder: "descending",
      });
    } catch (err) {
      console.warn("arXiv full query failed, trying fallback (no date filter):", err);
      return await searchArxiv({
        query: kwQuery ? `(${catQuery}) AND ${kwQuery}` : catQuery,
        maxResults: Math.min(capped, 20),
        sortBy: "submittedDate",
        sortOrder: "descending",
      });
    }
  }

  // For long ranges, use segmented queries
  const segments = generateDateSegments(daysBack);
  const allPapers: ArxivEntry[] = [];
  const seenIds = new Set<string>();

  // Calculate papers per segment to distribute maxResults across time
  const papersPerSegment = Math.max(5, Math.ceil(maxResults / segments.length));

  console.log(`  📅 Querying ${segments.length} monthly segments (${papersPerSegment} papers each)...`);

  for (const segment of segments) {
    // Stop if we have enough papers
    if (allPapers.length >= maxResults) break;

    // Rate limit: arXiv asks for 3 second delay between requests
    if (allPapers.length > 0) {
      await new Promise((r) => setTimeout(r, 3000));
    }

    const papers = await queryArxivSegment({
      categories,
      keywords,
      startDate: segment.start,
      endDate: segment.end,
      maxResults: papersPerSegment,
    });

    // Deduplicate
    for (const paper of papers) {
      if (!seenIds.has(paper.id) && allPapers.length < maxResults) {
        seenIds.add(paper.id);
        allPapers.push(paper);
      }
    }

    console.log(`    ${formatArxivDate(segment.start)}-${formatArxivDate(segment.end)}: ${papers.length} papers`);
  }

  console.log(`  📊 Total unique papers from segmented queries: ${allPapers.length}`);
  return allPapers;
}

// Common astronomy/astrophysics categories
export const ASTRO_CATEGORIES = [
  "astro-ph.CO", // Cosmology and Nongalactic Astrophysics
  "astro-ph.EP", // Earth and Planetary Astrophysics
  "astro-ph.GA", // Astrophysics of Galaxies
  "astro-ph.HE", // High Energy Astrophysical Phenomena
  "astro-ph.IM", // Instrumentation and Methods for Astrophysics
  "astro-ph.SR", // Solar and Stellar Astrophysics
  "gr-qc", // General Relativity and Quantum Cosmology
  "physics.space-ph", // Space Physics
];

// Rocket / launch systems related arXiv categories
export const ROCKET_CATEGORIES = [
  "physics.flu-dyn", // Fluid Dynamics
  "physics.app-ph", // Applied Physics
  "physics.ao-ph", // Atmospheric and Oceanic Physics
  "physics.ins-det", // Instrumentation and Detectors
  "physics.space-ph", // Space Physics
  "cs.RO", // Robotics
  "cs.SY", // Systems and Control
  "math.OC", // Optimization and Control
  "eess.SY", // Systems and Control
];

// Satellite-focused arXiv categories
export const SATELLITE_CATEGORIES = [
  "physics.space-ph", // Space Physics
  "astro-ph.IM", // Instrumentation and Methods for Astrophysics
  "astro-ph.EP", // Earth and Planetary Astrophysics
  "physics.app-ph", // Applied Physics
];

// Space travel / mission-oriented arXiv categories
export const SPACE_TRAVEL_CATEGORIES = [
  "physics.space-ph", // Space Physics
  "astro-ph.EP", // Earth and Planetary Astrophysics
  "astro-ph.IM", // Instrumentation and Methods for Astrophysics
  "physics.ao-ph", // Atmospheric and Oceanic Physics
];

export const ROCKET_KEYWORDS = [
  "rocket propulsion",
  "liquid rocket engine",
  "solid rocket motor",
  "hybrid rocket",
  "cryogenic propulsion",
  "hypergolic propulsion",
  "turbopump",
  "combustion instability",
  "thrust vector control",
  "nozzle design",
  "regenerative cooling",
  "injector design",
  "aerothermodynamics",
  "thermal protection system",
  "reentry heating",
  "hypersonic flow",
  "flight dynamics",
  "guidance navigation control",
];

// Collect recent astronomy papers
export function collectAstronomyPapers(params: {
  maxResults?: number;
  daysBack?: number;
  includeAllCategories?: boolean;
}): Promise<ArxivEntry[]> {
  const { maxResults = 30, daysBack = 7, includeAllCategories = true } = params;

  const categories = includeAllCategories
    ? ASTRO_CATEGORIES
    : ["astro-ph.CO", "astro-ph.EP", "astro-ph.GA"];

  return getRecentArxivPapers({
    categories,
    maxResults,
    daysBack,
  });
}

// Collect recent rocket-related papers. ROCKET_CATEGORIES spans fields far
// broader than rocketry (fluid dynamics, applied physics, control theory),
// so ROCKET_KEYWORDS is required as an AND-filter to keep results on-topic.
export function collectRocketPapers(params: {
  maxResults?: number;
  daysBack?: number;
}): Promise<ArxivEntry[]> {
  const { maxResults = 20, daysBack = 14 } = params;
  return getRecentArxivPapers({
    categories: ROCKET_CATEGORIES,
    keywords: ROCKET_KEYWORDS,
    maxResults,
    daysBack,
  });
}

// Robotics-focused arXiv categories
export const ROBOTICS_CATEGORIES = [
  "cs.RO", // Robotics
  "cs.CV", // Computer Vision (robot perception)
  "cs.AI", // Artificial Intelligence
  "eess.SP", // Signal Processing
];

// Robotics keywords for filtering relevant papers
export const ROBOTICS_KEYWORDS = [
  "humanoid robot",
  "legged locomotion",
  "manipulation",
  "grasping",
  "SLAM",
  "motion planning",
  "robot perception",
  "space robot",
  "robotic arm",
  "autonomous navigation",
  "human-robot interaction",
  "reinforcement learning robot",
  "sim-to-real",
  "whole-body control",
  "bipedal",
  "quadruped",
  "dexterous hand",
];

// Collect recent robotics papers. ROBOTICS_CATEGORIES includes cs.CV/cs.AI,
// which cover far more than robotics, so ROBOTICS_KEYWORDS is required as
// an AND-filter (cs.RO alone is precise enough and gets a lighter touch:
// see collectAiPapers for the AI∩robotics/AI∩astro stream).
export function collectRoboticsPapers(params: {
  maxResults?: number;
  daysBack?: number;
}): Promise<ArxivEntry[]> {
  const { maxResults = 20, daysBack = 14 } = params;
  return getRecentArxivPapers({
    categories: ROBOTICS_CATEGORIES,
    keywords: ROBOTICS_KEYWORDS,
    maxResults,
    daysBack,
  });
}

// AI applied to robotics or astronomy - the categories alone (cs.AI, cs.LG,
// cs.CV, stat.ML) are far too broad to imply relevance, so this always
// requires a keyword match on top of category. Complements collectRoboticsPapers
// (cs.RO-centric) and collectAstronomyPapers (astro-ph-centric) by picking
// up AI-first work that lands in general ML categories instead.
export const AI_CATEGORIES = ["cs.AI", "cs.LG", "cs.CV", "stat.ML"];

export const AI_ROBOTICS_ASTRO_KEYWORDS = [
  "robot learning",
  "imitation learning robot",
  "reinforcement learning robot",
  "vision-language-action",
  "visuomotor policy",
  "sim-to-real robot",
  "robot manipulation learning",
  "autonomous navigation robot",
  "machine learning astronomy",
  "deep learning exoplanet",
  "neural network galaxy",
  "machine learning astrophysics",
  "deep learning telescope",
  "AI astrophysics",
  "neural network spectra",
  "machine learning cosmology",
];

// Collect recent AI papers specifically about robotics or astronomy
export function collectAiPapers(params: {
  maxResults?: number;
  daysBack?: number;
}): Promise<ArxivEntry[]> {
  const { maxResults = 20, daysBack = 14 } = params;
  return getRecentArxivPapers({
    categories: AI_CATEGORIES,
    keywords: AI_ROBOTICS_ASTRO_KEYWORDS,
    maxResults,
    daysBack,
  });
}

// Collect recent satellite-related papers
export function collectSatellitePapers(params: {
  maxResults?: number;
  daysBack?: number;
}): Promise<ArxivEntry[]> {
  const { maxResults = 20, daysBack = 14 } = params;
  return getRecentArxivPapers({
    categories: SATELLITE_CATEGORIES,
    maxResults,
    daysBack,
  });
}

// Collect recent space travel / mission papers
export function collectSpaceTravelPapers(params: {
  maxResults?: number;
  daysBack?: number;
}): Promise<ArxivEntry[]> {
  const { maxResults = 20, daysBack = 14 } = params;
  return getRecentArxivPapers({
    categories: SPACE_TRAVEL_CATEGORIES,
    maxResults,
    daysBack,
  });
}
