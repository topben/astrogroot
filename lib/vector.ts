import { ChromaClient, Collection } from "chromadb";

const CHROMA_HOST = Deno.env.get("CHROMA_HOST") || "http://localhost:8000";
const CHROMA_AUTH_TOKEN = Deno.env.get("CHROMA_AUTH_TOKEN");

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
      const results = await this.collection.query({
        queryTexts: params.queryText ? [params.queryText] : undefined,
        queryEmbeddings: params.queryEmbedding ? [params.queryEmbedding] : undefined,
        nResults: params.nResults || 10,
        where: params.filter,
      });
      return results;
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
