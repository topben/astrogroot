import { z } from "zod";

const NASA_API_KEY = Deno.env.get("NASA_API_KEY") || "DEMO_KEY";
const NASA_API_BASE = "https://api.nasa.gov";

// APOD (Astronomy Picture of the Day) Schema
const ApodSchema = z.object({
  date: z.string(),
  explanation: z.string(),
  hdurl: z.string().optional(),
  media_type: z.string(),
  title: z.string(),
  url: z.string(),
  copyright: z.string().optional(),
});

export type ApodData = z.infer<typeof ApodSchema>;

// NASA Image and Video Library Schema
const NasaAssetSchema = z.object({
  href: z.string(),
  nasa_id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  date_created: z.string(),
  keywords: z.array(z.string()).optional(),
  media_type: z.string(),
  center: z.string().optional(),
});

export type NasaAsset = z.infer<typeof NasaAssetSchema>;

// Fetch APOD (Astronomy Picture of the Day)
export async function fetchApod(date?: string): Promise<ApodData> {
  const url = new URL(`${NASA_API_BASE}/planetary/apod`);
  url.searchParams.set("api_key", NASA_API_KEY);
  if (date) {
    url.searchParams.set("date", date);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`NASA APOD API error: ${response.statusText}`);
    }

    const data = await response.json();
    return ApodSchema.parse(data);
  } catch (error) {
    console.error("Error fetching APOD:", error);
    throw error;
  }
}

// Fetch multiple APODs in date range
export async function fetchApodRange(
  startDate: string,
  endDate: string,
): Promise<ApodData[]> {
  const url = new URL(`${NASA_API_BASE}/planetary/apod`);
  url.searchParams.set("api_key", NASA_API_KEY);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`NASA APOD API error: ${response.statusText}`);
    }

    const data = await response.json();
    return z.array(ApodSchema).parse(data);
  } catch (error) {
    console.error("Error fetching APOD range:", error);
    throw error;
  }
}

// Search NASA Image and Video Library
export async function searchNasaLibrary(params: {
  query: string;
  mediaType?: "image" | "video" | "audio";
  yearStart?: number;
  yearEnd?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ items: NasaAsset[]; total: number }> {
  const { query, mediaType, yearStart, yearEnd, page = 1, pageSize = 100 } = params;

  const url = new URL("https://images-api.nasa.gov/search");
  url.searchParams.set("q", query);
  if (mediaType) url.searchParams.set("media_type", mediaType);
  if (yearStart) url.searchParams.set("year_start", yearStart.toString());
  if (yearEnd) url.searchParams.set("year_end", yearEnd.toString());
  url.searchParams.set("page", page.toString());
  url.searchParams.set("page_size", pageSize.toString());

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`NASA Library API error: ${response.statusText}`);
    }

    const data = await response.json();
    const collection = data.collection;

    if (!collection || !collection.items) {
      return { items: [], total: 0 };
    }

    const items = collection.items
      .map((item: { data?: unknown[] }) => {
        if (!item.data || item.data.length === 0) return null;
        try {
          return NasaAssetSchema.parse(item.data[0]);
        } catch {
          return null;
        }
      })
      .filter((item: NasaAsset | null): item is NasaAsset => item !== null);

    return {
      items,
      total: collection.metadata?.total_hits || items.length,
    };
  } catch (error) {
    console.error("Error searching NASA library:", error);
    throw error;
  }
}

// Fetch Mars Rover Photos
export async function fetchMarsRoverPhotos(params: {
  rover: "curiosity" | "opportunity" | "spirit" | "perseverance";
  sol?: number;
  earthDate?: string;
  camera?: string;
  page?: number;
}): Promise<{
  photos: Array<{
    id: number;
    sol: number;
    camera: { name: string; full_name: string };
    img_src: string;
    earth_date: string;
    rover: { name: string };
  }>;
}> {
  const { rover, sol, earthDate, camera, page = 1 } = params;

  const url = new URL(`${NASA_API_BASE}/mars-photos/api/v1/rovers/${rover}/photos`);
  url.searchParams.set("api_key", NASA_API_KEY);
  url.searchParams.set("page", page.toString());

  if (sol !== undefined) {
    url.searchParams.set("sol", sol.toString());
  } else if (earthDate) {
    url.searchParams.set("earth_date", earthDate);
  } else {
    // Default to sol 1000 if neither provided
    url.searchParams.set("sol", "1000");
  }

  if (camera) {
    url.searchParams.set("camera", camera);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`NASA Mars Rover API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching Mars Rover photos:", error);
    throw error;
  }
}

// Fetch NASA content with multiple sources
export async function collectNasaContent(params: {
  includeApod?: boolean;
  searchQueries?: string[];
  maxItemsPerQuery?: number;
}): Promise<{
  apod: ApodData | null;
  libraryItems: NasaAsset[];
}> {
  const { includeApod = true, searchQueries = ["astronomy", "space"], maxItemsPerQuery = 20 } =
    params;

  const results: {
    apod: ApodData | null;
    libraryItems: NasaAsset[];
  } = {
    apod: null,
    libraryItems: [],
  };

  // Fetch APOD
  if (includeApod) {
    try {
      results.apod = await fetchApod();
    } catch (error) {
      console.error("Failed to fetch APOD:", error);
    }
  }

  // Search library for each query
  for (const query of searchQueries) {
    try {
      const searchResults = await searchNasaLibrary({
        query,
        mediaType: "image",
        pageSize: maxItemsPerQuery,
      });
      results.libraryItems.push(...searchResults.items);
    } catch (error) {
      console.error(`Failed to search NASA library for "${query}":`, error);
    }
  }

  return results;
}
