#!/usr/bin/env -S deno run --allow-net
import { searchArxiv } from "../lib/collectors/arxiv.ts";

const papers = await searchArxiv({
  query: "cat:astro-ph.CO",
  maxResults: 3,
});
console.log("arXiv API test – count:", papers.length);
papers.forEach((p, i) =>
  console.log(`${i + 1}. ${p.title?.slice(0, 70)}... | id: ${p.id}`)
);
