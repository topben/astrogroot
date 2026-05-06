import type { FC } from "hono/jsx";
import { Layout, type AlternateUrls } from "../layout.tsx";
import { SearchBar } from "../search-bar.tsx";
import type { LibraryStats } from "../../lib/stats.ts";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";

export interface DashboardPageProps {
  stats?: LibraryStats;
  locale?: Locale;
  dict?: LocaleDict;
  pageTitle: string;
  pageDescription: string;
  canonicalUrl: string;
  alternateUrls: AlternateUrls;
  siteUrl?: string;
  searchActionUrl?: string;
}

export const DashboardPage: FC<DashboardPageProps> = (props) => {
  const stats = props.stats ?? {
    papers: 0,
    videos: 0,
    nasa: 0,
    total: 0,
  };
  const locale = props.locale ?? "en";
  const d = props.dict;
  const jsonLd = props.siteUrl && props.searchActionUrl
    ? {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: d?.seo?.siteName ?? "AstroGroot",
        url: props.siteUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: props.searchActionUrl,
          "query-input": "required name=search_term_string",
        },
      }
    : null;
  return (
    <Layout
      pageClass="dashboard"
      activeNav="dashboard"
      locale={locale}
      dict={d}
      pageTitle={props.pageTitle}
      pageDescription={props.pageDescription}
      canonicalUrl={props.canonicalUrl}
      alternateUrls={props.alternateUrls}
    >
      <main class="main-content">
        <section class="quick-search-section">
          <h2 class="section-title">{d?.search.title ?? "Search the Library"}</h2>
          <SearchBar compact={true} showSuggestions={true} locale={locale} dict={d} />
        </section>

        <section class="info-section">
          <h2 class="section-title">{d?.tools?.title ?? "Tools"}</h2>
          <a
            href="/rocket-exam"
            class="stat-card"
            style="display:flex;align-items:center;gap:1.25rem;text-decoration:none;text-align:left;padding:1.5rem 2rem;"
          >
            <div class="stat-icon" style="font-size:2.5rem;margin:0;">🚀</div>
            <div style="flex:1;">
              <div style="font-size:1.25rem;font-weight:600;color:#e0e7ff;margin-bottom:0.35rem;">
                {d?.tools?.rocketExamTitle ?? "Rocket Launch License — Mock Exam"}
              </div>
              <div style="font-size:0.95rem;color:#a5b4fc;line-height:1.55;">
                {d?.tools?.rocketExamDesc ?? "2026 Taiwan Cup Level-1 launch license practice — 40 questions, 30 minutes, with a study guide and the full question bank."}
              </div>
            </div>
            <div style="font-size:1.5rem;color:#22d3ee;">→</div>
          </a>
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
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </Layout>
  );
};
