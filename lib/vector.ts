import { ChromaClient, Collection, type IEmbeddingFunction } from "chromadb";
import type { Locale } from "./i18n.ts";
import { SUPPORTED_LOCALES } from "./i18n.ts";

const CHROMA_HOST = Deno.env.get("CHROMA_HOST") || "http://localhost:8000";
const CHROMA_AUTH_TOKEN = Deno.env.get("CHROMA_AUTH_TOKEN");

/** Embedding dimension used by Chroma's default model (all-MiniLM-L6-v2). */
const EMBEDDING_DIM = 384;

/** Locale to Chroma-safe collection suffix (en, zh_tw, zh_cn). */
export function localeToSuffix(locale: string): string {
  return locale.replace("-", "_").toLowerCase();
}

/**
 * Lightweight embedding function that does not require chromadb-default-embed.
 * Produces deterministic 384-dim vectors from text (hash-based). Use chromadb-default-embed
 * for real semantic embeddings; this avoids the optional dependency so the crawler runs.
 */
function simpleEmbeddingFunction(): IEmbeddingFunction {
  function hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return h;
  }
  return {
    generate(texts: string[]): Promise<number[][]> {
      return Promise.resolve(texts.map((text) => {
        const v = new Array(EMBEDDING_DIM).fill(0);
        const h = hash(text);
        for (let i = 0; i < EMBEDDING_DIM; i++) {
          v[i] = (hash(text + i + h) % 1000) / 1000 - 0.5;
        }
        return v;
      }));
    },
  };
}

// Initialize ChromaDB client
export const chromaClient = new ChromaClient({
  path: CHROMA_HOST,
  auth: CHROMA_AUTH_TOKEN ? { provider: "token", credentials: CHROMA_AUTH_TOKEN } : undefined,
});

// Collection name prefixes (per content type); suffix = locale (en, zh_tw, zh_cn)
export const COLLECTION_PREFIX = {
  PAPERS: "astrogroot_papers",
  VIDEOS: "astrogroot_videos",
  NASA: "astrogroot_nasa",
} as const;

/** Get collection name for content type and locale (e.g. astrogroot_papers_zh_tw). */
export function getCollectionName(
  contentType: keyof typeof COLLECTION_PREFIX,
  locale: string,
): string {
  const prefix = COLLECTION_PREFIX[contentType];
  const suffix = localeToSuffix(locale);
  return `${prefix}_${suffix}`;
}

/** Legacy flat collection names (default locale "en" only). */
export const COLLECTIONS = {
  PAPERS: "astrogroot_papers_en",
  VIDEOS: "astrogroot_videos_en",
  NASA: "astrogroot_nasa_en",
} as const;

// Vector store wrapper class
export class VectorStore {
  private collection: Collection;
  private collectionName: string;

  private constructor(collection: Collection, collectionName: string) {
    this.collection = collection;
    this.collectionName = collectionName;
  }

  static async getOrCreateCollection(
    name: string,
    metadata?: Record<string, string>,
  ): Promise<VectorStore> {
    try {
      const collection = await chromaClient.getOrCreateCollection({
        name,
        metadata: metadata || { description: `AstroGroot ${name} collection` },
        embeddingFunction: simpleEmbeddingFunction(),
      });
      return new VectorStore(collection, name);
    } catch (error) {
      console.error(`Failed to get/create collection ${name}:`, error);
      throw error;
    }
  }

  async add(params: {
    id: string;
    text: string;
    embedding?: number[];
    metadata?: Record<string, string | number | boolean>;
  }): Promise<void> {
    try {
      await this.collection.add({
        ids: [params.id],
        documents: [params.text],
        embeddings: params.embedding ? [params.embedding] : undefined,
        metadatas: params.metadata ? [params.metadata] : undefined,
      });
    } catch (error) {
      console.error(`Failed to add document to ${this.collectionName}:`, error);
      throw error;
    }
  }

  async addBatch(items: Array<{
    id: string;
    text: string;
    embedding?: number[];
    metadata?: Record<string, string | number | boolean>;
  }>): Promise<void> {
    if (items.length === 0) return;

    try {
      await this.collection.add({
        ids: items.map((item) => item.id),
        documents: items.map((item) => item.text),
        embeddings: items.every((item) => item.embedding)
          ? items.map((item) => item.embedding!)
          : undefined,
        metadatas: items.map((item) => item.metadata || {}),
      });
    } catch (error) {
      console.error(`Failed to add batch to ${this.collectionName}:`, error);
      throw error;
    }
  }

  async query(params: {
    queryText?: string;
    queryEmbedding?: number[];
    nResults?: number;
    filter?: Record<string, string | number | boolean>;
  }): Promise<{
    ids: string[][];
    documents: (string | null)[][];
    distances: number[][];
    metadatas: (Record<string, string | number | boolean> | null)[][];
  }> {
    try {
      const nResults = params.nResults || 10;
      const results = params.queryEmbedding
        ? await this.collection.query({
            queryEmbeddings: [params.queryEmbedding],
            nResults,
            where: params.filter,
          })
        : await this.collection.query({
            queryTexts: params.queryText ? [params.queryText] : [""],
            nResults,
            where: params.filter,
          });
      return {
        ...results,
        distances: results.distances ?? [],
      };
    } catch (error) {
      console.error(`Failed to query ${this.collectionName}:`, error);
      throw error;
    }
  }

  async get(id: string): Promise<{
    id: string;
    document: string | null;
    metadata: Record<string, string | number | boolean> | null;
  } | null> {
    try {
      const result = await this.collection.get({
        ids: [id],
      });

      if (result.ids.length === 0) return null;

      return {
        id: result.ids[0],
        document: result.documents[0],
        metadata: result.metadatas[0],
      };
    } catch (error) {
      console.error(`Failed to get document from ${this.collectionName}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.collection.delete({
        ids: [id],
      });
    } catch (error) {
      console.error(`Failed to delete from ${this.collectionName}:`, error);
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      return await this.collection.count();
    } catch (error) {
      console.error(`Failed to count ${this.collectionName}:`, error);
      throw error;
    }
  }
}

export type CollectionsByLocale = Record<Locale, VectorStore>;

/** Initialize per-locale collections for papers, videos, and NASA content. */
export async function initializeCollections(): Promise<{
  papers: CollectionsByLocale;
  videos: CollectionsByLocale;
  nasa: CollectionsByLocale;
}> {
  const papers: CollectionsByLocale = {} as CollectionsByLocale;
  const videos: CollectionsByLocale = {} as CollectionsByLocale;
  const nasa: CollectionsByLocale = {} as CollectionsByLocale;

  for (const locale of SUPPORTED_LOCALES) {
    const suffix = localeToSuffix(locale);
    papers[locale] = await VectorStore.getOrCreateCollection(
      getCollectionName("PAPERS", locale),
      { description: `arXiv papers (${suffix})` },
    );
    videos[locale] = await VectorStore.getOrCreateCollection(
      getCollectionName("VIDEOS", locale),
      { description: `YouTube videos (${suffix})` },
    );
    nasa[locale] = await VectorStore.getOrCreateCollection(
      getCollectionName("NASA", locale),
      { description: `NASA content (${suffix})` },
    );
  }

  return { papers, videos, nasa };
}
