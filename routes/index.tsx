import { PageProps } from "fresh";
import { Handlers } from "fresh";
import { db } from "../db/client.ts";
import { papers, videos, nasaContent } from "../db/schema.ts";
import { count } from "drizzle-orm";

interface DashboardData {
  stats: {
    totalPapers: number;
    totalVideos: number;
    totalNasaContent: number;
    processedItems: number;
  };
  recentPapers: Array<{
    id: string;
    title: string;
    publishedDate: Date | null;
  }>;
  recentVideos: Array<{
    id: string;
    title: string;
    publishedDate: Date | null;
  }>;
}

export const handler: Handlers<DashboardData> = {
  async GET(_req, ctx) {
    try {
      // Fetch statistics
      const [paperCount, videoCount, nasaCount] = await Promise.all([
        db.select({ count: count() }).from(papers),
        db.select({ count: count() }).from(videos),
        db.select({ count: count() }).from(nasaContent),
      ]);

      // Fetch recent items
      const recentPapers = await db
        .select({
          id: papers.id,
          title: papers.title,
          publishedDate: papers.publishedDate,
        })
        .from(papers)
        .orderBy(papers.createdAt)
        .limit(5);

      const recentVideos = await db
        .select({
          id: videos.id,
          title: videos.title,
          publishedDate: videos.publishedDate,
        })
        .from(videos)
        .orderBy(videos.createdAt)
        .limit(5);

      const data: DashboardData = {
        stats: {
          totalPapers: paperCount[0]?.count || 0,
          totalVideos: videoCount[0]?.count || 0,
          totalNasaContent: nasaCount[0]?.count || 0,
          processedItems:
            (paperCount[0]?.count || 0) +
            (videoCount[0]?.count || 0) +
            (nasaCount[0]?.count || 0),
        },
        recentPapers,
        recentVideos,
      };

      return ctx.render(data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      return ctx.render({
        stats: {
          totalPapers: 0,
          totalVideos: 0,
          totalNasaContent: 0,
          processedItems: 0,
        },
        recentPapers: [],
        recentVideos: [],
      });
    }
  },
};

export default function Home({ data }: PageProps<DashboardData>) {
  const { stats, recentPapers, recentVideos } = data;

  return (
    <div class="dashboard">
      <header class="header">
        <h1>🌌 AstroGroot Research Library</h1>
        <p>Your astronomy and space science knowledge hub</p>
      </header>

      <nav class="navigation">
        <a href="/" class="nav-link active">Dashboard</a>
        <a href="/search" class="nav-link">Search</a>
      </nav>

      <main class="main-content">
        <section class="stats-section">
          <h2>Library Statistics</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{stats.totalPapers}</div>
              <div class="stat-label">Research Papers</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.totalVideos}</div>
              <div class="stat-label">Videos</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.totalNasaContent}</div>
              <div class="stat-label">NASA Content</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.processedItems}</div>
              <div class="stat-label">Total Items</div>
            </div>
          </div>
        </section>

        <div class="recent-content">
          <section class="recent-section">
            <h2>Recent Papers</h2>
            {recentPapers.length > 0 ? (
              <ul class="content-list">
                {recentPapers.map((paper) => (
                  <li key={paper.id}>
                    <a href={`https://arxiv.org/abs/${paper.id}`} target="_blank">
                      {paper.title}
                    </a>
                    <span class="date">
                      {paper.publishedDate
                        ? new Date(paper.publishedDate).toLocaleDateString()
                        : "Unknown"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="empty-state">No papers yet. Run the crawler to collect data.</p>
            )}
          </section>

          <section class="recent-section">
            <h2>Recent Videos</h2>
            {recentVideos.length > 0 ? (
              <ul class="content-list">
                {recentVideos.map((video) => (
                  <li key={video.id}>
                    <a href={`https://youtube.com/watch?v=${video.id}`} target="_blank">
                      {video.title}
                    </a>
                    <span class="date">
                      {video.publishedDate
                        ? new Date(video.publishedDate).toLocaleDateString()
                        : "Unknown"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="empty-state">No videos yet. Run the crawler to collect data.</p>
            )}
          </section>
        </div>

        <section class="info-section">
          <h2>About AstroGroot</h2>
          <p>
            AstroGroot is an automated astronomy research library that collects, processes, and
            indexes content from multiple sources:
          </p>
          <ul>
            <li>📄 Research papers from arXiv</li>
            <li>🎥 Educational videos from YouTube</li>
            <li>🚀 NASA imagery and content</li>
          </ul>
          <p>
            All content is processed using Claude AI for summarization and semantic search via
            vector embeddings.
          </p>
        </section>
      </main>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .dashboard {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .header {
          text-align: center;
          padding: 3rem 1rem;
          color: white;
        }

        .header h1 {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .header p {
          font-size: 1.25rem;
          opacity: 0.9;
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
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 1rem;
        }

        .stats-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .stats-section h2 {
          margin-bottom: 1.5rem;
          color: #667eea;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .stat-card {
          text-align: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          color: white;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .recent-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .recent-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .recent-section h2 {
          margin-bottom: 1rem;
          color: #667eea;
        }

        .content-list {
          list-style: none;
        }

        .content-list li {
          padding: 0.75rem 0;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .content-list li:last-child {
          border-bottom: none;
        }

        .content-list a {
          color: #667eea;
          text-decoration: none;
          flex: 1;
        }

        .content-list a:hover {
          text-decoration: underline;
        }

        .date {
          font-size: 0.875rem;
          color: #999;
          white-space: nowrap;
        }

        .empty-state {
          color: #999;
          font-style: italic;
        }

        .info-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .info-section h2 {
          margin-bottom: 1rem;
          color: #667eea;
        }

        .info-section p {
          margin-bottom: 1rem;
          line-height: 1.6;
        }

        .info-section ul {
          margin-left: 1.5rem;
          line-height: 1.8;
        }
      `}</style>
    </div>
  );
}
