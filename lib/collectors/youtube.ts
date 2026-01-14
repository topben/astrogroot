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
export async function fetchTranscriptFromUrl(url: string): Promise<TranscriptEntry[]> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
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

// Collect astronomy videos from specific channels or search
export async function collectAstronomyVideos(params: {
  searchQueries?: string[];
  maxResultsPerQuery?: number;
}): Promise<Array<{ videoId: string; title: string; channelName: string }>> {
  const {
    searchQueries = [
      "astronomy lecture",
      "space documentary",
      "astrophysics explained",
      "telescope observation",
    ],
    maxResultsPerQuery = 10,
  } = params;

  const allVideos: Array<{ videoId: string; title: string; channelName: string }> = [];

  for (const query of searchQueries) {
    try {
      const videos = await searchYouTubeVideos({
        query,
        maxResults: maxResultsPerQuery,
        order: "relevance",
      });
      allVideos.push(...videos);
    } catch (error) {
      console.error(`Failed to search for "${query}":`, error);
    }
  }

  // Remove duplicates
  const uniqueVideos = Array.from(
    new Map(allVideos.map((v) => [v.videoId, v])).values(),
  );

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
