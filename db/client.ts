import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

// Lazy initialization to allow importing without env vars (for tests)
let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
  if (!_client) {
    const tursoUrl = Deno.env.get("TURSO_DATABASE_URL");
    const tursoAuthToken = Deno.env.get("TURSO_AUTH_TOKEN");

    if (!tursoUrl) {
      throw new Error("TURSO_DATABASE_URL is not set");
    }

    _client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
  }
  return _client;
}

function getDb(): LibSQLDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

// Use getters so the actual initialization is deferred
export const client = new Proxy({} as Client, {
  get(_, prop) {
    return Reflect.get(getClient(), prop);
  },
});

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export type Database = LibSQLDatabase<typeof schema>;
