import { parseString } from "xml2js";
import { z } from "zod";

const ARXIV_API_BASE = "http://export.arxiv.org/api/query";

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
async function parseArxivXml(xml: string): Promise<ArxivEntry[]> {
  return new Promise((resolve, reject) => {
    parseString(xml, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const entries = result.feed?.entry || [];
        if (!Array.isArray(entries)) {
          resolve([]);
          return;
        }

        const parsed = entries.map((entry: {
          id?: string[];
          title?: string[];
          summary?: string[];
          author?: Array<{ name?: string[] }>;
          published?: string[];
          updated?: string[];
          category?: Array<{ $?: { term?: string } }>;
          link?: Array<{ $?: { title?: string; href?: string } }>;
        }) => {
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

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.statusText}`);
    }

    const xml = await response.text();
    return await parseArxivXml(xml);
  } catch (error) {
    console.error("Error searching arXiv:", error);
    throw error;
  }
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
  const { categories, maxResults = 50, daysBack = 7 } = params;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const dateQuery = `submittedDate:[${startDate.toISOString().split("T")[0]}0000 TO ${
    endDate.toISOString().split("T")[0]
  }2359]`;
  const catQuery = categories.map((cat) => `cat:${cat}`).join(" OR ");
  const query = `${dateQuery} AND (${catQuery})`;

  return searchArxiv({
    query,
    maxResults,
    sortBy: "submittedDate",
    sortOrder: "descending",
  });
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

// Collect recent astronomy papers
export async function collectAstronomyPapers(params: {
  maxResults?: number;
  daysBack?: number;
  includeAllCategories?: boolean;
}): Promise<ArxivEntry[]> {
  const { maxResults = 50, daysBack = 7, includeAllCategories = true } = params;

  const categories = includeAllCategories
    ? ASTRO_CATEGORIES
    : ["astro-ph.CO", "astro-ph.EP", "astro-ph.GA"];

  return getRecentArxivPapers({
    categories,
    maxResults,
    daysBack,
  });
}
