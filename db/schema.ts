import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Papers table - Research papers from arXiv
export const papers = sqliteTable("papers", {
  id: text("id").primaryKey(), // arXiv ID (e.g., "2401.12345")
  title: text("title").notNull(),
  authors: text("authors").notNull(), // JSON array stored as text
  abstract: text("abstract").notNull(),
  summary: text("summary"), // AI-generated summary
  translation: text("translation"), // AI-translated summary (optional)

  // Metadata
  publishedDate: integer("published_date", { mode: "timestamp" }).notNull(),
  updatedDate: integer("updated_date", { mode: "timestamp" }),
  categories: text("categories").notNull(), // JSON array of arXiv categories
  pdfUrl: text("pdf_url"),
  arxivUrl: text("arxiv_url").notNull(),

  // Vector embedding reference
  vectorId: text("vector_id"), // ChromaDB document ID

  // System fields
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  processed: integer("processed", { mode: "boolean" }).default(false).notNull(),
});

// Videos table - Educational videos from YouTube
export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(), // YouTube video ID
  title: text("title").notNull(),
  channelName: text("channel_name").notNull(),
  channelId: text("channel_id"),
  description: text("description"),
  transcript: text("transcript"), // Full transcript
  summary: text("summary"), // AI-generated summary
  translation: text("translation"), // AI-translated summary (optional)

  // Metadata
  publishedDate: integer("published_date", { mode: "timestamp" }).notNull(),
  duration: integer("duration"), // Duration in seconds
  viewCount: integer("view_count"),
  likeCount: integer("like_count"),
  tags: text("tags"), // JSON array
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url").notNull(),

  // Vector embedding reference
  vectorId: text("vector_id"), // ChromaDB document ID

  // System fields
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  processed: integer("processed", { mode: "boolean" }).default(false).notNull(),
});

// NASA content table - NASA images, articles, and data
export const nasaContent = sqliteTable("nasa_content", {
  id: text("id").primaryKey(), // NASA ID or generated UUID
  contentType: text("content_type").notNull(), // "image", "article", "apod", etc.
  title: text("title").notNull(),
  description: text("description"),
  explanation: text("explanation"), // Detailed explanation
  summary: text("summary"), // AI-generated summary
  translation: text("translation"), // AI-translated summary (optional)

  // Metadata
  date: integer("date", { mode: "timestamp" }),
  credit: text("credit"), // Photo credits
  mediaType: text("media_type"), // "image", "video"
  hdUrl: text("hd_url"),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  copyright: text("copyright"),

  // NASA-specific fields
  nasaId: text("nasa_id"),
  center: text("center"), // NASA center (e.g., "JPL", "GSFC")
  keywords: text("keywords"), // JSON array

  // Vector embedding reference
  vectorId: text("vector_id"), // ChromaDB document ID

  // System fields
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  processed: integer("processed", { mode: "boolean" }).default(false).notNull(),
});

// Metadata table - General system metadata and statistics
export const metadata = sqliteTable("metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").unique().notNull(),
  value: text("value").notNull(), // JSON value stored as text
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// Translations table - Localized title/summary per item and language (i18n content)
export const translations = sqliteTable("translations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemType: text("item_type").notNull(), // 'paper', 'video', 'nasa'
  itemId: text("item_id").notNull(),
  lang: text("lang", { length: 10 }).notNull(), // 'en', 'zh-TW', 'zh-CN'
  title: text("title"),
  summary: text("summary"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// Type exports for TypeScript
export type Paper = typeof papers.$inferSelect;
export type NewPaper = typeof papers.$inferInsert;

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;

export type NasaContent = typeof nasaContent.$inferSelect;
export type NewNasaContent = typeof nasaContent.$inferInsert;

export type Metadata = typeof metadata.$inferSelect;
export type NewMetadata = typeof metadata.$inferInsert;

export type Translation = typeof translations.$inferSelect;
export type NewTranslation = typeof translations.$inferInsert;
