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

// Get recent papers in specific categories
export async function getRecentArxivPapers(params: {
  categories: string[];
  maxResults?: number;
  daysBack?: number;
}): Promise<ArxivEntry[]> {
  const { categories, maxResults = 30, daysBack = 7 } = params;
  const capped = Math.min(maxResults, 30);

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const dateQuery = `submittedDate:[${startDate.toISOString().split("T")[0]}0000 TO ${
    endDate.toISOString().split("T")[0]
  }2359]`;
  const catQuery = categories.map((cat) => `cat:${cat}`).join(" OR ");
  const fullQuery = `${dateQuery} AND (${catQuery})`;

  try {
    return await searchArxiv({
      query: fullQuery,
      maxResults: capped,
      sortBy: "submittedDate",
      sortOrder: "descending",
    });
  } catch (err) {
    // arXiv often returns 500 on complex date+category queries; fallback to simpler query
    console.warn("arXiv full query failed, trying fallback (categories only, no date filter):", err);
    const fallbackResults = await searchArxiv({
      query: catQuery,
      maxResults: Math.min(capped, 20),
      sortBy: "submittedDate",
      sortOrder: "descending",
    });
    return fallbackResults;
  }
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

// Collect recent rocket-related papers using a broad category filter
export function collectRocketPapers(params: {
  maxResults?: number;
  daysBack?: number;
}): Promise<ArxivEntry[]> {
  const { maxResults = 20, daysBack = 14 } = params;
  return getRecentArxivPapers({
    categories: ROCKET_CATEGORIES,
    maxResults,
    daysBack,
  });
}
