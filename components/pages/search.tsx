import type { FC } from "hono/jsx";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";
import { Layout, type AlternateUrls } from "../layout.tsx";
import { SearchBar } from "../search-bar.tsx";

interface SearchPageProps {
  query?: string;
  type?: string;
  sortBy?: string;
  dateFrom?: string;
  dateTo?: string;
  locale?: Locale;
  dict?: LocaleDict;
  pageTitle: string;
  pageDescription: string;
  canonicalUrl: string;
  alternateUrls: AlternateUrls;
  robots?: string;
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
  const relatedNotice = d?.search.relatedNotice ?? "No exact matches found. Showing related content:";
  const relatedLabel = d?.search.relatedLabel ?? "Related";
  const pageLabel = d?.search.page ?? "Page";
  const ofLabel = d?.search.of ?? "of";
  const prevLabel = d?.search.prev ?? "Previous";
  const nextLabel = d?.search.next ?? "Next";
  const labelPaper = d?.common.paper ?? "Paper";
  const labelVideo = d?.common.video ?? "Video";
  const labelNasa = d?.common.nasa ?? "NASA";
  const labelMore = d?.common.more ?? "More";
  return (
    <Layout
      pageClass="search-page"
      activeNav="search"
      headerVariant="search"
      locale={locale}
      dict={d}
      pageTitle={props.pageTitle}
      pageDescription={props.pageDescription}
      canonicalUrl={props.canonicalUrl}
      alternateUrls={props.alternateUrls}
      robots={props.robots}
    >
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
            data-related-notice={relatedNotice}
            data-related-label={relatedLabel}
            data-page-label={pageLabel}
            data-of-label={ofLabel}
            data-prev-label={prevLabel}
            data-next-label={nextLabel}
          >
            {query ? (
              <div class="search-skeleton" id="search-results-loading">
                <div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div>
                <div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div>
                <div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div>
              </div>
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
  var relatedNotice = el.getAttribute('data-related-notice') || 'No exact matches found. Showing related content:';
  var relatedLabel = el.getAttribute('data-related-label') || 'Related';
  var pageLabel = el.getAttribute('data-page-label') || 'Page';
  var ofLabel = el.getAttribute('data-of-label') || 'of';
  var prevLabel = el.getAttribute('data-prev-label') || 'Previous';
  var nextLabel = el.getAttribute('data-next-label') || 'Next';
  if (!q) return;
  var urlParams = new URLSearchParams(window.location.search || '');
  var initialPage = parseInt(urlParams.get('page') || '1', 10) || 1;
  var currentPage = initialPage;
  var perPage = 20;

  function updateUrl(page) {
    var params = new URLSearchParams(window.location.search || '');
    params.set('q', q);
    params.set('type', type);
    params.set('lang', locale);
    if (dateFrom) params.set('dateFrom', dateFrom); else params.delete('dateFrom');
    if (dateTo) params.set('dateTo', dateTo); else params.delete('dateTo');
    params.set('page', String(page));
    var newUrl = window.location.pathname + '?' + params.toString();
    history.replaceState(null, '', newUrl);
  }

  function doSearch(page) {
    currentPage = page;
    el.innerHTML = '<div class="search-skeleton"><div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div><div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div><div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div></div>';
    var params = new URLSearchParams({ q: q, type: type, limit: String(perPage), page: String(page), lang: locale });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    fetch('/api/search?' + params.toString())
      .then(function(r) { return r.json(); })
      .then(function(data) {
        el.innerHTML = '';
        if (data.error) {
          var errMsg = (data.error || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          el.insertAdjacentHTML('beforeend', '<p class="search-results-error">' + errorTpl + ': ' + errMsg + '</p>');
          return;
        }
        var total = data.total || 0;
        var papers = data.papers || [];
        var videos = data.videos || [];
        var nasa = data.nasa || [];
        var showingRelated = data.showingRelated || false;
        var pagination = data.pagination || { page: 1, totalPages: 1, hasNext: false, hasPrev: false };
        var countText = foundTpl.split('{count}').join(String(total));
        var html = '<p class="search-results-count">' + countText + '</p>';
        if (showingRelated && total > 0) {
          html += '<p class="search-results-related-notice">' + relatedNotice + '</p>';
        }
        function itemHtml(item, label) {
          var title = (item.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          var snippet = (item.snippet || '').slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          var url = (item.url || '#').replace(/"/g, '&quot;');
          var detailUrl = '/detail?type=' + encodeURIComponent(item.type || '') + '&id=' + encodeURIComponent(item.id || '') + '&lang=' + encodeURIComponent(locale);
          var date = item.publishedDate ? ' <span class="search-result-date">' + item.publishedDate + '</span>' : '';
          var moreBtn = '<a href="' + detailUrl + '" class="search-result-more">' + labelMore + '</a>';
          var isLowRelevance = item.lowRelevance || false;
          var cardClass = 'search-result-card' + (isLowRelevance ? ' search-result-card-low-relevance' : '');
          var relatedBadge = isLowRelevance ? '<span class="search-result-related-badge">' + relatedLabel + '</span>' : '';
          return '<div class="' + cardClass + '"><div class="search-result-header"><span class="search-result-type">' + label + '</span>' + relatedBadge + '</div><a href="' + url + '" target="_blank" rel="noopener" class="search-result-title">' + title + '</a>' + date + (snippet ? '<p class="search-result-snippet">' + snippet + '…</p>' : '') + '<div class="search-result-actions">' + moreBtn + '</div></div>';
        }
        papers.forEach(function(p) { html += itemHtml(p, labelPaper); });
        videos.forEach(function(v) { html += itemHtml(v, labelVideo); });
        nasa.forEach(function(n) { html += itemHtml(n, labelNasa); });
        if (total === 0) {
          html += '<p class="search-results-empty">' + noResults + '</p>';
        } else if (pagination.totalPages > 1) {
          html += '<div class="search-pagination">';
          html += '<button class="pagination-btn pagination-prev" ' + (pagination.hasPrev ? '' : 'disabled') + '>' + prevLabel + '</button>';
          html += '<span class="pagination-info">' + pageLabel + ' ' + pagination.page + ' ' + ofLabel + ' ' + pagination.totalPages + '</span>';
          html += '<button class="pagination-btn pagination-next" ' + (pagination.hasNext ? '' : 'disabled') + '>' + nextLabel + '</button>';
          html += '</div>';
        }
        el.insertAdjacentHTML('beforeend', html);
        var prevBtn = el.querySelector('.pagination-prev');
        var nextBtn = el.querySelector('.pagination-next');
        if (prevBtn) prevBtn.addEventListener('click', function() { if (pagination.hasPrev) doSearch(currentPage - 1); });
        if (nextBtn) nextBtn.addEventListener('click', function() { if (pagination.hasNext) doSearch(currentPage + 1); });
        updateUrl(pagination.page || page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function(err) {
        el.innerHTML = '';
        var msg = (err && err.message) ? err.message : String(err);
        el.insertAdjacentHTML('beforeend', '<p class="search-results-error">' + errorTpl + ': ' + msg.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>');
      });
  }
  doSearch(currentPage);
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
.search-result-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.search-results-related-notice { color: #fbbf24; font-size: 0.9375rem; margin-bottom: 1.25rem; padding: 0.75rem 1rem; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; }
.search-result-card-low-relevance { opacity: 0.75; border-color: rgba(251, 191, 36, 0.25); }
.search-result-card-low-relevance:hover { border-color: rgba(251, 191, 36, 0.5); box-shadow: 0 0 25px rgba(251, 191, 36, 0.15); }
.search-result-related-badge { display: inline-block; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #fbbf24; background: rgba(251, 191, 36, 0.15); padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid rgba(251, 191, 36, 0.3); }
.search-pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
.pagination-btn { border: 1px solid rgba(34, 211, 238, 0.35); background: rgba(15, 23, 42, 0.7); color: #e0e7ff; padding: 0.4rem 1rem; border-radius: 999px; cursor: pointer; transition: all 0.2s ease; }
.pagination-btn:hover { border-color: rgba(34, 211, 238, 0.7); background: rgba(34, 211, 238, 0.12); }
.pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-info { color: #94a3b8; font-size: 0.9rem; }
@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
.search-skeleton { display: flex; flex-direction: column; gap: 1rem; }
.skeleton-card { background: rgba(5, 8, 22, 0.85); border: 1px solid rgba(34, 211, 238, 0.12); border-radius: 14px; padding: 1.25rem 1.5rem; }
.skeleton-badge, .skeleton-title, .skeleton-line { border-radius: 6px; background: linear-gradient(90deg, rgba(30, 41, 59, 0.5) 0%, rgba(51, 65, 85, 0.6) 50%, rgba(30, 41, 59, 0.5) 100%); background-size: 800px 100%; animation: shimmer 1.5s infinite linear; }
.skeleton-badge { width: 52px; height: 14px; margin-bottom: 0.75rem; }
.skeleton-title { width: 70%; height: 18px; margin-bottom: 0.75rem; }
.skeleton-line { width: 100%; height: 12px; margin-bottom: 0.5rem; }
.skeleton-line-short { width: 55%; }
`,
        }}
      />
    </Layout>
  );
};
