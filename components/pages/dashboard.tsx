import type { FC } from "hono/jsx";
import { Layout } from "../layout.tsx";
import { SearchBar } from "../search-bar.tsx";
import type { LibraryStats } from "../../lib/stats.ts";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";

export const DashboardPage: FC<{ stats?: LibraryStats; locale?: Locale; dict?: LocaleDict }> = (props) => {
  const stats = props.stats ?? {
    papers: 0,
    videos: 0,
    nasa: 0,
    total: 0,
  };
  const locale = props.locale ?? "en";
  const d = props.dict;
  return (
  <Layout pageClass="dashboard" activeNav="dashboard" locale={locale} dict={d}>
    <main class="main-content">
      {/* Quick Search Section */}
      <section class="quick-search-section">
        <h2 class="section-title">{d?.search.title ?? "Search the Library"}</h2>
        <SearchBar compact={true} showSuggestions={true} locale={locale} dict={d} />
      </section>

      <section class="stats-section">
        <h2 class="section-title">{d?.stats.title ?? "Library Statistics"}</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📄</div>
            <div class="stat-value">{stats.papers}</div>
            <div class="stat-label">{d?.stats.papers ?? "Research Papers"}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎥</div>
            <div class="stat-value">{stats.videos}</div>
            <div class="stat-label">{d?.stats.videos ?? "Videos"}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🚀</div>
            <div class="stat-value">{stats.nasa}</div>
            <div class="stat-label">{d?.stats.nasa ?? "NASA Content"}</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">{stats.total}</div>
            <div class="stat-label">{d?.stats.total ?? "Total Items"}</div>
          </div>
        </div>
      </section>
      <section class="info-section">
        <h2 class="section-title">{d?.about.title ?? "About AstroGroot"}</h2>
        <p class="info-text">{d?.about.intro ?? "AstroGroot is an automated astronomy research library that collects, processes, and indexes content from multiple sources:"}</p>
        <ul class="info-list">
          <li>{d?.about.sources.papers ?? "Research papers from arXiv"}</li>
          <li>{d?.about.sources.videos ?? "Educational videos from YouTube"}</li>
          <li>{d?.about.sources.nasa ?? "NASA imagery and content"}</li>
        </ul>
        <p class="info-text">{d?.about.ai ?? "All content is processed using Claude AI for summarization and semantic search via vector embeddings."}</p>
      </section>
    </main>
  </Layout>
  );
};
