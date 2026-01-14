import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: Deno.env.get("TURSO_DATABASE_URL")!,
    authToken: Deno.env.get("TURSO_AUTH_TOKEN"),
  },
  verbose: true,
  strict: true,
});
