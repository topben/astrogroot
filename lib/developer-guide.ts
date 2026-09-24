import type { Locale } from "./i18n.ts";

export const IFF_SERVICES = {
  monitor: {
    name: "x402 Evidence Monitor",
    product: "https://ifandonlyif.io/monitor",
    docs: "https://ifandonlyif.io/sdk#mcp",
    api: "https://ifandonlyif.io/docs",
    endpoint: "https://iff-mcp-api-production.up.railway.app/mcp/iff",
  },
  apostille: {
    name: "Apostille",
    product: "https://ifandonlyif.io/apostille",
    docs: "https://ifandonlyif.io/apostille/docs#mcp",
    api: "https://ifandonlyif.io/apostille/downloads",
    endpoint: "https://iff-mcp-api-production.up.railway.app/mcp/apostille",
  },
} as const;

export const DEVELOPER_GUIDE = {
  en: {
    title: "Tools for agents and developers",
    description:
      "Discover AstroGroot research APIs and IFF's public evidence and signature-verification tools.",
    intro:
      "Search the research library, inspect a public x402 endpoint, or verify a signed artifact. Choose the tool for the evidence you need.",
    relationship:
      "AstroGroot and IFF are products by Tokimi. IFF is a separate service; these links do not mean the library's papers or AI summaries have been verified by IFF.",
    monitor:
      "Read observations of public x402 endpoints: protocol behavior, availability, freshness and signed provenance. Supply an endpoint URL, or payment requirements for comparison; receive evidence with explicit limits. IFF does not send payments or guarantee delivery.",
    apostille:
      "Verify a signed bundle against independently chosen issuer and key pins, or inspect public issuer data. The result describes signatures and recorded checks; it does not establish content truth, legal identity or legal effect.",
    access: "Public MCP · Alpha · Read-only",
    endpoint: "Streamable HTTP endpoint",
    setup: "MCP setup and capabilities",
    apiDocs: "HTTP API reference",
    localTools: "Local SDK, CLI and verifier",
    product: "Explore the product",
    boundary:
      "The public MCP services require no account or API token. Checks run on IFF's hosted server. They cannot sign, publish or pay. Send only the public data required by a tool; never send private keys or original files. For independent offline verification, use the local Apostille tools and your own trusted key pins.",
    connect:
      "Add the chosen endpoint in a compatible MCP client, review its tools, then call a tool relevant to your task. Reading this page does not connect or authorize a client.",
    researchTitle: "Use the AstroGroot library",
    researchDescription:
      "The existing research interfaces return papers, videos and NASA content. IFF is not required to use them.",
    searchLabel: "Search API · GET",
    searchDescription:
      "Query with q; optional type: all, papers, videos or nasa. Set lang to en, zh-TW or zh-CN. Results contain matched items and a total count. No API key is required.",
    mcpLabel: "Research MCP · JSON-RPC over HTTP POST",
    mcpDescription:
      "The existing endpoint supports initialize (protocol 2024-11-05), tools/list and tools/call. Its tools are search, get_stats and get_detail. Check your client's transport compatibility; this is separate from IFF's Streamable HTTP services.",
    limits:
      "Requests are rate-limited. Respect HTTP 429 and Retry-After, use bounded retries, and request only the data needed for your task. The site's robots.txt crawl rules still apply.",
    directory: "More tools from Tokimi",
    directoryDescription: "Explore the team's products and their published developer resources.",
    returnHome: "Back to the research library",
    plainText: "Plain-text discovery guide",
  },
  "zh-TW": {
    title: "給 AI agent 與開發者的工具",
    description: "探索 AstroGroot 研究 API，以及 IFF 的公開端點觀測與簽章驗證工具。",
    intro: "搜尋研究資料、檢視公開 x402 端點，或查驗已簽署的產物。依需要的證據，選擇對應工具。",
    relationship:
      "AstroGroot 與 IFF 都是時見旗下產品。IFF 是獨立服務；這些連結不代表資料庫中的論文或 AI 摘要已通過 IFF 驗證。",
    monitor:
      "讀取公開 x402 端點的協定行為、可用性、新鮮度與簽章來源。提供端點網址，或供比較的付款要求，取得有明確範圍的觀測證據。IFF 不會送出付款，也不保證服務交付。",
    apostille:
      "提供已簽署的 bundle 與自行選定的 issuer／key pin，查驗簽章，或檢視公開 issuer 資料。結果說明簽章與已記錄的檢查，不確立內容真實性、法律身分或法律效力。",
    access: "公開 MCP · Alpha · 唯讀",
    endpoint: "Streamable HTTP 端點",
    setup: "MCP 設定與工具說明",
    apiDocs: "HTTP API 文件",
    localTools: "本機 SDK、CLI 與查驗器",
    product: "了解產品",
    boundary:
      "公開 MCP 不需要帳號或 API token，檢查在 IFF 伺服器執行，不能簽署、發布或付款。只提供工具需要的公開資料，請勿傳送私鑰或原始檔案。需要獨立離線驗證時，請使用本機 Apostille 工具及自行信任的 key pin。",
    connect:
      "在相容的 MCP 用戶端加入所選端點，檢視工具後，再依任務呼叫。閱讀本頁不會自動連接或授權用戶端。",
    researchTitle: "使用 AstroGroot 研究資料庫",
    researchDescription: "既有研究介面提供論文、影片及 NASA 內容，使用時不需要 IFF。",
    searchLabel: "搜尋 API · GET",
    searchDescription:
      "以 q 查詢，可選 type：all、papers、videos 或 nasa。lang 支援 en、zh-TW、zh-CN。結果包含符合項目及總數，不需要 API key。",
    mcpLabel: "研究 MCP · 以 HTTP POST 傳送 JSON-RPC",
    mcpDescription:
      "既有端點支援 initialize（協定 2024-11-05）、tools/list 與 tools/call，提供 search、get_stats、get_detail 三個工具。請確認用戶端的傳輸相容性；此介面與 IFF 的 Streamable HTTP 服務各自獨立。",
    limits:
      "請求設有速率限制。請遵守 HTTP 429 與 Retry-After、限制重試次數，並只取得任務需要的資料。網站的 robots.txt 爬取規則仍適用。",
    directory: "探索時見的其他工具",
    directoryDescription: "查看同團隊產品及已公開的開發者資源。",
    returnHome: "回到研究資料庫",
    plainText: "純文字工具導覽",
  },
  "zh-CN": {
    title: "面向 AI agent 与开发者的工具",
    description: "探索 AstroGroot 研究 API，以及 IFF 的公开端点观测与签名验证工具。",
    intro: "搜索研究资料、检查公开 x402 端点，或验证已签名的产物。按所需证据选择对应工具。",
    relationship:
      "AstroGroot 与 IFF 都是时见旗下产品。IFF 是独立服务；这些链接不代表资料库中的论文或 AI 摘要已通过 IFF 验证。",
    monitor:
      "读取公开 x402 端点的协议行为、可用性、新鲜度与签名来源。提供端点网址，或用于比较的付款要求，取得范围明确的观测证据。IFF 不会发送付款，也不保证服务交付。",
    apostille:
      "提供已签名的 bundle 与自行选定的 issuer／key pin，验证签名，或检查公开 issuer 数据。结果说明签名与已记录的检查，不确立内容真实性、法律身份或法律效力。",
    access: "公开 MCP · Alpha · 只读",
    endpoint: "Streamable HTTP 端点",
    setup: "MCP 配置与工具说明",
    apiDocs: "HTTP API 文档",
    localTools: "本地 SDK、CLI 与验证器",
    product: "了解产品",
    boundary:
      "公开 MCP 不需要账号或 API token，检查在 IFF 服务器执行，不能签名、发布或付款。只提供工具需要的公开数据，请勿发送私钥或原始文件。需要独立离线验证时，请使用本地 Apostille 工具及自行信任的 key pin。",
    connect:
      "在兼容的 MCP 客户端添加所选端点，查看工具后，再按任务调用。阅读本页不会自动连接或授权客户端。",
    researchTitle: "使用 AstroGroot 研究资料库",
    researchDescription: "现有研究接口提供论文、视频及 NASA 内容，使用时不需要 IFF。",
    searchLabel: "搜索 API · GET",
    searchDescription:
      "通过 q 查询，可选 type：all、papers、videos 或 nasa。lang 支持 en、zh-TW、zh-CN。结果包含匹配项及总数，不需要 API key。",
    mcpLabel: "研究 MCP · 通过 HTTP POST 发送 JSON-RPC",
    mcpDescription:
      "现有端点支持 initialize（协议 2024-11-05）、tools/list 与 tools/call，提供 search、get_stats、get_detail 三个工具。请确认客户端的传输兼容性；此接口与 IFF 的 Streamable HTTP 服务相互独立。",
    limits:
      "请求设有速率限制。请遵守 HTTP 429 与 Retry-After、限制重试次数，并只获取任务所需数据。网站的 robots.txt 抓取规则仍适用。",
    directory: "探索时见的其他工具",
    directoryDescription: "查看同团队产品及已公开的开发者资源。",
    returnHome: "返回研究资料库",
    plainText: "纯文本工具指南",
  },
} satisfies Record<Locale, Record<string, string>>;
