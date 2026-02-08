import { YoutubeTranscript } from "youtube-transcript";
import { z } from "zod";

// Video metadata schema
const VideoMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  channelName: z.string(),
  channelId: z.string().optional(),
  description: z.string().optional(),
  publishedAt: z.string(),
  duration: z.number().optional(),
  viewCount: z.number().optional(),
  likeCount: z.number().optional(),
  tags: z.array(z.string()).optional(),
  thumbnailUrl: z.string().optional(),
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

// Transcript entry
export interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
}

// Extract video ID from various YouTube URL formats
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Fetch video transcript
export async function fetchTranscript(videoId: string): Promise<TranscriptEntry[]> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript;
  } catch (error) {
    console.error(`Error fetching transcript for ${videoId}:`, error);
    throw new Error(`Failed to fetch transcript: ${error}`);
  }
}

// Fetch transcript from URL
export function fetchTranscriptFromUrl(url: string): Promise<TranscriptEntry[]> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return Promise.reject(new Error("Invalid YouTube URL"));
  }
  return fetchTranscript(videoId);
}

// Convert transcript to plain text
export function transcriptToText(transcript: TranscriptEntry[]): string {
  return transcript.map((entry) => entry.text).join(" ");
}

// Fetch video metadata using YouTube Data API v3
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  // Note: This requires YouTube Data API v3 key
  // For now, return a basic structure
  // In production, implement full API integration

  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) {
    console.warn("YOUTUBE_API_KEY not set, returning minimal metadata");
    return {
      id: videoId,
      title: `Video ${videoId}`,
      channelName: "Unknown",
      publishedAt: new Date().toISOString(),
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error("Video not found");
    }

    const item = data.items[0];
    const snippet = item.snippet;
    const statistics = item.statistics;
    const contentDetails = item.contentDetails;

    // Parse duration (PT format)
    const durationMatch = contentDetails?.duration?.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    let duration = 0;
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]) || 0;
      const minutes = parseInt(durationMatch[2]) || 0;
      const seconds = parseInt(durationMatch[3]) || 0;
      duration = hours * 3600 + minutes * 60 + seconds;
    }

    return VideoMetadataSchema.parse({
      id: videoId,
      title: snippet.title,
      channelName: snippet.channelTitle,
      channelId: snippet.channelId,
      description: snippet.description,
      publishedAt: snippet.publishedAt,
      duration,
      viewCount: parseInt(statistics?.viewCount || "0"),
      likeCount: parseInt(statistics?.likeCount || "0"),
      tags: snippet.tags || [],
      thumbnailUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url,
    });
  } catch (error) {
    console.error(`Error fetching metadata for ${videoId}:`, error);
    throw error;
  }
}

// Search YouTube videos
export async function searchYouTubeVideos(params: {
  query: string;
  maxResults?: number;
  order?: "date" | "relevance" | "viewCount" | "rating";
  channelId?: string;
}): Promise<Array<{ videoId: string; title: string; channelName: string }>> {
  const { query, maxResults = 10, order = "relevance", channelId } = params;

  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY not set");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", maxResults.toString());
  url.searchParams.set("order", order);
  url.searchParams.set("key", apiKey);
  if (channelId) url.searchParams.set("channelId", channelId);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.items || []).map((item: {
      id?: { videoId?: string };
      snippet?: { title?: string; channelTitle?: string };
    }) => ({
      videoId: item.id?.videoId || "",
      title: item.snippet?.title || "",
      channelName: item.snippet?.channelTitle || "",
    }));
  } catch (error) {
    console.error("Error searching YouTube:", error);
    throw error;
  }
}

// Known astronomy/science education channel IDs
const ASTRONOMY_CHANNELS = [
  // Rocket & Space Launch focused channels (priority)
  { id: "UCtI0Hodo5o5dUb67FeUjDeA", name: "SpaceX" },
  { id: "UCLA_DiR1FfKNvjuUpBHmylQ", name: "NASA Video" },
  { id: "UCSUu1lih2RifWkKtDOJdsBA", name: "Everyday Astronaut" },
  { id: "UClZbmi9JzfnB2CEb0fG8V-w", name: "NASASpaceflight" },
  { id: "UCVxTHEKKLxNjGcvVaZindlg", name: "Rocket Lab" },
  { id: "UCUK0HBIBWgM2c4vsPhkYY4w", name: "Scott Manley" },
  { id: "UC0e3QhIYukixgh5VVpKHH9Q", name: "Real Engineering" },
  { id: "UCO-EL9rDTsqloBZpUqHmhdg", name: "Primal Space" },
  // Astronomy & Space Science channels
  { id: "UC1znqKFL3jeR0eoA0pHpzvw", name: "NASA" },
  { id: "UC7_gcs09iThXybpVgjHZ_7g", name: "PBS Space Time" },
  { id: "UCZYTClx2T1of7BRZ86-8fow", name: "SciShow Space" },
  { id: "UCddiUEpeqJcYeBxX1IVBKvQ", name: "Dr. Becky" },
  { id: "UCUHW94eEFW7hkUMVaZz4eDg", name: "Kurzgesagt" },
  { id: "UCHnyfMqiRRG1u-2MsSQLbXA", name: "Veritasium" },
  { id: "UCvBqzzvUBLCs8Y7Axb-jZew", name: "Sixty Symbols" },
  { id: "UC-3SbfTPJlsFZWxYGLHQnWA", name: "Space Engine" },
  // Robotics channels
  { id: "UC7vVhkEfw4nOGp8TyDk7RcQ", name: "Boston Dynamics" },
  { id: "UCjdiY1pQw1EgYBv-3EFqTgw", name: "Figure" },
  { id: "UCHuiy8bXnmK5nisYHUd1J5g", name: "NVIDIA" },
  { id: "UC0ExJJXMwEh03AY-bUHkPCA", name: "IEEE Spectrum" },
  { id: "UCjN7DjO9M-OjMIaUd0vVJjg", name: "Agility Robotics" },
  { id: "UCsMbcFBJYIEMCfB3VWlkHMg", name: "Unitree Robotics" },
];

// Check if error indicates YouTube API quota exhaustion
function isQuotaExhausted(error: unknown): boolean {
  const msg = String(error);
  return msg.includes("Forbidden") || msg.includes("quotaExceeded") || msg.includes("dailyLimitExceeded");
}

// Collect astronomy videos from specific channels or search
export async function collectAstronomyVideos(params: {
  searchQueries?: string[];
  maxResultsPerQuery?: number;
}): Promise<Array<{ videoId: string; title: string; channelName: string }>> {
  const {
    searchQueries = [
      // Rocket & Launch (priority - first 8 for relevance search)
      "SpaceX Starship launch",
      "rocket engine test fire",
      "Falcon 9 landing",
      "rocket launch compilation",
      "how rockets work explained",
      "liquid rocket engine",
      "rocket propulsion explained",
      "Raptor engine SpaceX",
      // Rocket tech (next 8 for date search - newest content)
      "rocket static fire test",
      "turbopump rocket engine",
      "solid rocket motor",
      "Merlin engine",
      "BE-4 engine Blue Origin",
      "RS-25 engine SLS",
      "rocket nozzle design",
      "thrust vector control rocket",
      // Space missions & events (next batch for viewCount)
      "Artemis moon mission",
      "SpaceX Crew Dragon",
      "ISS expedition",
      "Mars Perseverance rover",
      "James Webb telescope images",
      "Starlink satellite deployment",
      "rocket stage separation",
      "orbital mechanics explained",
      // Astronomy & astrophysics
      "black hole documentary",
      "neutron star explanation",
      "exoplanet discovery",
      "galaxy collision simulation",
      "gravitational waves explained",
      "cosmology lecture",
      "universe documentary",
      "dark matter evidence",
      // Historical & educational
      "Apollo mission documentary",
      "Saturn V rocket",
      "Space Shuttle history",
      "Voyager golden record",
      // Robotics
      "humanoid robot walking",
      "robotic arm manipulation",
      "space robot ISS",
      "Mars rover autonomy",
      "Boston Dynamics Atlas",
      "robot learning to walk",
      "industrial robot assembly",
      "quadruped robot",
      "dexterous robot hand",
      "robot SLAM navigation",
    ],
    maxResultsPerQuery = 10,
  } = params;

  const allVideos: Array<{ videoId: string; title: string; channelName: string }> = [];

  // Limit searches to stay within YouTube API quota (10,000 units/day)
  // Each search costs 100 units, so we limit to ~30-40 searches per run
  const maxSearches = 30;
  let searchCount = 0;
  let quotaExhausted = false;

  // Strategy 1: Search with relevance sort (popular videos) - 8 searches
  console.log("  📡 Searching by relevance...");
  for (const query of searchQueries.slice(0, 8)) {
    if (searchCount >= maxSearches || quotaExhausted) break;
    try {
      const videos = await searchYouTubeVideos({
        query,
        maxResults: Math.min(maxResultsPerQuery, 10),
        order: "relevance",
      });
      allVideos.push(...videos);
      searchCount++;
    } catch (error) {
      if (isQuotaExhausted(error)) {
        console.warn("  ⚠️ YouTube API quota exceeded, stopping all searches");
        quotaExhausted = true;
        break;
      }
      console.error(`Failed to search for "${query}":`, error);
    }
  }

  // Strategy 2: Search with date sort (newest videos) - 8 searches
  if (searchCount < maxSearches && !quotaExhausted) {
    console.log("  📅 Searching by date...");
    for (const query of searchQueries.slice(8, 16)) {
      if (searchCount >= maxSearches || quotaExhausted) break;
      try {
        const videos = await searchYouTubeVideos({
          query,
          maxResults: Math.min(maxResultsPerQuery, 10),
          order: "date",
        });
        allVideos.push(...videos);
        searchCount++;
      } catch (error) {
        if (isQuotaExhausted(error)) {
          console.warn("  ⚠️ YouTube API quota exceeded, stopping all searches");
          quotaExhausted = true;
          break;
        }
        console.error(`Failed to search for "${query}" (date):`, error);
      }
    }
  }

  // Strategy 3: Search with viewCount sort (most viewed) - 8 searches
  if (searchCount < maxSearches && !quotaExhausted) {
    console.log("  👀 Searching by view count...");
    for (const query of searchQueries.slice(16)) {
      if (searchCount >= maxSearches || quotaExhausted) break;
      try {
        const videos = await searchYouTubeVideos({
          query,
          maxResults: Math.min(maxResultsPerQuery, 10),
          order: "viewCount",
        });
        allVideos.push(...videos);
        searchCount++;
      } catch (error) {
        if (isQuotaExhausted(error)) {
          console.warn("  ⚠️ YouTube API quota exceeded, stopping all searches");
          quotaExhausted = true;
          break;
        }
        console.error(`Failed to search for "${query}" (viewCount):`, error);
      }
    }
  }

  // Strategy 4: Search specific channels - only if quota allows
  if (searchCount < maxSearches - 5 && !quotaExhausted) {
    console.log("  📺 Searching astronomy channels...");
    const channelQueries = ["astronomy", "space"];
    outerLoop: for (const channel of ASTRONOMY_CHANNELS.slice(0, 4)) {
      if (searchCount >= maxSearches || quotaExhausted) break;
      for (const query of channelQueries) {
        if (searchCount >= maxSearches || quotaExhausted) break outerLoop;
        try {
          const videos = await searchYouTubeVideos({
            query,
            maxResults: 5,
            order: "date",
            channelId: channel.id,
          });
          allVideos.push(...videos);
          searchCount++;
        } catch (error) {
          if (isQuotaExhausted(error)) {
            console.warn("  ⚠️ YouTube API quota exceeded, stopping all searches");
            quotaExhausted = true;
            break outerLoop;
          }
          // Channel search may fail, continue
        }
      }
    }
  }

  console.log(`  📊 Completed ${searchCount} searches${quotaExhausted ? " (quota exhausted)" : ""}`);

  // Remove duplicates
  const uniqueVideos = Array.from(
    new Map(allVideos.map((v) => [v.videoId, v])).values(),
  );

  console.log(`  📊 Found ${uniqueVideos.length} unique videos from ${allVideos.length} results`);
  return uniqueVideos;
}

// Fetch complete video data (metadata + transcript)
export async function fetchCompleteVideoData(videoId: string): Promise<{
  metadata: VideoMetadata;
  transcript: TranscriptEntry[];
  fullText: string;
}> {
  const [metadata, transcript] = await Promise.all([
    fetchVideoMetadata(videoId),
    fetchTranscript(videoId),
  ]);

  return {
    metadata,
    transcript,
    fullText: transcriptToText(transcript),
  };
}
