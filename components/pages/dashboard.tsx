import type { FC } from "hono/jsx";
import { Layout } from "../layout.tsx";
import type { LibraryStats } from "../../lib/stats.ts";

export const DashboardPage: FC<{ stats?: LibraryStats }> = (props) => {
  const stats = props.stats ?? {
    papers: 0,
    videos: 0,
    nasa: 0,
    total: 0,
  };
  return (
  <Layout pageClass="dashboard" activeNav="dashboard">
    <main class="main-content">
      <section class="stats-section">
        <h2 class="section-title">Library Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📄</div>
            <div class="stat-value">{stats.papers}</div>
            <div class="stat-label">Research Papers</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎥</div>
            <div class="stat-value">{stats.videos}</div>
            <div class="stat-label">Videos</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🚀</div>
            <div class="stat-value">{stats.nasa}</div>
            <div class="stat-label">NASA Content</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">{stats.total}</div>
            <div class="stat-label">Total Items</div>
          </div>
        </div>
      </section>
      <section class="info-section">
        <h2 class="section-title">About AstroGroot</h2>
        <p class="info-text">
          AstroGroot is an automated astronomy research library that collects, processes, and
          indexes content from multiple sources:
        </p>
        <ul class="info-list">
          <li>Research papers from arXiv</li>
          <li>Educational videos from YouTube</li>
          <li>NASA imagery and content</li>
        </ul>
        <p class="info-text">
          All content is processed using Claude AI for summarization and semantic search via vector
          embeddings.
        </p>
      </section>
    </main>
  </Layout>
  );
};
