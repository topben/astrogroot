import { z } from "zod";

const NTRS_API_BASE = "https://ntrs.nasa.gov/api/citations/search";

// NTRS entry schema
const NtrsEntrySchema = z.object({
  id: z.number(),
  title: z.string(),
  abstract: z.string(),
  authors: z.array(z.string()),
  publishedDate: z.string(),
  keywords: z.array(z.string()),
  subjectCategories: z.array(z.string()),
  pdfUrl: z.string().optional(),
  fulltextUrl: z.string().optional(),
  ntrsUrl: z.string(),
  documentType: z.string(),
  center: z.string().optional(),
});

export type NtrsEntry = z.infer<typeof NtrsEntrySchema>;

// Raw API response types
interface NtrsRawResult {
  id?: number;
  title?: string;
  abstract?: string;
  authorAffiliations?: Array<{
    meta?: {
      author?: { name?: string };
    };
  }>;
  keywords?: string[];
  subjectCategories?: string[];
  publications?: Array<{ publicationDate?: string }>;
  downloads?: Array<{
    links?: {
      pdf?: string;
      fulltext?: string;
    };
  }>;
  stiType?: string;
  center?: { name?: string };
}

interface NtrsApiResponse {
  stats?: { total?: number };
  results?: NtrsRawResult[];
}

// Parse NTRS API response
function parseNtrsResponse(data: NtrsApiResponse): NtrsEntry[] {
  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }

  return data.results
    .map((item) => {
      try {
        const id = item.id;
        if (!id) return null;

        // Extract authors
        const authors = (item.authorAffiliations || [])
          .map((a) => a.meta?.author?.name)
          .filter((name): name is string => !!name);

        // Extract publication date
        const pubDate = item.publications?.[0]?.publicationDate || "";

        // Extract download links
        const download = item.downloads?.[0];
        const pdfPath = download?.links?.pdf;
        const fulltextPath = download?.links?.fulltext;

        return NtrsEntrySchema.parse({
          id,
          title: item.title?.trim() || `NTRS Document ${id}`,
          abstract: item.abstract?.trim() || "",
          authors,
          publishedDate: pubDate,
          keywords: item.keywords || [],
          subjectCategories: item.subjectCategories || [],
          pdfUrl: pdfPath ? `https://ntrs.nasa.gov${pdfPath}` : undefined,
          fulltextUrl: fulltextPath ? `https://ntrs.nasa.gov${fulltextPath}` : undefined,
          ntrsUrl: `https://ntrs.nasa.gov/citations/${id}`,
          documentType: item.stiType || "UNKNOWN",
          center: item.center?.name,
        });
      } catch {
        return null;
      }
    })
    .filter((entry): entry is NtrsEntry => entry !== null);
}

// Search NASA NTRS
export async function searchNtrs(params: {
  query: string;
  page?: number;
  pageSize?: number;
}): Promise<{ entries: NtrsEntry[]; total: number }> {
  const { query, page = 1, pageSize = 25 } = params;

  const url = new URL(NTRS_API_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("pageSize", pageSize.toString());

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url.toString());
      if (response.ok) {
        const data: NtrsApiResponse = await response.json();
        return {
          entries: parseNtrsResponse(data),
          total: data.stats?.total || 0,
        };
      }
      if (response.status >= 500 && attempt < maxAttempts) {
        const delay = attempt * 2000;
        console.warn(
          `NTRS API ${response.status}, retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw new Error(`NTRS API error: ${response.statusText}`);
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error("Error searching NTRS:", error);
        throw error;
      }
      const delay = attempt * 2000;
      console.warn(`NTRS request failed, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return { entries: [], total: 0 };
}

// Rocket/propulsion related search queries
export const ROCKET_QUERIES = [
  // Propulsion fundamentals
  "rocket propulsion",
  "liquid rocket engine",
  "solid rocket motor",
  "hybrid rocket propulsion",
  "cryogenic propulsion",
  "hypergolic propellant",
  "electric propulsion ion thruster",
  "nuclear thermal propulsion",
  // Components & stability
  "turbopump",
  "combustion instability",
  "thrust vector control",
  "nozzle design",
  "regenerative cooling",
  "injector design",
  // Aero / thermal
  "aerothermodynamics reentry",
  "thermal protection system",
  "hypersonic flow",
  // Structures & manufacturing
  "structural analysis rocket",
  "composite materials rocket",
  "additive manufacturing rocket",
  // GNC & operations
  "guidance navigation control",
  "reaction control system",
  "launch operations range safety",
];

// Collect rocket/propulsion technical reports
export async function collectRocketReports(params: {
  queries?: string[];
  maxResultsPerQuery?: number;
}): Promise<NtrsEntry[]> {
  const {
    queries = ROCKET_QUERIES,
    maxResultsPerQuery = 10,
  } = params;

  const allEntries: NtrsEntry[] = [];
  const seenIds = new Set<number>();

  // Limit queries to avoid hitting rate limits (500 req/15min)
  const maxQueries = 20;
  let queryCount = 0;

  for (const query of queries) {
    if (queryCount >= maxQueries) {
      console.log(`  ⚠️ Reached query limit (${maxQueries}), stopping NTRS searches`);
      break;
    }

    try {
      const { entries } = await searchNtrs({
        query,
        pageSize: maxResultsPerQuery,
      });

      // Deduplicate
      for (const entry of entries) {
        if (!seenIds.has(entry.id)) {
          seenIds.add(entry.id);
          allEntries.push(entry);
        }
      }

      queryCount++;

      // Small delay to be nice to the API
      await new Promise((r) => setTimeout(r, 200));
    } catch (error) {
      console.error(`Failed to search NTRS for "${query}":`, error);
    }
  }

  console.log(`  📊 Found ${allEntries.length} unique NTRS reports from ${queryCount} queries`);
  return allEntries;
}

// Fetch full text content for a document
export async function fetchNtrsFullText(entry: NtrsEntry): Promise<string | null> {
  if (!entry.fulltextUrl) {
    return null;
  }

  try {
    const response = await fetch(entry.fulltextUrl);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching full text for NTRS ${entry.id}:`, error);
    return null;
  }
}
