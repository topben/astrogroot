import type { FC } from "hono/jsx";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";
import { Layout } from "../layout.tsx";
import { SearchBar } from "../search-bar.tsx";

interface SearchPageProps {
  query?: string;
  type?: string;
  sortBy?: string;
  dateFrom?: string;
  dateTo?: string;
  locale?: Locale;
  dict?: LocaleDict;
}

export const SearchPage: FC<SearchPageProps> = (props) => {
  const query = props.query ?? "";
  const type = props.type ?? "all";
  const sortBy = props.sortBy ?? "relevance";
  const dateFrom = props.dateFrom ?? "";
  const dateTo = props.dateTo ?? "";
  const locale = props.locale ?? "en";
  const d = props.dict;
  const searchTitle = d?.search.title ?? "Search the Library";
  const searchDescription = d?.search.description ?? "Explore astronomy papers, videos, and NASA content";
  const searchingText = d?.search.searching ?? "Searching…";
  const hintText = d?.search.hint ?? "Enter a query above and click Search (e.g. dark energy, black holes, Mars).";
  const foundTpl = d?.search.found ?? "Found {count} result(s)";
  const noResultsText = d?.search.noResults ?? "No results. Try different keywords or filters.";
  const errorTpl = d?.search.error ?? "Search failed";
  const labelPaper = d?.common.paper ?? "Paper";
  const labelVideo = d?.common.video ?? "Video";
  const labelNasa = d?.common.nasa ?? "NASA";
  const labelMore = d?.common.more ?? "More";
  return (
    <Layout pageClass="search-page" activeNav="search" headerVariant="search" locale={locale} dict={d}>
      <main class="main-content main-content-narrow">
        <div class="search-container">
          <h2 class="section-title section-title-search">{searchTitle}</h2>
          <p class="search-description">{searchDescription}</p>
          <SearchBar
            initialQuery={query}
            initialType={type}
            initialSortBy={sortBy}
            initialDateFrom={dateFrom}
            initialDateTo={dateTo}
            locale={locale}
            dict={d}
            showSuggestions={true}
          />
          <div
            id="search-results"
            class="search-results"
            data-query={query}
            data-type={type}
            data-locale={locale}
            data-date-from={dateFrom}
            data-date-to={dateTo}
            data-found-tpl={foundTpl}
            data-no-results={noResultsText}
            data-label-paper={labelPaper}
            data-label-video={labelVideo}
            data-label-nasa={labelNasa}
            data-label-more={labelMore}
            data-error-tpl={errorTpl}
          >
            {query ? (
              <p class="search-results-loading" id="search-results-loading">
                {searchingText}
              </p>
            ) : (
              <p class="search-results-hint">{hintText}</p>
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
  var locale = el.getAttribute('data-locale') || 'en';
  var dateFrom = (el.getAttribute('data-date-from') || '').trim();
  var dateTo = (el.getAttribute('data-date-to') || '').trim();
  var foundTpl = el.getAttribute('data-found-tpl') || 'Found {count} result(s)';
  var noResults = el.getAttribute('data-no-results') || 'No results. Try different keywords or filters.';
  var labelPaper = el.getAttribute('data-label-paper') || 'Paper';
  var labelVideo = el.getAttribute('data-label-video') || 'Video';
  var labelNasa = el.getAttribute('data-label-nasa') || 'NASA';
  var labelMore = el.getAttribute('data-label-more') || 'More';
  var errorTpl = el.getAttribute('data-error-tpl') || 'Search failed';
  if (!q) return;
  var loading = document.getElementById('search-results-loading');
  var params = new URLSearchParams({ q: q, type: type, limit: '20', lang: locale });
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  fetch('/api/search?' + params.toString())
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (loading) loading.remove();
      if (data.error) {
        var errMsg = (data.error || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        el.insertAdjacentHTML('beforeend', '<p class="search-results-error">' + errorTpl + ': ' + errMsg + '</p>');
        return;
      }
      var total = data.total || 0;
      var papers = data.papers || [];
      var videos = data.videos || [];
      var nasa = data.nasa || [];
      var countText = foundTpl.split('{count}').join(String(total));
      var html = '<p class="search-results-count">' + countText + '</p>';
      function itemHtml(item, label) {
        var title = (item.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var snippet = (item.snippet || '').slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var url = (item.url || '#').replace(/"/g, '&quot;');
        var detailUrl = '/detail?type=' + encodeURIComponent(item.type || '') + '&id=' + encodeURIComponent(item.id || '') + '&lang=' + encodeURIComponent(locale);
        var date = item.publishedDate ? ' <span class="search-result-date">' + item.publishedDate + '</span>' : '';
        var moreBtn = '<a href="' + detailUrl + '" class="search-result-more">' + labelMore + '</a>';
        return '<div class="search-result-card"><span class="search-result-type">' + label + '</span><a href="' + url + '" target="_blank" rel="noopener" class="search-result-title">' + title + '</a>' + date + (snippet ? '<p class="search-result-snippet">' + snippet + '…</p>' : '') + '<div class="search-result-actions">' + moreBtn + '</div></div>';
      }
      papers.forEach(function(p) { html += itemHtml(p, labelPaper); });
      videos.forEach(function(v) { html += itemHtml(v, labelVideo); });
      nasa.forEach(function(n) { html += itemHtml(n, labelNasa); });
      if (total === 0) html += '<p class="search-results-empty">' + noResults + '</p>';
      el.insertAdjacentHTML('beforeend', html);
    })
    .catch(function(err) {
      if (loading) loading.remove();
      var msg = (err && err.message) ? err.message : String(err);
      el.insertAdjacentHTML('beforeend', '<p class="search-results-error">' + errorTpl + ': ' + msg.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>');
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
.search-result-actions { margin-top: 0.75rem; display: flex; gap: 0.6rem; }
.search-result-more { display: inline-flex; align-items: center; padding: 0.4rem 0.9rem; border-radius: 999px; font-size: 0.85rem; color: #e0e7ff; text-decoration: none; border: 1px solid rgba(34,211,238,0.35); background: rgba(15,23,42,0.7); transition: all 0.2s ease; }
.search-result-more:hover { border-color: rgba(34,211,238,0.7); background: rgba(34,211,238,0.12); }
.search-result-snippet { font-size: 0.9375rem; color: #94a3b8; line-height: 1.5; margin-top: 0.5rem; margin-bottom: 0; }
`,
        }}
      />
    </Layout>
  );
};
