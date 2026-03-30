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
  const invalidLanguage = d?.search.invalidLanguage ?? "Please enter English keywords only.";
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
  const dateRangeLabel = d?.search.dateRange ?? "Date Range";
  const monthsStr = d?.calendar.months.join("|") ?? "January|February|March|April|May|June|July|August|September|October|November|December";
  const weekdaysStr = d?.calendar.weekdays.join("|") ?? "Su|Mo|Tu|We|Th|Fr|Sa";
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
      <main class="main-content">
        <div class="search-container">
          <div class="search-top">
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
              hideFilters={true}
            />
          </div>
          <div class="search-page-body">
            <aside
              class="search-sidebar"
              id="search-sidebar"
              data-date-from={dateFrom}
              data-date-to={dateTo}
              data-sort-by={sortBy}
              data-months={monthsStr}
              data-weekdays={weekdaysStr}
            >
              <div class="sidebar-section">
                <h3 class="sidebar-heading">{dateRangeLabel}</h3>
                <div id="inline-calendar" class="inline-calendar"></div>
                <div id="sidebar-date-display" class="sidebar-date-display" hidden></div>
                <button type="button" id="sidebar-clear-dates" class="sidebar-clear-btn" hidden>
                  {d?.search.clearRecent ?? "Clear"}
                </button>
              </div>
              <div class="sidebar-section">
                <h3 class="sidebar-heading">{d?.search.sortBy ?? "Sort By"}</h3>
                <select id="sidebar-sort" class="sidebar-select">
                  <option value="relevance">{d?.search.relevance ?? "Relevance"}</option>
                  <option value="date">{d?.search.date ?? "Date"}</option>
                  <option value="title">{d?.search.sortByTitle ?? "Title"}</option>
                </select>
              </div>
            </aside>
            <div class="search-results-column">
              <div
                id="search-results"
                class="search-results"
                data-query={query}
                data-type={type}
                data-locale={locale}
                data-date-from={dateFrom}
                data-date-to={dateTo}
                data-sort-by={sortBy}
                data-found-tpl={foundTpl}
                data-no-results={noResultsText}
                data-label-paper={labelPaper}
                data-label-video={labelVideo}
                data-label-nasa={labelNasa}
                data-label-more={labelMore}
                data-error-tpl={errorTpl}
                data-invalid-msg={invalidLanguage}
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
  var foundTpl = el.getAttribute('data-found-tpl') || 'Found {count} result(s)';
  var noResults = el.getAttribute('data-no-results') || 'No results. Try different keywords or filters.';
  var labelPaper = el.getAttribute('data-label-paper') || 'Paper';
  var labelVideo = el.getAttribute('data-label-video') || 'Video';
  var labelNasa = el.getAttribute('data-label-nasa') || 'NASA';
  var labelMore = el.getAttribute('data-label-more') || 'More';
  var errorTpl = el.getAttribute('data-error-tpl') || 'Search failed';
  var invalidMsg = el.getAttribute('data-invalid-msg') || 'Please enter English keywords only.';
  var relatedNotice = el.getAttribute('data-related-notice') || 'No exact matches found. Showing related content:';
  var relatedLabel = el.getAttribute('data-related-label') || 'Related';
  var pageLabel = el.getAttribute('data-page-label') || 'Page';
  var ofLabel = el.getAttribute('data-of-label') || 'of';
  var prevLabel = el.getAttribute('data-prev-label') || 'Previous';
  var nextLabel = el.getAttribute('data-next-label') || 'Next';
  // Sidebar-controlled state (mutable — sidebar can update these and re-run doSearch)
  var currentDateFrom = (el.getAttribute('data-date-from') || '').trim();
  var currentDateTo = (el.getAttribute('data-date-to') || '').trim();
  var currentSortBy = (el.getAttribute('data-sort-by') || 'relevance').trim();
  function isInvalidForLocale(value, locale) {
    var validator = window.__astroSearchValidation;
    if (!validator || typeof validator.isInvalidForLocale !== 'function') return false;
    return validator.isInvalidForLocale(value, locale);
  }
  var urlParams = new URLSearchParams(window.location.search || '');
  var initialPage = parseInt(urlParams.get('page') || '1', 10) || 1;
  var currentPage = initialPage;
  var perPage = 20;
  function updateUrl(page) {
    var params = new URLSearchParams(window.location.search || '');
    params.set('q', q);
    params.set('type', type);
    params.set('lang', locale);
    if (currentDateFrom) params.set('dateFrom', currentDateFrom); else params.delete('dateFrom');
    if (currentDateTo) params.set('dateTo', currentDateTo); else params.delete('dateTo');
    if (currentSortBy && currentSortBy !== 'relevance') params.set('sortBy', currentSortBy); else params.delete('sortBy');
    params.set('page', String(page));
    history.replaceState(null, '', window.location.pathname + '?' + params.toString());
  }
  function skeletonHtml() {
    return '<div class="search-skeleton"><div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div><div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div><div class="skeleton-card"><div class="skeleton-badge"></div><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line skeleton-line-short"></div></div></div>';
  }
  function itemHtml(item, label) {
    var title = (item.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var snippet = (item.snippet || '').slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var url = (item.url || '#').replace(/"/g, '&quot;');
    var detailUrl = '/detail?type=' + encodeURIComponent(item.type || '') + '&id=' + encodeURIComponent(item.id || '') + '&lang=' + encodeURIComponent(locale) + '&returnUrl=' + encodeURIComponent(window.location.pathname + window.location.search);
    var moreBtn = '<a href="' + detailUrl + '" class="search-result-more">' + labelMore + ' \u203a</a>';
    var isLowRelevance = item.lowRelevance || false;
    var cardClass = 'search-result-card' + (isLowRelevance ? ' search-result-card-low-relevance' : '');
    var relatedBadge = isLowRelevance ? '<span class="search-result-related-badge">' + relatedLabel + '</span>' : '';
    var itemType = (item.type || '').toLowerCase();
    var typeColorClass = itemType === 'papers' || itemType === 'paper' ? 'search-result-type-papers'
      : itemType === 'videos' || itemType === 'video' ? 'search-result-type-videos'
      : itemType === 'nasa' ? 'search-result-type-nasa' : '';
    var typeTag = '<span class="search-result-type ' + typeColorClass + '">' + label + '</span>';
    var metaRow = item.publishedDate
      ? '<div class="search-result-meta"><span class="search-result-date">' + item.publishedDate + '</span></div>'
      : '';
    return '<div class="' + cardClass + '">'
      + '<div class="search-result-header">' + typeTag + relatedBadge + '</div>'
      + '<a href="' + url + '" target="_blank" rel="noopener" class="search-result-title">' + title + '</a>'
      + metaRow
      + (snippet ? '<p class="search-result-snippet">' + snippet + '\u2026</p>' : '')
      + '<div class="search-result-actions">' + moreBtn + '</div>'
      + '</div>';
  }
  function doSearch(page) {
    currentPage = page;
    el.innerHTML = skeletonHtml();
    var params = new URLSearchParams({ q: q, type: type, limit: String(perPage), page: String(page), lang: locale });
    if (currentDateFrom) params.set('dateFrom', currentDateFrom);
    if (currentDateTo) params.set('dateTo', currentDateTo);
    if (currentSortBy && currentSortBy !== 'relevance') params.set('sortBy', currentSortBy);
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
        papers.forEach(function(p) { html += itemHtml(p, labelPaper); });
        videos.forEach(function(v) { html += itemHtml(v, labelVideo); });
        nasa.forEach(function(n) { html += itemHtml(n, labelNasa); });
        if (total === 0) {
          html += '<p class="search-results-empty">' + noResults + '</p>';
          if (type !== 'all') {
            html += '<p class="search-results-try-all">Try <a href="/search?q=' + encodeURIComponent(q) + '&lang=' + encodeURIComponent(locale) + '" class="try-all-link">All Content</a> to broaden your search.</p>';
          }
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
  // ── Sidebar: inline date-range calendar + sort ───────────────────────────
  function initSidebar() {
    var sidebar = document.getElementById('search-sidebar');
    if (!sidebar) return;
    var MONTHS = (sidebar.getAttribute('data-months') || '').split('|');
    var WD = (sidebar.getAttribute('data-weekdays') || '').split('|');
    if (MONTHS.length < 12) MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (WD.length < 7) WD = ['S','M','T','W','T','F','S'];
    var calFrom = currentDateFrom || null;
    var calTo = currentDateTo || null;
    var calYear, calMonth;
    if (calFrom) {
      var parts = calFrom.split('-');
      calYear = parseInt(parts[0], 10);
      calMonth = parseInt(parts[1], 10) - 1;
    } else {
      var now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
    }
    function pad2(n) { return n < 10 ? '0' + n : String(n); }
    function mkDate(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }
    function renderCalendar() {
      var cal = document.getElementById('inline-calendar');
      if (!cal) return;
      var h = '<div class="cal-header">'
        + '<button type="button" class="cal-nav-btn" id="cal-prev">&#8249;</button>'
        + '<span class="cal-month-year">' + MONTHS[calMonth] + ' ' + calYear + '</span>'
        + '<button type="button" class="cal-nav-btn" id="cal-next">&#8250;</button>'
        + '</div>';
      h += '<div class="cal-weekdays">';
      WD.forEach(function(d) { h += '<span class="cal-weekday">' + d + '</span>'; });
      h += '</div>';
      var todayObj = new Date();
      var todayStr = mkDate(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
      var firstDay = new Date(calYear, calMonth, 1).getDay();
      var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      h += '<div class="cal-days">';
      for (var i = 0; i < firstDay; i++) { h += '<span class="cal-empty"></span>'; }
      for (var d = 1; d <= daysInMonth; d++) {
        var ds = mkDate(calYear, calMonth, d);
        var cls = 'cal-day-btn';
        if ((calFrom && ds === calFrom) || (calTo && ds === calTo)) cls += ' cal-selected';
        else if (calFrom && calTo && ds > calFrom && ds < calTo) cls += ' cal-in-range';
        if (ds === todayStr) cls += ' cal-today';
        h += '<button type="button" class="' + cls + '" data-date="' + ds + '">' + d + '</button>';
      }
      h += '</div>';
      cal.innerHTML = h;
      var prevBtn = document.getElementById('cal-prev');
      var nextBtn = document.getElementById('cal-next');
      if (prevBtn) prevBtn.addEventListener('click', function() {
        calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
      });
      if (nextBtn) nextBtn.addEventListener('click', function() {
        calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
      });
      cal.querySelectorAll('.cal-day-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var ds = btn.getAttribute('data-date');
          if (!calFrom || (calFrom && calTo)) {
            calFrom = ds; calTo = null;
          } else if (ds > calFrom) {
            calTo = ds;
          } else if (ds < calFrom) {
            calFrom = ds; calTo = null;
          } else {
            calFrom = null; calTo = null;
          }
          renderCalendar();
          updateDateDisplay();
          if (calFrom && calTo) {
            currentDateFrom = calFrom; currentDateTo = calTo;
            if (q) doSearch(1);
          } else if (!calFrom) {
            currentDateFrom = ''; currentDateTo = '';
            if (q) doSearch(1);
          }
        });
      });
    }
    function updateDateDisplay() {
      var display = document.getElementById('sidebar-date-display');
      var clearBtn = document.getElementById('sidebar-clear-dates');
      if (!display) return;
      if (calFrom) {
        display.textContent = calFrom + (calTo ? ' \u2192 ' + calTo : ' \u2192 \u2026');
        display.hidden = false;
        if (clearBtn) clearBtn.hidden = false;
      } else {
        display.hidden = true;
        if (clearBtn) clearBtn.hidden = true;
      }
    }
    var clearDatesBtn = document.getElementById('sidebar-clear-dates');
    if (clearDatesBtn) {
      clearDatesBtn.addEventListener('click', function() {
        calFrom = null; calTo = null;
        currentDateFrom = ''; currentDateTo = '';
        renderCalendar(); updateDateDisplay();
        if (q) doSearch(1);
      });
    }
    var sortSelect = document.getElementById('sidebar-sort');
    if (sortSelect && sortSelect instanceof HTMLSelectElement) {
      sortSelect.value = currentSortBy;
      sortSelect.addEventListener('change', function() {
        currentSortBy = sortSelect.value;
        if (q) doSearch(1);
      });
    }
    renderCalendar();
    updateDateDisplay();
  }
  if (!q) {
    initSidebar();
    return;
  }
  if (isInvalidForLocale(q, locale)) {
    el.innerHTML = '';
    var errEl = document.createElement('p');
    errEl.className = 'search-results-error';
    errEl.textContent = invalidMsg;
    el.appendChild(errEl);
    initSidebar();
    return;
  }
  initSidebar();
  doSearch(currentPage);
})();
`,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
/* ── Layout ─────────────────────────────────────────────────────────── */
.search-top { margin-bottom: 1.75rem; }
.search-page-body { display: grid; grid-template-columns: 230px 1fr; gap: 1.75rem; align-items: start; }
@media (max-width: 720px) { .search-page-body { grid-template-columns: 1fr; } }
.search-results-column { min-width: 0; }
/* ── Sidebar ─────────────────────────────────────────────────────────── */
.search-sidebar { background: rgba(5,8,22,0.65); border: 1px solid rgba(34,211,238,0.13); border-radius: 16px; padding: 1.25rem; position: sticky; top: 1rem; backdrop-filter: blur(12px); }
.sidebar-section { margin-bottom: 1.5rem; }
.sidebar-section:last-child { margin-bottom: 0; }
.sidebar-heading { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; margin-bottom: 0.875rem; }
.sidebar-select { width: 100%; padding: 0.5rem 0.75rem; background: rgba(5,8,22,0.9); border: 1px solid rgba(34,211,238,0.2); border-radius: 8px; color: #e0e7ff; font-size: 0.875rem; outline: none; cursor: pointer; transition: border-color 0.2s ease; }
.sidebar-select:focus { border-color: rgba(168,85,247,0.5); }
.sidebar-date-display { font-size: 0.775rem; color: #a5b4fc; margin: 0.5rem 0 0.25rem; padding: 0.35rem 0.6rem; background: rgba(168,85,247,0.08); border-radius: 6px; border: 1px solid rgba(168,85,247,0.2); letter-spacing: 0.01em; }
.sidebar-clear-btn { font-size: 0.775rem; color: #475569; background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; transition: color 0.2s ease; display: block; margin-top: 0.35rem; }
.sidebar-clear-btn:hover { color: #94a3b8; }
/* ── Inline calendar ─────────────────────────────────────────────────── */
.inline-calendar { user-select: none; }
.cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.625rem; }
.cal-month-year { font-size: 0.8rem; font-weight: 600; color: #c7d2fe; }
.cal-nav-btn { width: 1.5rem; height: 1.5rem; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(34,211,238,0.07); border: 1px solid rgba(34,211,238,0.18); border-radius: 5px; color: #22d3ee; font-size: 1.05rem; cursor: pointer; transition: all 0.15s ease; line-height: 1; }
.cal-nav-btn:hover { background: rgba(34,211,238,0.16); }
.cal-weekdays { display: grid; grid-template-columns: repeat(7,1fr); margin-bottom: 0.1rem; text-align: center; }
.cal-weekday { font-size: 0.58rem; font-weight: 600; color: #334155; text-transform: uppercase; padding: 0.2rem 0; }
.cal-days { display: grid; grid-template-columns: repeat(7,1fr); gap: 1px; }
.cal-empty { aspect-ratio: 1; }
.cal-day-btn { aspect-ratio: 1; width: 100%; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 5px; font-size: 0.7rem; color: #64748b; cursor: pointer; transition: all 0.12s ease; }
.cal-day-btn:hover { background: rgba(168,85,247,0.14); color: #e0e7ff; }
.cal-day-btn.cal-selected { background: rgba(168,85,247,0.38); color: #fff; box-shadow: 0 0 7px rgba(168,85,247,0.35); border-radius: 5px; }
.cal-day-btn.cal-in-range { background: rgba(168,85,247,0.11); color: #c4b5fd; border-radius: 0; }
.cal-day-btn.cal-today { color: #22d3ee; font-weight: 700; outline: 1px solid rgba(34,211,238,0.45); outline-offset: -2px; }
/* ── Result cards ────────────────────────────────────────────────────── */
.search-results { min-height: 80px; }
.search-results-hint, .search-results-empty, .search-results-error { color: #94a3b8; font-size: 0.9375rem; }
.search-results-error { color: #f87171; }
.search-results-count { font-size: 0.9rem; font-weight: 500; color: #475569; margin-bottom: 1rem; }
.search-result-card { background: rgba(5,8,22,0.7); border: 1px solid rgba(34,211,238,0.13); border-radius: 12px; padding: 1.125rem 1.25rem; margin-bottom: 0.75rem; backdrop-filter: blur(10px); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.search-result-card:hover { border-color: rgba(168,85,247,0.42); box-shadow: 0 2px 18px rgba(168,85,247,0.13); }
.search-result-header { display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.45rem; }
.search-result-type { display: inline-block; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.18rem 0.52rem; border-radius: 5px; }
.search-result-type-papers { color: #22d3ee; background: rgba(34,211,238,0.09); border: 1px solid rgba(34,211,238,0.22); }
.search-result-type-videos { color: #a855f7; background: rgba(168,85,247,0.09); border: 1px solid rgba(168,85,247,0.22); }
.search-result-type-nasa { color: #f59e0b; background: rgba(245,158,11,0.09); border: 1px solid rgba(245,158,11,0.22); }
.search-result-title { display: block; font-size: 1.0625rem; font-weight: 600; color: #e0e7ff; text-decoration: none; margin-bottom: 0.3rem; line-height: 1.4; transition: color 0.2s ease; }
.search-result-title:hover { color: #a78bfa; }
.search-result-meta { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.35rem; }
.search-result-date { font-size: 0.8rem; color: #475569; }
.search-result-snippet { font-size: 0.875rem; color: #64748b; line-height: 1.55; margin: 0; }
.search-result-actions { margin-top: 0.7rem; }
.search-result-more { display: inline-flex; align-items: center; padding: 0.3rem 0.8rem; border-radius: 999px; font-size: 0.8rem; color: #64748b; text-decoration: none; border: 1px solid rgba(34,211,238,0.18); background: rgba(15,23,42,0.4); transition: all 0.2s ease; }
.search-result-more:hover { border-color: rgba(34,211,238,0.45); color: #e0e7ff; background: rgba(34,211,238,0.07); }
.search-results-try-all { font-size: 0.875rem; color: #64748b; margin-top: 0.75rem; }
.try-all-link { color: #22d3ee; text-decoration: underline; text-decoration-color: rgba(34,211,238,0.4); transition: text-decoration-color 0.2s; }
.try-all-link:hover { text-decoration-color: #22d3ee; }
.search-results-related-notice { color: #fbbf24; font-size: 0.9rem; margin-bottom: 1rem; padding: 0.625rem 1rem; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25); border-radius: 8px; }
.search-result-card-low-relevance { opacity: 0.75; border-color: rgba(251,191,36,0.18); }
.search-result-card-low-relevance:hover { border-color: rgba(251,191,36,0.42); box-shadow: 0 2px 18px rgba(251,191,36,0.1); }
.search-result-related-badge { display: inline-block; font-size: 0.63rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #fbbf24; background: rgba(251,191,36,0.1); padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid rgba(251,191,36,0.28); }
/* ── Pagination ──────────────────────────────────────────────────────── */
.search-pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
.pagination-btn { border: 1px solid rgba(34,211,238,0.22); background: rgba(15,23,42,0.65); color: #e0e7ff; padding: 0.375rem 1rem; border-radius: 999px; cursor: pointer; transition: all 0.2s ease; font-size: 0.875rem; }
.pagination-btn:hover { border-color: rgba(34,211,238,0.55); background: rgba(34,211,238,0.09); }
.pagination-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.pagination-info { color: #475569; font-size: 0.875rem; }
/* ── Skeleton ────────────────────────────────────────────────────────── */
@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
.search-skeleton { display: flex; flex-direction: column; gap: 0.75rem; }
.skeleton-card { background: rgba(5,8,22,0.7); border: 1px solid rgba(34,211,238,0.09); border-radius: 12px; padding: 1.125rem 1.25rem; }
.skeleton-badge, .skeleton-title, .skeleton-line { border-radius: 4px; background: linear-gradient(90deg, rgba(30,41,59,0.5) 0%, rgba(51,65,85,0.6) 50%, rgba(30,41,59,0.5) 100%); background-size: 800px 100%; animation: shimmer 1.5s infinite linear; }
.skeleton-badge { width: 48px; height: 13px; margin-bottom: 0.55rem; }
.skeleton-title { width: 70%; height: 16px; margin-bottom: 0.55rem; }
.skeleton-line { width: 100%; height: 11px; margin-bottom: 0.35rem; }
.skeleton-line-short { width: 55%; }
`,
        }}
      />
    </Layout>
  );
};
