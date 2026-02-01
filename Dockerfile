# Multi-stage Dockerfile for AstroGroot on Fly.io
# Supports both ChromaDB and Crawler services

# ============================================
# Stage 1: Crawler (Deno-based)
# ============================================
FROM denoland/deno:2.5.6 AS crawler

WORKDIR /app

# Copy dependency files first for better caching
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno cache --reload deno.json || true

# Copy application code
COPY . .

# Cache the crawler entry point
RUN deno cache workers/crawler.ts

# Default command: run crawler in scheduled mode
CMD ["run", "--allow-all", "--env", "workers/crawler.ts", "scheduled"]
