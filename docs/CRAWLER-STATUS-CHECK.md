# Crawler Status Check Workflow

Quick reference for checking the health and status of the `astrogroot-crawler` on Fly.io.

## 1. App Overview

```bash
fly status
```

Verify:
- **State** = `started`
- **Health checks** = `1 total, 1 passing`
- **Region** = `nrt` (Tokyo)
- **Image version** matches latest deployment

## 2. Health Check

```bash
fly checks list
```

Expected healthy response:

```json
{
  "ok": true,
  "service": "astrogroot-crawler",
  "mode": "scheduled",
  "intervalHours": 1,
  "isRunning": true
}
```

If the health check is **failing**, check machine events:

```bash
fly machine status <MACHINE_ID>
```

## 3. Recent Logs

```bash
# Last 80 lines (no streaming)
fly logs --no-tail | tail -80

# Live streaming
fly logs
```

**What to look for in logs:**

| Log pattern | Meaning |
|-------------|---------|
| `✅ Collected ...` | Source finished successfully |
| `⏭️ ... already exists, skipping` | Duplicate detected (normal) |
| `✅ Crawl completed` | Full cycle done |
| `💤 Sleeping for N hours...` | Waiting for next cycle |
| `Next crawl at: <timestamp>` | Scheduled next run |
| `⚠️ YouTube API quota exceeded` | YouTube API key quota hit |
| `Error ...` | Something failed — investigate |

## 4. Secrets

```bash
fly secrets list
```

Required secrets:

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Claude AI summarization |
| `ANTHROPIC_MODEL` | Model selection |
| `TURSO_DATABASE_URL` | SQLite (Turso) database |
| `TURSO_AUTH_TOKEN` | Turso auth |
| `CHROMA_HOST` | ChromaDB vector store URL |
| `CHROMA_AUTH_TOKEN` | ChromaDB auth |
| `NASA_API_KEY` | NASA APOD / Image Library |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |

## 5. Machine Details

```bash
fly machine status <MACHINE_ID>
```

Check:
- **State** = `started`, **HostStatus** = `ok`
- **CPU** = shared 1 vCPU, **Memory** = 1024 MB
- **Event Logs** — look for unexpected restarts or OOM kills

Get the machine ID from `fly status` output.

## 6. Common Issues & Fixes

### YouTube API Forbidden / Quota Exceeded

```
Error searching YouTube: Error: YouTube API error: Forbidden
⚠️ YouTube API quota exceeded, stopping all searches
```

- YouTube Data API v3 has a daily quota of 10,000 units.
- **Fix**: Wait for quota reset (midnight Pacific Time), or rotate the API key.
- The crawler continues normally with other sources when this happens.

### No New Items Collected

```
Collected: 0 arXiv, 0 NTRS, 0 videos, 0 NASA items
```

- All items already exist in the database — this is normal for frequent crawls.
- To verify, check that `⏭️ ... already exists, skipping` messages are present.

### Health Check Failing

```bash
# Restart the machine
fly machine restart <MACHINE_ID>

# If restart doesn't help, redeploy
fly deploy
```

### Machine Stopped or OOM

```bash
# Check event logs
fly machine status <MACHINE_ID>

# Look for "exit" or "OOM" events, then restart
fly machine start <MACHINE_ID>
```

### Redeploy

```bash
# Deploy crawler only
deno task fly:crawler

# Deploy all services (crawler + ChromaDB)
deno task fly:deploy
```

## 7. Quick Health Summary Script

One-liner to get a quick status snapshot:

```bash
fly status && echo "---" && fly checks list && echo "---" && fly logs --no-tail | tail -20
```
