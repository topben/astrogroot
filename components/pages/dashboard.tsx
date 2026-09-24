import type { FC } from "hono/jsx";
import { type AlternateUrls, Layout } from "../layout.tsx";
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
  const numberFormat = new Intl.NumberFormat(locale);
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
      <main class="main-content" id="main-content">
        <section class="quick-search-section" aria-labelledby="quick-search-title">
          <h2 class="section-title" id="quick-search-title">
            {d?.search.title ?? "Search the Library"}
          </h2>
          <SearchBar compact showSuggestions locale={locale} dict={d} />
        </section>

        <section class="stats-section" aria-labelledby="stats-title">
          <h2 class="section-title" id="stats-title">{d?.stats.title ?? "Library Statistics"}</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon" aria-hidden="true">ARX</div>
              <div class="stat-value">{numberFormat.format(stats.papers)}</div>
              <div class="stat-label">{d?.stats.papers ?? "Research Papers"}</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" aria-hidden="true">VID</div>
              <div class="stat-value">{numberFormat.format(stats.videos)}</div>
              <div class="stat-label">{d?.stats.videos ?? "Videos"}</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" aria-hidden="true">NASA</div>
              <div class="stat-value">{numberFormat.format(stats.nasa)}</div>
              <div class="stat-label">{d?.stats.nasa ?? "NASA Content"}</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon" aria-hidden="true">ALL</div>
              <div class="stat-value">{numberFormat.format(stats.total)}</div>
              <div class="stat-label">{d?.stats.total ?? "Total Items"}</div>
            </div>
          </div>
        </section>
        <div class="dashboard-grid">
          <section class="info-section">
            <h2 class="section-title">{d?.about.title ?? "About AstroGroot"}</h2>
            <p class="info-text">
              {d?.about.intro ??
                "AstroGroot is an automated astronomy research library that collects, processes, and indexes content from multiple sources:"}
            </p>
            <ul class="info-list">
              <li>{d?.about.sources.papers ?? "Research papers from arXiv"}</li>
              <li>{d?.about.sources.videos ?? "Educational videos from YouTube"}</li>
              <li>{d?.about.sources.nasa ?? "NASA imagery and content"}</li>
            </ul>
            <p class="info-text">
              {d?.about.ai ??
                "All content is processed using Claude AI for summarization and semantic search via vector embeddings."}
            </p>
          </section>
          <section class="agent-tools-section" aria-labelledby="agent-tools-title">
            <p class="agent-tools-affiliation">
              {d?.agentTools.affiliation ?? "From Tokimi, the team behind AstroGroot."}
            </p>
            <h2 id="agent-tools-title" class="agent-tools-title">
              {d?.agentTools.title ?? "IFF tools for agents"}
            </h2>
            <p class="agent-tools-intro">
              {d?.agentTools.intro ?? "Public, read-only MCP tools. No account required."}
            </p>
            <ul class="agent-tools-list">
              <li>
                <a href="https://ifandonlyif.io/sdk#mcp" class="agent-tools-link">
                  {d?.agentTools.x402Title ?? "x402 evidence"} <span aria-hidden="true">↗</span>
                </a>
                <p>
                  {d?.agentTools.x402Description ??
                    "Inspect payment requirements and endpoint evidence before integrating an x402 service."}
                </p>
              </li>
              <li>
                <a href="https://ifandonlyif.io/apostille/docs#mcp" class="agent-tools-link">
                  {d?.agentTools.apostilleTitle ?? "Signatures and bundles"}{" "}
                  <span aria-hidden="true">↗</span>
                </a>
                <p>
                  {d?.agentTools.apostilleDescription ??
                    "Inspect Apostille signing formats and verify signed artifact bundles."}
                </p>
              </li>
            </ul>
            <a
              href={`/developers?lang=${encodeURIComponent(locale)}`}
              class="agent-tools-cta"
            >
              {d?.agentTools.developerLink ?? "Explore agent tools"}{" "}
              <span aria-hidden="true">→</span>
            </a>
          </section>
        </div>

        <section class="info-section tool-section">
          <a
            href={`/rocket-exam?lang=${encodeURIComponent(locale)}`}
            class="tool-card"
          >
            <span class="tool-card-icon" aria-hidden="true">🚀</span>
            <span>
              <span class="tool-card-title">
                {d?.tools?.rocketExamTitle ?? "Rocket Launch License — Mock Exam"}
              </span>
              <span class="tool-card-description">
                {d?.tools?.rocketExamDesc ??
                  "Practice for the launch license exam with timed questions and a complete study guide."}
              </span>
            </span>
            <span class="tool-card-arrow" aria-hidden="true">→</span>
          </a>
        </section>
      </main>
      {jsonLd
        ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )
        : null}
    </Layout>
  );
};
