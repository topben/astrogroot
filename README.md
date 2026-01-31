# <img width="566" height="494" alt="image" src="https://github.com/user-attachments/assets/12645467-3140-4537-9f3d-5206358aafc1" />
 AstroGroot

**An automated astronomy research library powered by AI**

AstroGroot collects, processes, and indexes astronomy content from multiple sources (arXiv, YouTube, NASA) and makes it searchable through semantic vector search and AI-powered summaries.

## ✨ Features

- 📄 **arXiv Papers**: Automatic collection of astronomy research papers
- 🎥 **YouTube Videos**: Educational astronomy content with transcript extraction
- 🚀 **NASA Content**: APOD (Astronomy Picture of the Day) and NASA Image Library
- 🤖 **AI Processing**: Claude-powered summarization and translation
- 🔍 **Semantic Search**: Vector-based search using ChromaDB embeddings
- 🌐 **Web Dashboard**: Browse and search your library
- 🔌 **MCP Server**: Integration with Claude Desktop via Model Context Protocol

## 🏗️ Architecture

```
├── deno.json                # Project config & dependencies
├── main.tsx                 # Hono app entry (routes, API, static)
├── drizzle.config.ts        # Drizzle ORM configuration
├── docker-compose.yml       # ChromaDB & Redis services
├── .env.example             # Environment variables template
│
├── db/                      # Database Layer (Drizzle + Turso)
│   ├── client.ts            # Turso/LibSQL connection
│   └── schema.ts            # Database schema
│
├── lib/                     # Shared Libraries
│   ├── vector.ts            # ChromaDB wrapper
│   ├── mcp.ts               # MCP request handler (getStats, listMethods, etc.)
│   ├── ai/
│   │   ├── client.ts        # Anthropic SDK client
│   │   └── processor.ts     # AI summarization & translation
│   └── collectors/
│       ├── nasa.ts          # NASA API integration
│       ├── arxiv.ts         # arXiv API integration
│       └── youtube.ts       # YouTube transcript extraction
│
├── components/              # Hono JSX UI (server-rendered)
│   ├── layout.tsx           # Shared layout (starfield, nav, styles)
│   ├── search-bar.tsx       # Search form + filters
│   └── pages/
│       ├── dashboard.tsx    # Dashboard (stats, about)
│       ├── search.tsx       # Search page
│       └── not-found.tsx    # 404 page
│
├── static/                  # Static assets
│   └── astrogroot-logo.png  # Logo (transparent)
│
└── workers/                 # Background Processing
    └── crawler.ts           # Automated data collection worker
```

## 🚀 Quick Start

### Prerequisites

- [Deno](https://deno.land/) 2.0 or higher
- [Docker](https://www.docker.com/) and Docker Compose
- [Turso](https://turso.tech/) database account
- [Anthropic API key](https://console.anthropic.com/)
- (Optional) [YouTube Data API key](https://developers.google.com/youtube/v3/getting-started)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/astrogroot.git
cd astrogroot
```

2. **Set up environment variables**

```bash
cp .env.example .env
# Edit .env with your API keys and credentials
```

Required environment variables:

```env
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# AI Processing (Anthropic)
ANTHROPIC_API_KEY=sk-ant-api-key-here

# Vector Store (ChromaDB)
CHROMA_HOST=http://localhost:8000
CHROMA_AUTH_TOKEN=astrogroot-token

# Optional
NASA_API_KEY=DEMO_KEY
YOUTUBE_API_KEY=your-youtube-api-key
```

3. **Start infrastructure services**

```bash
docker-compose up -d
```

This starts:
- ChromaDB (vector database) on port 8000. The crawler uses a built-in embedding function (no extra dependency). For stronger semantic search, you can install `chromadb-default-embed` (see ChromaDB docs).
- Redis (optional, for task queues) on port 6379

4. **Initialize the database**

```bash
# Generate migrations
deno task db:generate

# Push schema to Turso
deno task db:push
```

5. **Install dependencies**

Deno will automatically install dependencies on first run, but you can pre-cache them:

```bash
deno cache --reload deno.json
```

## 📖 Usage

### Running the Web Server

Start the Hono development server:

```bash
deno task dev
```

Visit the URL shown in the terminal (e.g. http://localhost:8000 or http://localhost:8001) to access the dashboard. If port 8000 is in use (e.g. by ChromaDB when using Docker), the server will try the next available port.

**Tip:** When running Docker (ChromaDB on 8000), set `PORT=8001` in `.env` so the web app uses 8001 and avoids port conflict.

**Verify everything is running:**

```bash
# Check Docker containers (ChromaDB, Redis)
docker compose ps

# Check web app (replace 8001 with your app port if different)
curl -s http://localhost:8001/api/health
# → {"ok":true,"service":"astrogroot","timestamp":"..."}
```

The dashboard shows **Library Statistics** as 0 until you run the crawler to collect data. The app is running if you see the dashboard and `/api/health` returns `ok: true`.

### Running the Crawler

The crawler collects data from arXiv, YouTube, and NASA sources.

**Single run** (collect data once):

```bash
deno task worker
```

**Scheduled mode** (runs every 24 hours):

```bash
deno run --allow-all workers/crawler.ts scheduled
```

### Using the Search Interface

1. Navigate to http://localhost:8000/search
2. Enter your query (e.g., "black hole formation", "exoplanet detection")
3. Filter by content type (papers, videos, NASA)
4. Results are ranked by semantic similarity using vector embeddings

### MCP Server Integration

AstroGroot includes an MCP (Model Context Protocol) server for integration with Claude Desktop.

**Available MCP methods:**

- `getStats` - Get library statistics (papers, videos, NASA counts)
- `listMethods` - List all available methods
- `search` - Search the library (advertised; implementation in progress)

**Example MCP request:**

```bash
curl -X POST http://localhost:8000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "search",
    "params": {
      "query": "gravitational waves",
      "type": "papers",
      "limit": 5
    }
  }'
```

## 🚀 Deploying to Deno Deploy

The web app is ready for [Deno Deploy](https://deno.com/deploy). On Deploy, the app uses `Deno.serve(app.fetch)` (no port binding); locally it binds to `PORT` or 8000.

**1. Create a project on [Deno Deploy](https://deno.com/deploy)** and connect your GitHub repo.

**2. Configure the build:**
- **Entrypoint:** `main.tsx`
- **Root directory:** (leave default, or set if in a subdirectory)

**3. Set environment variables** in the Deploy dashboard (Project → Settings → Environment Variables):

| Variable | Required | Description |
|----------|----------|-------------|
| `TURSO_DATABASE_URL` | Yes | Turso database URL (e.g. `libsql://your-db.turso.io`) |
| `TURSO_AUTH_TOKEN` | Yes | Turso auth token |
| `CHROMA_HOST` | For search | ChromaDB URL (e.g. a remote Chroma instance). If unset, search may fail. |
| `CHROMA_AUTH_TOKEN` | Optional | If your Chroma server uses auth |
| `NASA_API_KEY` | Optional | NASA API key (defaults to DEMO_KEY) |
| `ANTHROPIC_API_KEY` | Optional | Only if you add AI features that call Claude from the server |

**4. Deploy.** The dashboard, search page, and API routes will be served. The **crawler/worker** does not run on Deploy (serverless); run it elsewhere (e.g. cron + `deno task worker`) to populate the database and Chroma.

**5. Optional:** Use a remote ChromaDB (e.g. [Chroma Cloud](https://www.trychroma.com/) or a VPS) and set `CHROMA_HOST` so `/api/search` works on Deploy.

## 🧪 Development

### Database Management

```bash
# Generate new migrations
deno task db:generate

# Push schema changes
deno task db:push

# Open Drizzle Studio (database GUI)
deno task db:studio
```

### Project Structure

- **Database Layer**: Drizzle ORM with Turso (LibSQL)
- **Vector Store**: ChromaDB for semantic search
- **AI Processing**: Anthropic Claude for summarization
- **Web Framework**: [Hono](https://hono.dev/) with server-side JSX (Deno)
- **Background Workers**: Deno native with scheduled execution

### Adding New Data Sources

1. Create a new collector in `lib/collectors/`
2. Define the data schema in `db/schema.ts`
3. Update the crawler in `workers/crawler.ts`
4. Add vector storage in the appropriate collection

## 🔧 Configuration

### Crawler Settings

Adjust crawler behavior via environment variables:

```env
CRAWLER_INTERVAL_HOURS=24      # How often to run (default: 24)
MAX_ITEMS_PER_SOURCE=50        # Max items per source per run (default: 50)
```

### arXiv Categories

The crawler collects from these astronomy categories by default:

- `astro-ph.CO` - Cosmology and Nongalactic Astrophysics
- `astro-ph.EP` - Earth and Planetary Astrophysics
- `astro-ph.GA` - Astrophysics of Galaxies
- `astro-ph.HE` - High Energy Astrophysical Phenomena
- `astro-ph.IM` - Instrumentation and Methods
- `astro-ph.SR` - Solar and Stellar Astrophysics
- `gr-qc` - General Relativity and Quantum Cosmology
- `physics.space-ph` - Space Physics

Modify in `lib/collectors/arxiv.ts`.

## 📊 Data Flow

1. **Collection**: Crawler fetches data from arXiv, YouTube, NASA
2. **Processing**: Claude AI generates summaries and extracts key points
3. **Storage**: Data saved to Turso database
4. **Indexing**: Embeddings stored in ChromaDB for semantic search
5. **Query**: Users search via web UI or MCP server
6. **Retrieval**: Vector search finds relevant content

## 🌟 Use Cases

- **Research**: Quickly find relevant astronomy papers and summaries
- **Education**: Discover educational videos on specific topics
- **Exploration**: Browse NASA imagery and explanations
- **Integration**: Use MCP server to query from Claude Desktop
- **Personal Library**: Build a curated astronomy knowledge base

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Use Deno's built-in formatter: `deno fmt`
5. Use Deno's linter: `deno lint`

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [arXiv](https://arxiv.org/) for open access to research papers
- [NASA](https://www.nasa.gov/) for public APIs and imagery
- [Anthropic](https://www.anthropic.com/) for Claude AI
- [ChromaDB](https://www.trychroma.com/) for vector database
- [Turso](https://turso.tech/) for serverless SQLite
- [Deno](https://deno.land/) for the modern JavaScript runtime

## 📞 Support

For issues, questions, or contributions:
- Create an issue on GitHub
- Join our discussions
- Check the documentation

---

**Built with ❤️ using Deno, Hono, Claude AI, and open astronomy data**
