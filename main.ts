#!/usr/bin/env -S deno run --allow-all

import { start } from "fresh";
import manifest from "./fresh.gen.ts";

const port = Number(Deno.env.get("PORT")) || 8000;

console.log("🌌 Starting AstroGroot Research Library...");
console.log(`🚀 Server running on http://localhost:${port}`);

await start(manifest, { port });
