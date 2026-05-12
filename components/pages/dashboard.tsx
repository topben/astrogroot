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
        <section class="donate-section" aria-labelledby="donate-title">
          <div class="donate-header">
            <span class="donate-icon" aria-hidden="true">✦</span>
            <h2 id="donate-title" class="donate-title">{d?.donate.title ?? "Fuel the Library"}</h2>
          </div>
          <p class="donate-intro">{d?.donate.intro ?? "AstroGroot runs on curiosity and coffee. Tip a few wei and keep the satellites humming."}</p>
          <div class="donate-row">
            <span class="ens-pill" aria-label="tokimi.eth">
              <span class="ens-eth-glyph" aria-hidden="true">Ξ</span>
              <span class="ens-text">TOKIMI.ETH</span>
            </span>
            <button
              type="button"
              class="donate-copy"
              data-donate-copy=""
              data-donate-address="tokimi.eth"
              data-donate-copied={d?.donate.copied ?? "Copied!"}
              aria-label={d?.donate.ariaCopy ?? "Copy tokimi.eth to clipboard"}
            >
              <span data-donate-copy-label="">{d?.donate.copy ?? "Copy"}</span>
            </button>
          </div>
          <div class="donate-actions">
            <a
              class="donate-button"
              href="https://app.ens.domains/tokimi.eth"
              target="_blank"
              rel="noopener noreferrer"
            >
              {d?.donate.viewOnEns ?? "ENS"} ↗
            </a>
            <a
              class="donate-button"
              href="https://etherscan.io/enslookup-search?search=tokimi.eth"
              target="_blank"
              rel="noopener noreferrer"
            >
              {d?.donate.viewOnEtherscan ?? "Etherscan"} ↗
            </a>
          </div>
          <p class="donate-thanks">{d?.donate.thanks ?? "Thank you — every wei helps."}</p>
        </section>
      </main>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  var btn = document.querySelector('[data-donate-copy]');
  if (!btn) return;
  var addr = btn.getAttribute('data-donate-address') || '';
  var copiedText = btn.getAttribute('data-donate-copied') || 'Copied!';
  var label = btn.querySelector('[data-donate-copy-label]');
  var resetTimer = null;
  function flash(){
    btn.classList.add('copied');
    if (label){
      var prev = label.getAttribute('data-original') || label.textContent;
      label.setAttribute('data-original', prev);
      label.textContent = copiedText;
    }
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(function(){
      btn.classList.remove('copied');
      if (label){
        var prev = label.getAttribute('data-original');
        if (prev != null) label.textContent = prev;
      }
    }, 1800);
  }
  function legacyCopy(){
    var ta = document.createElement('textarea');
    ta.value = addr; ta.setAttribute('readonly','');
    ta.style.position = 'absolute'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  btn.addEventListener('click', function(){
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(addr).then(flash).catch(function(){ legacyCopy(); flash(); });
    } else {
      legacyCopy(); flash();
    }
  });
})();
`,
        }}
      />
    </Layout>
  );
};
