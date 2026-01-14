import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

const tursoUrl = Deno.env.get("TURSO_DATABASE_URL");
const tursoAuthToken = Deno.env.get("TURSO_AUTH_TOKEN");

if (!tursoUrl) {
  throw new Error("TURSO_DATABASE_URL is not set");
}

export const client = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
