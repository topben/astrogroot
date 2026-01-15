#!/usr/bin/env -S deno run --allow-all

import { App } from "fresh";

const port = Number(Deno.env.get("PORT")) || 8000;

console.log("AstroGroot Research Library starting...");

export const app = new App();

// Add a simple test route
app.get("/", () => {
  return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>AstroGroot Research Library</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
    }
    h1 { font-size: 3rem; margin-bottom: 1rem; }
    p { font-size: 1.25rem; opacity: 0.9; margin-bottom: 2rem; }
    .stats { display: flex; gap: 2rem; margin-bottom: 2rem; }
    .stat { background: rgba(255,255,255,0.2); padding: 1.5rem 2rem; border-radius: 12px; }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-label { font-size: 0.875rem; opacity: 0.8; }
  </style>
</head>
<body>
  <h1>AstroGroot Research Library</h1>
  <p>Your astronomy and space science knowledge hub</p>
  <div class="stats">
    <div class="stat">
      <div class="stat-value">0</div>
      <div class="stat-label">Research Papers</div>
    </div>
    <div class="stat">
      <div class="stat-value">0</div>
      <div class="stat-label">Videos</div>
    </div>
    <div class="stat">
      <div class="stat-value">0</div>
      <div class="stat-label">NASA Content</div>
    </div>
  </div>
  <p>Run the crawler to collect data!</p>
</body>
</html>
  `, {
    headers: { "Content-Type": "text/html" },
  });
});

app.get("/api/stats", () => {
  return Response.json({
    papers: 0,
    videos: 0,
    nasa: 0,
    total: 0,
  });
});

if (import.meta.main) {
  console.log(`Server running on http://localhost:${port}`);
  await app.listen({ port });
}
