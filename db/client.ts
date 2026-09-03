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

// Use getters so the actual initialization is deferred.
// Methods must be bound to the real instance: an unbound method called as
// `client.execute(...)` runs with `this` set to the Proxy, and @libsql/client
// reads private fields (`#promiseLimitFunction`) off `this`, which throws
// "Cannot read private member ... from an object whose class did not declare
// it". Every FTS call site swallows that error, so the failure is silent.
function bindingProxy<T extends object>(getTarget: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const target = getTarget();
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const client = bindingProxy<Client>(getClient);

export const db = bindingProxy<LibSQLDatabase<typeof schema>>(getDb);

export type Database = LibSQLDatabase<typeof schema>;
