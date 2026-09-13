# x402 收費可行性評估

評估對象：AstroGroot（Deno 2 + Hono + Turso + ChromaDB）
評估日期：2026-09-13

## 結論

**技術上可行，而且改動不大**（x402 本質就是一層 HTTP middleware，Hono 天然支援）。
但**現階段不建議直接對既有端點開收費**：真正的阻力不在技術，而在內容授權、可賣的價值範圍，
以及收益與成本規模的落差。

建議先做 Phase 0（釐清可賣範圍）與 Phase 1（測試網、獨立付費端點），不要改動現有免費 API。

---

## 一、技術可行性（已實測）

### 1.1 官方套件 `x402-hono` 可在 Deno 上運作

以 Deno 2.9 實測 `npm:x402-hono@^1.2.0` + `npm:hono@^4.6.0`：

```
status: 402
body: {"error":"X-PAYMENT header is required","accepts":[{"scheme":"exact",
       "network":"base-sepolia","maxAmountRequired":"1000", ... }],"x402Version":1}
```

middleware 正確回傳 402 與 payment requirements，不需要任何 Deno 專屬 patch。

**但依賴體積是問題**：`x402-hono` → `x402` core 會一併拉進 `wagmi`、`@reown/appkit`、
`@metamask/sdk`、`@walletconnect/*`、`@solana/kit`、兩個版本的 `viem`，
安裝後 `node_modules` 約 **470 MB**。這些幾乎都是「用戶端錢包連線」用的，
伺服器端收款根本用不到。對 Deno Deploy 的冷啟動與部署體積是實質風險。

### 1.2 自寫 middleware 更適合本專案（已實測）

`exact` scheme 下，伺服器端只需要做三件事：

1. 沒有 `X-PAYMENT` header → 回 402 + `accepts` 陣列
2. 有 header → base64 decode 後 POST 給 facilitator 的 `/verify`
3. 內容產出成功後 POST `/settle`，把結果放進 `X-PAYMENT-RESPONSE`

零額外依賴、約 60–120 行。已用 stub facilitator 實測完整流程：

```
1) 無付款   -> 402（附 accepts）
2) 付款無效 -> 402
3) 付款有效 -> 200 + X-PAYMENT-RESPONSE: {"success":true,"transaction":"0x…"}
```

**伺服器端不需要保管私鑰**，只需要一個收款地址（`payTo`）。簽章驗證與上鏈結算都由
facilitator 完成。這讓安全面比一般金流整合單純很多。

### 1.3 現有程式碼需要修正的點

| # | 位置 | 問題 | 嚴重度 |
|---|------|------|--------|
| 1 | `main.tsx:183` | `/api/*` 的 cache middleware 在 `next()` **之後**設 `Cache-Control: public, max-age=60`，會覆蓋掉付費回應的 `no-store`。實測 402 挑戰與 200 付費結果都被標成可公開快取 —— 等於**付一次、CDN 免費送給全世界**。付費路由必須排除。 | 高 |
| 2 | `main.tsx:66-73` | `/api/mcp` 的 CORS `allowHeaders` 只有 `Content-Type`，需加 `X-PAYMENT` 並 `exposeHeaders: ["X-PAYMENT-RESPONSE"]`。`/api/search` 目前完全沒有 CORS。 | 中 |
| 3 | `lib/rate-limit.ts` | per-IP 限流，付費請求應走獨立 tier，否則付了錢仍被 429。另注意此 middleware KV 失效時 **fail-open**；付費驗證則必須 fail-**closed**，不可沿用同一套容錯策略。 | 中 |
| 4 | `db/schema.ts` | 缺對帳資料。需新增 payments 表（或用 Deno KV）記錄 settle tx hash、payer、resource、金額、時間，供對帳與 idempotency 使用。 | 中 |
| 5 | `main.tsx:704` | MCP 端點收費是最弱的一環，見 §二。 | — |
| 6 | 部署 | 每次付費請求多兩趟 facilitator 往返（約 +300–1000 ms）。`REQUEST_TIMEOUT_MS = 30000` 足夠，但要處理 `/settle` 失敗（內容已產出、錢沒收到）的補償邏輯。 | 低 |

---

## 二、MCP 端點不適合收費

`/api/mcp` 是 JSON-RPC over POST。x402 目前的生態（agent framework、HTTP client middleware）
沒有涵蓋 MCP client：多數 MCP client 收到 402 只會顯示錯誤，不會自動發起付款重試。

務實作法：**MCP 維持免費或改用 API key，付費只做在 `/api/search`**（或新的 `/api/search/pro`）。

---

## 三、內容授權（最大阻力）

一旦收費，「聚合開放資料」就變成「販售第三方內容」，授權標準完全不同。

- **YouTube（風險最高）**：`db/schema.ts` 的 `videos.transcript` 存了完整字幕，且
  `lib/mcp.ts:162` 的 `get_detail` 會直接回傳。字幕是用 `youtube-transcript` 抓的，
  不是官方 API。YouTube 服務條款禁止抓取字幕，開發者政策亦限制販售 API 資料存取。
  **收費前必須先把 videos 內容移出付費回應**，或只保留自產的 AI 摘要與原始連結。
- **arXiv**：metadata 為 CC0，相對安全；abstract 著作權仍屬作者，且需遵守 arXiv API 使用條款與標示要求。
- **NASA / NTRS**：多為公有領域，但有品牌與標示規範，且 `nasa_content.copyright` 欄位顯示部分素材有第三方版權。
- README 已自述「MIT 不重新授權第三方內容」，這點在收費情境下會被放大檢視。

**能理直氣壯賣的只有**：自產的 AI 摘要與三語翻譯、向量檢索與排序結果、聚合後的索引本身。
換句話說，賣的是「檢索服務」，不是「內容」。定價與文案都應該這樣寫。

---

## 四、經濟合理性

現有成本結構（依 `docs/DEPLOYMENT.md` 與 `.env.example`）：

- Deno Deploy 免費、Turso 免費、Fly.io（ChromaDB + crawler）約 $8–12/月
- Anthropic 每日上限 `AI_DAILY_BUDGET_USD=0.50`

要打平大約需 $10–25/月。若定價 $0.001/query，等於每月需要 **10,000–25,000 次付費查詢**。
以目前站點規模，單靠收費回收成本並不現實。

因此收費的真正價值應定位為：

1. **讓 AI agent 能自助付費取用**（x402 的核心場景，也是差異化定位）
2. **以經濟成本抑制濫用** —— 對爬蟲與大量自動化請求，比 per-IP 限流有效得多
3. 營收是附帶效果，不是主要目的

另需處理：收 USDC 屬營業收入，要有記帳與稅務處理（Tokimi 位於台灣）。
單純收取自家服務貨款一般不構成資金移轉業務，但交易紀錄必須留存。

---

## 五、建議路線

| 階段 | 內容 |
|------|------|
| Phase 0 | 界定可賣範圍：把 YouTube transcript 移出付費回應；確認 arXiv/NASA 的標示要求 |
| Phase 1 | base-sepolia 測試網 + 自寫 middleware；**新增** `/api/search/pro`，完全不動現有免費端點 |
| Phase 2 | 修正 cache header、CORS、限流 tier、payments 對帳表；`/settle` 失敗補償 |
| Phase 3 | 切 Base mainnet USDC，facilitator 用 CDP 或自建 |

**不要做**：

- 直接對現有 `/api/search`、`/api/stats` 開收費（會打掉既有使用者與 SEO）
- 對 `/api/mcp` 收費（client 端不支援，只會變成錯誤）
- 為了省事直接引入 `x402-hono` 的 470 MB 依賴樹上 Deno Deploy
