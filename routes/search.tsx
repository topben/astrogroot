import { PageProps } from "fresh";
import { Handlers } from "fresh";
import SearchBar, { SearchFilters } from "../components/SearchBar.tsx";
import { initializeCollections } from "../lib/vector.ts";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  type: "paper" | "video" | "nasa";
  url: string;
  score: number;
  metadata?: Record<string, string | number | boolean>;
}

interface SearchData {
  results: SearchResult[];
  query: string;
  totalResults: number;
}

export const handler: Handlers<SearchData | null> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const query = url.searchParams.get("q");
    const type = url.searchParams.get("type") || "all";

    if (!query) {
      return ctx.render(null);
    }

    try {
      const collections = await initializeCollections();
      const results: SearchResult[] = [];

      // Search papers
      if (type === "all" || type === "papers") {
        const paperResults = await collections.papers.query({
          queryText: query,
          nResults: 10,
        });

        for (let i = 0; i < paperResults.ids[0].length; i++) {
          const id = paperResults.ids[0][i];
          const doc = paperResults.documents[0][i];
          const distance = paperResults.distances[0][i];
          const metadata = paperResults.metadatas[0][i];

          results.push({
            id,
            title: (metadata?.title as string) || id,
            snippet: doc?.substring(0, 200) || "",
            type: "paper",
            url: `https://arxiv.org/abs/${id}`,
            score: 1 - distance,
            metadata,
          });
        }
      }

      // Search videos
      if (type === "all" || type === "videos") {
        const videoResults = await collections.videos.query({
          queryText: query,
          nResults: 10,
        });

        for (let i = 0; i < videoResults.ids[0].length; i++) {
          const id = videoResults.ids[0][i];
          const doc = videoResults.documents[0][i];
          const distance = videoResults.distances[0][i];
          const metadata = videoResults.metadatas[0][i];

          results.push({
            id,
            title: (metadata?.title as string) || id,
            snippet: doc?.substring(0, 200) || "",
            type: "video",
            url: `https://youtube.com/watch?v=${id}`,
            score: 1 - distance,
            metadata,
          });
        }
      }

      // Search NASA content
      if (type === "all" || type === "nasa") {
        const nasaResults = await collections.nasa.query({
          queryText: query,
          nResults: 10,
        });

        for (let i = 0; i < nasaResults.ids[0].length; i++) {
          const id = nasaResults.ids[0][i];
          const doc = nasaResults.documents[0][i];
          const distance = nasaResults.distances[0][i];
          const metadata = nasaResults.metadatas[0][i];

          results.push({
            id,
            title: (metadata?.title as string) || id,
            snippet: doc?.substring(0, 200) || "",
            type: "nasa",
            url: (metadata?.url as string) || "",
            score: 1 - distance,
            metadata,
          });
        }
      }

      // Sort by score
      results.sort((a, b) => b.score - a.score);

      return ctx.render({
        results,
        query,
        totalResults: results.length,
      });
    } catch (error) {
      console.error("Search error:", error);
      return ctx.render({
        results: [],
        query,
        totalResults: 0,
      });
    }
  },
};

export default function Search({ data }: PageProps<SearchData | null>) {
  const handleSearch = (query: string, filters: SearchFilters) => {
    const params = new URLSearchParams({ q: query });
    if (filters.type && filters.type !== "all") {
      params.set("type", filters.type);
    }
    window.location.href = `/search?${params.toString()}`;
  };

  return (
    <div class="search-page">
      <header class="header">
        <h1>
          <a href="/">🌌 AstroGroot</a>
        </h1>
      </header>

      <nav class="navigation">
        <a href="/" class="nav-link">Dashboard</a>
        <a href="/search" class="nav-link active">Search</a>
      </nav>

      <main class="main-content">
        <div class="search-container">
          <SearchBar onSearch={handleSearch} />
        </div>

        {data && (
          <div class="results-container">
            <div class="results-header">
              <h2>
                {data.totalResults} result{data.totalResults !== 1 ? "s" : ""} for "{data.query}"
              </h2>
            </div>

            {data.results.length > 0 ? (
              <div class="results-list">
                {data.results.map((result) => (
                  <div key={result.id} class="result-card">
                    <div class={`result-type ${result.type}`}>
                      {result.type === "paper" && "📄 Paper"}
                      {result.type === "video" && "🎥 Video"}
                      {result.type === "nasa" && "🚀 NASA"}
                    </div>
                    <h3>
                      <a href={result.url} target="_blank">
                        {result.title}
                      </a>
                    </h3>
                    <p class="snippet">{result.snippet}...</p>
                    <div class="result-meta">
                      <span class="score">
                        Relevance: {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div class="no-results">
                <p>No results found for your query.</p>
                <p>Try different keywords or check if the crawler has collected data.</p>
              </div>
            )}
          </div>
        )}

        {!data && (
          <div class="search-prompt">
            <h2>Search the Library</h2>
            <p>
              Search through thousands of astronomy papers, videos, and NASA content using natural
              language queries.
            </p>
            <p>Try searching for:</p>
            <ul>
              <li>Black holes and gravitational waves</li>
              <li>Exoplanet detection methods</li>
              <li>Mars rover discoveries</li>
              <li>Dark matter research</li>
            </ul>
          </div>
        )}
      </main>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .search-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .header {
          text-align: center;
          padding: 2rem 1rem;
        }

        .header h1 a {
          color: white;
          text-decoration: none;
          font-size: 2.5rem;
        }

        .navigation {
          display: flex;
          justify-content: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .nav-link {
          padding: 0.75rem 1.5rem;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .nav-link:hover,
        .nav-link.active {
          background: rgba(255, 255, 255, 0.2);
        }

        .main-content {
          max-width: 900px;
          margin: 2rem auto;
          padding: 0 1rem;
        }

        .search-container {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }

        .results-container {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .results-header h2 {
          color: #667eea;
          margin-bottom: 1.5rem;
        }

        .results-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .result-card {
          padding: 1.5rem;
          border: 1px solid #eee;
          border-radius: 8px;
          transition: box-shadow 0.2s;
        }

        .result-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .result-type {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .result-type.paper {
          background: #e3f2fd;
          color: #1976d2;
        }

        .result-type.video {
          background: #fce4ec;
          color: #c2185b;
        }

        .result-type.nasa {
          background: #f3e5f5;
          color: #7b1fa2;
        }

        .result-card h3 {
          margin-bottom: 0.75rem;
        }

        .result-card h3 a {
          color: #333;
          text-decoration: none;
        }

        .result-card h3 a:hover {
          color: #667eea;
        }

        .snippet {
          color: #666;
          line-height: 1.6;
          margin-bottom: 0.75rem;
        }

        .result-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
          color: #999;
        }

        .score {
          font-weight: 600;
          color: #667eea;
        }

        .no-results {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        .no-results p {
          margin-bottom: 0.75rem;
        }

        .search-prompt {
          background: white;
          border-radius: 12px;
          padding: 3rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .search-prompt h2 {
          color: #667eea;
          margin-bottom: 1rem;
        }

        .search-prompt p {
          margin-bottom: 1rem;
          line-height: 1.6;
        }

        .search-prompt ul {
          margin-left: 2rem;
          line-height: 1.8;
        }
      `}</style>
    </div>
  );
}
