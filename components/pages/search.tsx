import type { FC } from "hono/jsx";
import { Layout } from "../layout.tsx";
import { SearchBar } from "../search-bar.tsx";

interface SearchPageProps {
  query?: string;
  type?: string;
  sortBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const SearchPage: FC<SearchPageProps> = (props) => {
  const query = props.query ?? "";
  const type = props.type ?? "all";
  const sortBy = props.sortBy ?? "relevance";
  const dateFrom = props.dateFrom ?? "";
  const dateTo = props.dateTo ?? "";
  return (
    <Layout pageClass="search-page" activeNav="search" headerVariant="search">
      <main class="main-content main-content-narrow">
        <div class="search-container">
          <h2 class="section-title section-title-search">Search the Library</h2>
          <p class="search-description">Explore astronomy papers, videos, and NASA content</p>
          <SearchBar
            initialQuery={query}
            initialType={type}
            initialSortBy={sortBy}
            initialDateFrom={dateFrom}
            initialDateTo={dateTo}
          />
          <div id="search-results" class="search-results" data-query={query} data-type={type}>
            {query ? (
              <p class="search-results-loading" id="search-results-loading">
                Searching…
              </p>
            ) : (
              <p class="search-results-hint">Enter a query above and click Search (e.g. dark energy, black holes, Mars).</p>
            )}
          </div>
        </div>
      </main>
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  var el = document.getElementById('search-results');
  if (!el) return;
  var q = (el.getAttribute('data-query') || '').trim();
  var type = el.getAttribute('data-type') || 'all';
  if (!q) return;
  var loading = document.getElementById('search-results-loading');
  var params = new URLSearchParams({ q: q, type: type, limit: '20' });
  fetch('/api/search?' + params.toString())
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (loading) loading.remove();
      var total = data.total || 0;
      var papers = data.papers || [];
      var videos = data.videos || [];
      var nasa = data.nasa || [];
      var html = '<p class="search-results-count">Found ' + total + ' result' + (total !== 1 ? 's' : '') + '</p>';
      function itemHtml(item, label) {
        var title = (item.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var snippet = (item.snippet || '').slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var url = (item.url || '#').replace(/"/g, '&quot;');
        var date = item.publishedDate ? ' <span class="search-result-date">' + item.publishedDate + '</span>' : '';
        return '<div class="search-result-card"><span class="search-result-type">' + label + '</span><a href="' + url + '" target="_blank" rel="noopener" class="search-result-title">' + title + '</a>' + date + (snippet ? '<p class="search-result-snippet">' + snippet + '…</p>' : '') + '</div>';
      }
      papers.forEach(function(p) { html += itemHtml(p, 'Paper'); });
      videos.forEach(function(v) { html += itemHtml(v, 'Video'); });
      nasa.forEach(function(n) { html += itemHtml(n, 'NASA'); });
      if (total === 0) html += '<p class="search-results-empty">No results. Try different keywords or filters.</p>';
      el.insertAdjacentHTML('beforeend', html);
    })
    .catch(function(err) {
      if (loading) loading.remove();
      el.insertAdjacentHTML('beforeend', '<p class="search-results-error">Search failed: ' + (err.message || String(err)) + '</p>');
    });
})();
`,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
.search-results { margin-top: 2.5rem; min-height: 80px; }
.search-results-loading, .search-results-hint, .search-results-empty, .search-results-error { color: #94a3b8; font-size: 1rem; }
.search-results-error { color: #f87171; }
.search-results-count { font-size: 1.0625rem; font-weight: 600; color: #c7d2fe; margin-bottom: 1.25rem; }
.search-result-card { background: rgba(5, 8, 22, 0.85); border: 1px solid rgba(34, 211, 238, 0.25); border-radius: 14px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; backdrop-filter: blur(10px); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.search-result-card:hover { border-color: rgba(168, 85, 247, 0.5); box-shadow: 0 0 25px rgba(168, 85, 247, 0.2); }
.search-result-type { display: inline-block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #22d3ee; margin-bottom: 0.5rem; }
.search-result-title { display: block; font-size: 1.125rem; font-weight: 600; color: #e0e7ff; text-decoration: none; margin-bottom: 0.35rem; transition: color 0.2s ease; }
.search-result-title:hover { color: #a78bfa; }
.search-result-date { font-size: 0.875rem; color: #64748b; font-weight: 400; }
.search-result-snippet { font-size: 0.9375rem; color: #94a3b8; line-height: 1.5; margin-top: 0.5rem; margin-bottom: 0; }
`,
        }}
      />
    </Layout>
  );
};
