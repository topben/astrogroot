import { ChromaClient, Collection, type IEmbeddingFunction } from "chromadb";

const CHROMA_HOST = Deno.env.get("CHROMA_HOST") || "http://localhost:8000";
const CHROMA_AUTH_TOKEN = Deno.env.get("CHROMA_AUTH_TOKEN");

/** Embedding dimension used by Chroma's default model (all-MiniLM-L6-v2). */
const EMBEDDING_DIM = 384;

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
    async generate(texts: string[]): Promise<number[][]> {
      return texts.map((text) => {
        const v = new Array(EMBEDDING_DIM).fill(0);
        const h = hash(text);
        for (let i = 0; i < EMBEDDING_DIM; i++) {
          v[i] = (hash(text + i + h) % 1000) / 1000 - 0.5;
        }
        return v;
      });
    },
  };
}

// Initialize ChromaDB client
export const chromaClient = new ChromaClient({
  path: CHROMA_HOST,
  auth: CHROMA_AUTH_TOKEN ? { provider: "token", credentials: CHROMA_AUTH_TOKEN } : undefined,
});

// Collection names
export const COLLECTIONS = {
  PAPERS: "astrogroot_papers",
  VIDEOS: "astrogroot_videos",
  NASA: "astrogroot_nasa",
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

// Helper to initialize all collections
export async function initializeCollections() {
  const collections = await Promise.all([
    VectorStore.getOrCreateCollection(COLLECTIONS.PAPERS, {
      description: "Research papers from arXiv",
    }),
    VectorStore.getOrCreateCollection(COLLECTIONS.VIDEOS, {
      description: "Educational videos from YouTube",
    }),
    VectorStore.getOrCreateCollection(COLLECTIONS.NASA, {
      description: "NASA content and imagery",
    }),
  ]);

  return {
    papers: collections[0],
    videos: collections[1],
    nasa: collections[2],
  };
}
