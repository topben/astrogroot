# AstroGroot 部署指南

## 架構概覽

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Deno Deploy    │────▶│     Turso       │◀────│    Fly.io       │
│  (Web App)      │     │   (Database)    │     │                 │
│  免費           │     │   免費 9GB      │     │  ┌───────────┐  │
│                 │     └─────────────────┘     │  │ ChromaDB  │  │
│  main.tsx       │                             │  │ (向量DB)  │  │
│                 │────────────────────────────▶│  └───────────┘  │
└─────────────────┘                             │  ┌───────────┐  │
                                                │  │ Crawler   │  │
                                                │  │ (定時爬蟲)│  │
                                                │  └───────────┘  │
                                                │  ~$8-12/月     │
                                                └─────────────────┘
```

## 資料流

```
1. Crawler (Fly.io)
   ├── 從 arXiv, YouTube, NASA 收集資料
   ├── 用 Anthropic API 產生摘要和翻譯
   ├── 寫入 Turso (SQLite) 資料庫
   └── 寫入 ChromaDB (Fly.io) 向量資料庫

2. Web App (Deno Deploy)
   ├── 從 Turso 讀取資料
   ├── 從 ChromaDB 執行向量搜尋
   └── 提供 UI 和 API
```

---

## 前置需求

### 1. 帳號準備

- [Deno Deploy](https://dash.deno.com) - 免費
- [Fly.io](https://fly.io) - 需信用卡，有免費額度
- [Turso](https://turso.tech) - 免費 9GB
- [Anthropic](https://console.anthropic.com) - API key

### 2. 安裝工具

```bash
# Fly CLI
brew install flyctl
# 或
curl -L https://fly.io/install.sh | sh

# 登入
fly auth login
```

### 3. 建立 Turso 資料庫

```bash
# 安裝 Turso CLI
brew install tursodatabase/tap/turso

# 登入
turso auth login

# 建立資料庫
turso db create astrogroot

# 取得連線資訊
turso db show astrogroot --url
turso db tokens create astrogroot
```

---

## 第一步：部署 Fly.io

### 1.1 部署 ChromaDB

```bash
cd /path/to/astrogroot

# 建立 app (不要立即部署)
fly launch --config fly.chromadb.toml --no-deploy

# 建立持久化儲存 (10GB)
fly volumes create chromadb_data --size 10 --config fly.chromadb.toml

# 設定認證 token (請換成安全的隨機字串)
fly secrets set CHROMA_SERVER_AUTH_CREDENTIALS=your-secure-token-here \
  --config fly.chromadb.toml

# 部署
fly deploy --config fly.chromadb.toml
```

**記下 ChromaDB 網址**: `https://astrogroot-chromadb.fly.dev`

### 1.2 部署 Crawler

```bash
# 建立 app
fly launch --config fly.toml --no-deploy

# 設定環境變數 (請替換成你的值)
fly secrets set \
  TURSO_DATABASE_URL=libsql://your-db.turso.io \
  TURSO_AUTH_TOKEN=your-turso-token \
  ANTHROPIC_API_KEY=sk-ant-xxx \
  CHROMA_HOST=https://astrogroot-chromadb.fly.dev \
  CHROMA_AUTH_TOKEN=your-secure-token-here \
  NASA_API_KEY=your-nasa-key \
  YOUTUBE_API_KEY=your-youtube-key \
  --config fly.toml

# 部署
fly deploy --config fly.toml
```

### 1.3 驗證 Fly.io 部署

```bash
# ChromaDB 狀態
fly status --config fly.chromadb.toml

# Crawler logs
fly logs --config fly.toml

# 查看所有 secrets
fly secrets list --config fly.toml
```

---

## 第二步：部署 Deno Deploy

### 2.1 連接 GitHub

1. 前往 https://dash.deno.com
2. 點擊 **New Project**
3. 選擇 **Deploy from GitHub**
4. 授權並選擇 `astrogroot` repo

### 2.2 設定專案

在 **Settings → Build & Deploy** 設定：

| 設定項 | 值 | 說明 |
|--------|-----|------|
| **Framework preset** | `No Preset` | 不使用框架預設 |
| **Install command** | (留空) | Deno 自動處理依賴 |
| **Build command** | (留空) | 無需建置步驟 |
| **Pre-deploy command** | (留空) | 無需預部署指令 |

**Runtime Configuration:**

| 設定項 | 值 | 說明 |
|--------|-----|------|
| **Runtime** | `Dynamic App` | 動態應用程式 |
| **Entrypoint** | `main.tsx` | 應用程式進入點 |
| **Arguments** | (留空) | 無額外參數 |
| **Runtime Working Directory** | (留空) | 使用預設目錄 |

### 2.3 設定環境變數

在 **Settings → Environment Variables** 加入：

| 變數 | 範例值 |
|------|--------|
| `TURSO_DATABASE_URL` | `libsql://astrogroot-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJhbGciOiJFZERTQSIs...` |
| `CHROMA_HOST` | `https://astrogroot-chromadb.fly.dev` |
| `CHROMA_AUTH_TOKEN` | `your-secure-token-here` |

### 2.4 部署

- 自動部署：推送到 GitHub main branch
- 手動部署：在 Dashboard 點擊 **Deploy**

### 2.5 驗證

```bash
# Health check
curl https://your-app.deno.dev/api/health
# 應該回傳: {"ok":true,"service":"astrogroot",...}

# 測試搜尋
curl "https://your-app.deno.dev/api/search?q=black+holes"
```

---

## 快速部署腳本

專案包含部署腳本：

```bash
# 部署全部 Fly.io 服務
deno task fly:deploy

# 分開部署
deno task fly:chromadb   # 只部署 ChromaDB
deno task fly:crawler    # 只部署 Crawler

# 查看狀態
deno task fly:status
```

---

## 環境變數對照表

| 變數 | Deno Deploy | Fly Crawler | Fly ChromaDB | 說明 |
|------|:-----------:|:-----------:|:------------:|------|
| `TURSO_DATABASE_URL` | ✅ | ✅ | ❌ | Turso 連線網址 |
| `TURSO_AUTH_TOKEN` | ✅ | ✅ | ❌ | Turso 認證 token |
| `CHROMA_HOST` | ✅ | ✅ | ❌ | ChromaDB 網址 |
| `CHROMA_AUTH_TOKEN` | ✅ | ✅ | ❌ | ChromaDB 客戶端認證 |
| `CHROMA_SERVER_AUTH_CREDENTIALS` | ❌ | ❌ | ✅ | ChromaDB 伺服器認證 |
| `ANTHROPIC_API_KEY` | ❌ | ✅ | ❌ | AI 摘要/翻譯 |
| `NASA_API_KEY` | ❌ | ✅ | ❌ | NASA API (可選) |
| `YOUTUBE_API_KEY` | ❌ | ✅ | ❌ | YouTube API (可選) |
| `CRAWLER_INTERVAL_HOURS` | ❌ | ✅ | ❌ | 爬蟲間隔 (預設 24) |
| `MAX_ITEMS_PER_SOURCE` | ❌ | ✅ | ❌ | 每來源最大數量 |

---

## 費用估算

| 服務 | 規格 | 費用 |
|------|------|------|
| Deno Deploy | 免費方案 | $0 (100k req/day) |
| Turso | 免費方案 | $0 (9GB, 500M reads) |
| Fly ChromaDB | shared-cpu-1x, 1GB RAM | ~$5-7/月 |
| Fly Crawler | shared-cpu-1x, 512MB RAM | ~$3-5/月 |
| Anthropic | 按用量計費 | ~$1-5/月 (視爬蟲頻率) |
| **總計** | | **~$9-17/月** |

---

## 常見問題

### Q: ChromaDB 連線失敗？

確認：
1. `CHROMA_HOST` 格式正確 (`https://xxx.fly.dev`，不要加 `/`)
2. `CHROMA_AUTH_TOKEN` 和 `CHROMA_SERVER_AUTH_CREDENTIALS` 一致
3. ChromaDB 已啟動：`fly status --config fly.chromadb.toml`

### Q: 搜尋回傳 0 結果？

1. 確認 Crawler 有執行過：`fly logs --config fly.toml`
2. 檢查 ChromaDB 有資料
3. 確認 Deno Deploy 的 `CHROMA_HOST` 設定正確

### Q: arXiv API 500 錯誤？

arXiv API 偶爾不穩定，Crawler 會自動重試並使用 fallback query。這是正常的。

### Q: 如何手動觸發 Crawler？

```bash
# SSH 進入 Crawler
fly ssh console --config fly.toml

# 執行單次爬蟲
deno task worker
```

---

## 監控與除錯

```bash
# Fly.io logs (即時)
fly logs --config fly.toml
fly logs --config fly.chromadb.toml

# Deno Deploy logs
# 在 Dashboard → Logs 查看

# 檢查資料庫
turso db shell astrogroot
> SELECT COUNT(*) FROM papers;
> SELECT COUNT(*) FROM videos;
> SELECT COUNT(*) FROM translations;
```

---

## 更新部署

### Deno Deploy
推送到 GitHub 會自動部署。

### Fly.io
```bash
fly deploy --config fly.toml
fly deploy --config fly.chromadb.toml
```
