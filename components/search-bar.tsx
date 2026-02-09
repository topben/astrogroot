import type { FC } from "hono/jsx";
import type { Locale, LocaleDict } from "../lib/i18n.ts";

interface SearchBarProps {
  initialQuery?: string;
  initialType?: string;
  initialSortBy?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  locale?: Locale;
  dict?: LocaleDict;
  compact?: boolean; // For dashboard mini search bar
  showSuggestions?: boolean; // Show quick search examples
}

// Quick search examples
const QUICK_SEARCHES = [
  { en: "black holes", "zh-TW": "黑洞", "zh-CN": "黑洞" },
  { en: "dark energy", "zh-TW": "暗能量", "zh-CN": "暗能量" },
  { en: "exoplanets", "zh-TW": "系外行星", "zh-CN": "系外行星" },
  { en: "Mars rover", "zh-TW": "火星探測車", "zh-CN": "火星探测车" },
  { en: "gravitational waves", "zh-TW": "重力波", "zh-CN": "引力波" },
  { en: "humanoid robot", "zh-TW": "人形機器人", "zh-CN": "人形机器人" },
  { en: "robotic arm", "zh-TW": "機械臂", "zh-CN": "机械臂" },
  { en: "Mars rover autonomy", "zh-TW": "火星探測車自主", "zh-CN": "火星探测车自主" },
];

/** Static search form + vanilla JS for filter toggle and submit. No Preact. */
export const SearchBar: FC<SearchBarProps> = (props) => {
  const q = props.initialQuery ?? "";
  const type = props.initialType ?? "all";
  const sortBy = props.initialSortBy ?? "relevance";
  const dateFrom = props.initialDateFrom ?? "";
  const dateTo = props.initialDateTo ?? "";
  const locale = props.locale ?? "en";
  const compact = props.compact ?? false;
  const showSuggestions = props.showSuggestions ?? false;
  const d = props.dict;
  const placeholder = d?.search.placeholder ?? "Search astronomy papers, videos, and NASA content...";
  const buttonLabel = d?.search.button ?? "Search";
  const showFilters = d?.search.showFilters ?? "Show Filters";
  const hideFilters = d?.search.hideFilters ?? "Hide Filters";
  const contentType = d?.search.contentType ?? "Content Type:";
  const allContent = d?.search.allContent ?? "All Content";
  const papersLabel = d?.search.papers ?? "Research Papers";
  const videosLabel = d?.search.videos ?? "Videos";
  const nasaLabel = d?.search.nasa ?? "NASA Content";
  const sortByLabel = d?.search.sortBy ?? "Sort By:";
  const relevanceLabel = d?.search.relevance ?? "Relevance";
  const dateLabel = d?.search.date ?? "Date";
  const titleLabel = d?.search.sortByTitle ?? "Title";
  const dateFromLabel = d?.search.dateFrom ?? "Date From:";
  const dateToLabel = d?.search.dateTo ?? "Date To:";
  const pickDateLabel = d?.calendar.pickDate ?? "Pick date";
  const tryLabel = d?.search.try ?? "Try:";
  const invalidLanguage = d?.search.invalidLanguage ?? "Please enter English keywords only.";
  const formAction = "/search";

  // Get localized quick searches
  const quickSearches = QUICK_SEARCHES.map(s => s[locale as keyof typeof s] || s.en);
  // Compact mode for dashboard
  if (compact) {
    return (
      <div class="search-bar-compact">
        <form
          class="search-form-compact"
          method="get"
          action={formAction}
          data-search-form="true"
          data-locale={locale}
          data-invalid-msg={invalidLanguage}
        >
          <input type="hidden" name="lang" value={locale} />
          <input
            type="text"
            name="q"
            placeholder={placeholder}
            class="search-input-compact"
            autocomplete="off"
          />
          <button type="submit" class="search-button-compact">
            🔍
          </button>
        </form>
        <p class="search-input-error search-input-error-compact" hidden></p>
        {showSuggestions && (
          <div class="quick-searches-compact">
            <span class="quick-label">{tryLabel}</span>
            {quickSearches.slice(0, 3).map((term) => (
              <a href={`/search?q=${encodeURIComponent(term)}&lang=${locale}`} class="quick-link">
                {term}
              </a>
            ))}
          </div>
        )}
        <style dangerouslySetInnerHTML={{ __html: `
.search-bar-compact { max-width: 500px; margin: 0 auto; }
.search-form-compact { display: flex; gap: 0.5rem; }
.search-input-compact { flex: 1; padding: 0.75rem 1rem; font-size: 1rem; background: rgba(5, 8, 22, 0.8); border: 2px solid rgba(34, 211, 238, 0.3); border-radius: 10px; outline: none; color: #e0e7ff; transition: all 0.3s ease; }
.search-input-compact:focus { border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 20px rgba(168, 85, 247, 0.3); }
.search-input-compact::placeholder { color: #64748b; }
.search-button-compact { padding: 0.75rem 1.25rem; font-size: 1.125rem; background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%); border: none; border-radius: 10px; cursor: pointer; transition: all 0.3s ease; }
.search-button-compact:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4); }
.search-input-error { margin: 0.5rem 0 0; font-size: 0.875rem; color: #f87171; }
.search-input-error-compact { text-align: center; }
.quick-searches-compact { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.75rem; justify-content: center; }
.quick-label { font-size: 0.875rem; color: #64748b; }
.quick-link { font-size: 0.875rem; color: #22d3ee; text-decoration: none; padding: 0.25rem 0.75rem; background: rgba(34, 211, 238, 0.1); border-radius: 20px; transition: all 0.2s ease; }
.quick-link:hover { background: rgba(34, 211, 238, 0.2); color: #a855f7; }
` }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  function isInvalidForLocale(value, locale) {
    var validator = window.__astroSearchValidation;
    if (!validator || typeof validator.isInvalidForLocale !== 'function') return false;
    return validator.isInvalidForLocale(value, locale);
  }
  function showError(form, message) {
    var error = form.parentElement ? form.parentElement.querySelector('.search-input-error') : null;
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    var input = form.querySelector('input[name="q"]');
    if (input) input.setAttribute('aria-invalid', 'true');
  }
  function clearError(form) {
    var error = form.parentElement ? form.parentElement.querySelector('.search-input-error') : null;
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
    var input = form.querySelector('input[name="q"]');
    if (input) input.removeAttribute('aria-invalid');
  }
  function validateForm(form) {
    var input = form.querySelector('input[name="q"]');
    if (!input) return true;
    var locale = form.getAttribute('data-locale') || 'en';
    var msg = form.getAttribute('data-invalid-msg') || 'Please enter English keywords only.';
    var value = input.value || '';
    if (!value.trim()) { clearError(form); return true; }
    if (isInvalidForLocale(value, locale)) { showError(form, msg); return false; }
    clearError(form);
    return true;
  }
  var forms = Array.prototype.slice.call(document.querySelectorAll('form[data-search-form="true"]'));
  forms.forEach(function(form) {
    form.addEventListener('submit', function(e) {
      var input = form.querySelector('input[name="q"]');
      if (input && !input.value.trim()) { clearError(form); e.preventDefault(); return; }
      if (!validateForm(form)) e.preventDefault();
    });
    var input = form.querySelector('input[name="q"]');
    if (input) input.addEventListener('input', function() { validateForm(form); });
  });
})();
`,
          }}
        />
      </div>
    );
  }

  return (
  <div class="search-bar-container">
    <form
      id="search-form"
      class="search-form"
      method="get"
      action={formAction}
      data-search-form="true"
      data-locale={locale}
      data-invalid-msg={invalidLanguage}
    >
      <input type="hidden" name="lang" value={locale} />
      <div class="search-input-wrapper">
        <input
          type="text"
          name="q"
          id="search-input"
          placeholder={placeholder}
          class="search-input"
          autocomplete="off"
          defaultValue={q}
        />
        <button type="submit" class="search-button" id="search-btn">
          {buttonLabel}
        </button>
      </div>
      <p class="search-input-error" hidden></p>

      {/* Content Type Tabs - Always visible */}
      <div class="content-type-tabs" role="tablist">
        <label class={`type-tab ${type === "all" ? "active" : ""}`}>
          <input type="radio" name="type" value="all" checked={type === "all"} />
          <span>📚 {allContent}</span>
        </label>
        <label class={`type-tab ${type === "papers" ? "active" : ""}`}>
          <input type="radio" name="type" value="papers" checked={type === "papers"} />
          <span>📄 {papersLabel}</span>
        </label>
        <label class={`type-tab ${type === "videos" ? "active" : ""}`}>
          <input type="radio" name="type" value="videos" checked={type === "videos"} />
          <span>🎥 {videosLabel}</span>
        </label>
        <label class={`type-tab ${type === "nasa" ? "active" : ""}`}>
          <input type="radio" name="type" value="nasa" checked={type === "nasa"} />
          <span>🚀 {nasaLabel}</span>
        </label>
      </div>

      {/* Quick Search Suggestions */}
      {showSuggestions && !q && (
        <div class="quick-searches">
          <span class="quick-label">{tryLabel}</span>
          {quickSearches.map((term) => (
            <a href={`/search?q=${encodeURIComponent(term)}&lang=${locale}`} class="quick-link">
              {term}
            </a>
          ))}
        </div>
      )}

      <button type="button" class="filter-toggle" id="filter-toggle" aria-expanded="false" data-show={showFilters} data-hide={hideFilters}>
        {showFilters}
      </button>
      <div class="filters-panel" id="filters-panel" hidden>
        <div class="filter-group">
          <label for="filter-type">{contentType}</label>
          <select name="typeFilter" id="filter-type" defaultValue={type}>
            <option value="all">{allContent}</option>
            <option value="papers">{papersLabel}</option>
            <option value="videos">{videosLabel}</option>
            <option value="nasa">{nasaLabel}</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-sort">{sortByLabel}</label>
          <select name="sortBy" id="filter-sort" defaultValue={sortBy}>
            <option value="relevance">{relevanceLabel}</option>
            <option value="date">{dateLabel}</option>
            <option value="title">{titleLabel}</option>
          </select>
        </div>
        <div class="filter-group date-picker-group">
          <label for="filter-dateFrom">{dateFromLabel}</label>
          <div class="date-picker-wrap">
            <input type="date" name="dateFrom" id="filter-dateFrom" class="date-input" defaultValue={dateFrom} />
            <button type="button" class="calendar-btn" data-target="filter-dateFrom" title={pickDateLabel} aria-label={pickDateLabel}>
              <span class="calendar-btn-icon" aria-hidden="true">📅</span>
            </button>
          </div>
        </div>
        <div class="filter-group date-picker-group">
          <label for="filter-dateTo">{dateToLabel}</label>
          <div class="date-picker-wrap">
            <input type="date" name="dateTo" id="filter-dateTo" class="date-input" defaultValue={dateTo} />
            <button type="button" class="calendar-btn" data-target="filter-dateTo" title={pickDateLabel} aria-label={pickDateLabel}>
              <span class="calendar-btn-icon" aria-hidden="true">📅</span>
            </button>
          </div>
        </div>
      </div>
    </form>
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  function initFilters() {
    var toggle = document.getElementById('filter-toggle');
    var panel = document.getElementById('filters-panel');
    if (toggle && panel) {
      var showText = toggle.getAttribute('data-show') || 'Show Filters';
      var hideText = toggle.getAttribute('data-hide') || 'Hide Filters';
      toggle.addEventListener('click', function() {
        var isHidden = panel.hidden;
        panel.hidden = !isHidden;
        toggle.textContent = isHidden ? hideText : showText;
        toggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });
    }
    var form = document.getElementById('search-form');
    function isInvalidForLocale(value, locale) {
      var validator = window.__astroSearchValidation;
      if (!validator || typeof validator.isInvalidForLocale !== 'function') return false;
      return validator.isInvalidForLocale(value, locale);
    }
    function showError(message) {
      if (!form) return;
      var error = form.querySelector('.search-input-error');
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
      var q = document.getElementById('search-input');
      if (q) q.setAttribute('aria-invalid', 'true');
    }
    function clearError() {
      if (!form) return;
      var error = form.querySelector('.search-input-error');
      if (error) {
        error.textContent = '';
        error.hidden = true;
      }
      var q = document.getElementById('search-input');
      if (q) q.removeAttribute('aria-invalid');
    }
    function validateForm() {
      if (!form) return true;
      var q = document.getElementById('search-input');
      if (!q) return true;
      var value = q.value || '';
      var locale = form.getAttribute('data-locale') || 'en';
      var msg = form.getAttribute('data-invalid-msg') || 'Please enter English keywords only.';
      if (!value.trim()) { clearError(); return true; }
      if (isInvalidForLocale(value, locale)) { showError(msg); return false; }
      clearError();
      return true;
    }
    if (form) {
      form.addEventListener('submit', function(e) {
        var q = document.getElementById('search-input');
        if (q && !q.value.trim()) { clearError(); e.preventDefault(); return; }
        if (!validateForm()) e.preventDefault();
      });
      var input = document.getElementById('search-input');
      if (input) input.addEventListener('input', validateForm);
    }
    var filterType = document.getElementById('filter-type');
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.content-type-tabs input[name="type"]'));
    function setActiveTab(value) {
      tabs.forEach(function(input) {
        var label = input.closest('label');
        if (label) label.classList.toggle('active', input.value === value);
        input.checked = input.value === value;
      });
    }
    function maybeSubmit() {
      var q = document.getElementById('search-input');
      if (form && q && q.value.trim()) {
        if (validateForm()) form.submit();
      }
    }
    if (filterType && filterType instanceof HTMLSelectElement) {
      filterType.addEventListener('change', function() {
        var value = filterType.value || 'all';
        setActiveTab(value);
        maybeSubmit();
      });
    }
    tabs.forEach(function(input) {
      input.addEventListener('change', function() {
        var value = input.value || 'all';
        if (filterType && filterType instanceof HTMLSelectElement) {
          filterType.value = value;
        }
        setActiveTab(value);
        maybeSubmit();
      });
    });
    var current = tabs.find(function(input) { return input.checked; });
    if (current) setActiveTab(current.value || 'all');
  }
  function initCalendar() {
    var backdrop = document.getElementById('calendar-modal-backdrop');
    var popover = document.getElementById('calendar-popover');
    if (!backdrop || !popover) return;
    var monthYearEl = document.getElementById('calendar-month-year');
    var daysEl = document.getElementById('calendar-days');
    var currentYear, currentMonth, targetInputId;
    var monthsAttr = popover.getAttribute('data-months');
    var sep = String.fromCharCode(31);
    var MONTHS = monthsAttr ? monthsAttr.split(sep) : ['January','February','March','April','May','June','July','August','September','October','November','December'];
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function openCalendar(inputId) {
      targetInputId = inputId;
      var input = document.getElementById(inputId);
      if (input && input.value) {
        var p = input.value.split('-').map(Number);
        if (p.length === 3) { currentYear = p[0]; currentMonth = p[1] - 1; }
        else { var d = new Date(); currentYear = d.getFullYear(); currentMonth = d.getMonth(); }
      } else {
        var d = new Date();
        currentYear = d.getFullYear();
        currentMonth = d.getMonth();
      }
      renderCalendar();
      backdrop.hidden = false;
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeCalendar() {
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    function setDate(y, m, d) {
      var input = document.getElementById(targetInputId);
      if (input) {
        input.value = y + '-' + pad(m) + '-' + pad(d);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      closeCalendar();
    }
    function renderCalendar() {
      if (!monthYearEl || !daysEl) return;
      monthYearEl.textContent = MONTHS[currentMonth] + ' ' + currentYear;
      var first = new Date(currentYear, currentMonth, 1);
      var start = first.getDay();
      var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      var prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      var prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      var prevDays = new Date(prevYear, prevMonth + 1, 0).getDate();
      var html = '';
      var i;
      for (i = start - 1; i >= 0; i--) {
        var d = prevDays - i;
        html += '<button type="button" class="calendar-day other-month" data-y="' + prevYear + '" data-m="' + (prevMonth + 1) + '" data-d="' + d + '">' + d + '</button>';
      }
      for (i = 1; i <= daysInMonth; i++) {
        html += '<button type="button" class="calendar-day" data-y="' + currentYear + '" data-m="' + (currentMonth + 1) + '" data-d="' + i + '">' + i + '</button>';
      }
      var remaining = 42 - (start + daysInMonth);
      var nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      var nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      for (i = 1; i <= remaining; i++) {
        html += '<button type="button" class="calendar-day other-month" data-y="' + nextYear + '" data-m="' + (nextMonth + 1) + '" data-d="' + i + '">' + i + '</button>';
      }
      daysEl.innerHTML = html;
      daysEl.querySelectorAll('.calendar-day').forEach(function(btn) {
        btn.addEventListener('click', function() {
          setDate(parseInt(btn.getAttribute('data-y'), 10), parseInt(btn.getAttribute('data-m'), 10), parseInt(btn.getAttribute('data-d'), 10));
        });
      });
    }
    document.querySelectorAll('.calendar-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-target');
        if (id) openCalendar(id);
      });
    });
    popover.addEventListener('click', function(e) { e.stopPropagation(); });
    var prevBtn = popover.querySelector('.calendar-prev');
    var nextBtn = popover.querySelector('.calendar-next');
    if (prevBtn) prevBtn.addEventListener('click', function() {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar();
    });
    if (nextBtn) nextBtn.addEventListener('click', function() {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar();
    });
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closeCalendar();
    });
    var closeBtn = popover.querySelector('.calendar-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCalendar);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !backdrop.hidden) closeCalendar();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initFilters();
      initCalendar();
    });
  } else {
    initFilters();
    initCalendar();
  }
})();
`,
      }}
    />
    <style
      dangerouslySetInnerHTML={{
        __html: `
.search-bar-container { width: 100%; max-width: 800px; margin: 0 auto; }
.search-form { display: flex; flex-direction: column; gap: 1.25rem; }
.search-input-wrapper { display: flex; gap: 0.75rem; }
.search-input { flex: 1; padding: 1rem 1.25rem; font-size: 1.0625rem; background: rgba(5, 8, 22, 0.8); border: 2px solid rgba(34, 211, 238, 0.3); border-radius: 12px; outline: none; color: #e0e7ff; transition: all 0.3s ease; backdrop-filter: blur(10px); }
.search-input::placeholder { color: #64748b; }
.search-input:focus { border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 25px rgba(168, 85, 247, 0.4), 0 0 40px rgba(34, 211, 238, 0.15); background: rgba(5, 8, 22, 0.95); }
.search-button { padding: 1rem 2.5rem; font-size: 1.0625rem; font-weight: 600; color: #e0e7ff; background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%); border: none; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 20px rgba(168, 85, 247, 0.35), 0 0 30px rgba(34, 211, 238, 0.2); }
.search-button:hover { transform: translateY(-2px); box-shadow: 0 6px 30px rgba(168, 85, 247, 0.5), 0 0 45px rgba(34, 211, 238, 0.3); filter: brightness(1.1); }
.search-input-error { margin: -0.25rem 0 0; font-size: 0.9375rem; color: #f87171; }
.filter-toggle { align-self: flex-start; padding: 0.625rem 1.25rem; font-size: 0.9375rem; color: #a855f7; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 10px; cursor: pointer; transition: all 0.3s ease; font-weight: 500; }
.filter-toggle:hover { background: rgba(168, 85, 247, 0.2); border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 15px rgba(168, 85, 247, 0.3); transform: translateY(-1px); }
.filters-panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; padding: 2rem; background: rgba(5, 8, 22, 0.8); border-radius: 16px; margin-top: 1rem; border: 1px solid rgba(34, 211, 238, 0.2); backdrop-filter: blur(10px); box-shadow: 0 0 30px rgba(0,0,0,0.2); }
.filter-group { display: flex; flex-direction: column; gap: 0.75rem; }
.filter-group label { font-size: 0.9375rem; font-weight: 600; color: #c7d2fe; }
.filter-group select, .filter-group input { padding: 0.75rem; background: rgba(5, 8, 22, 0.9); border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 10px; font-size: 0.9375rem; color: #e0e7ff; outline: none; }
.filter-group select:focus, .filter-group input:focus { border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 20px rgba(168, 85, 247, 0.25); background: rgba(5, 8, 22, 0.95); }
.date-picker-group { grid-column: 1 / -1; }
.date-picker-wrap { display: flex; gap: 0.5rem; align-items: center; }
.date-picker-wrap .date-input { flex: 1; min-width: 0; }
.calendar-btn { display: flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; padding: 0; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 10px; color: #e0e7ff; cursor: pointer; transition: all 0.2s ease; }
.calendar-btn:hover { background: rgba(168, 85, 247, 0.25); border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 15px rgba(168, 85, 247, 0.3); }
.calendar-btn-icon { font-size: 1.25rem; line-height: 1; }
.content-type-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
.type-tab { display: flex; align-items: center; gap: 0.25rem; padding: 0.5rem 1rem; font-size: 0.9375rem; color: #94a3b8; background: rgba(5, 8, 22, 0.6); border: 1px solid rgba(34, 211, 238, 0.2); border-radius: 25px; cursor: pointer; transition: all 0.2s ease; }
.type-tab input { display: none; }
.type-tab:hover { background: rgba(34, 211, 238, 0.1); border-color: rgba(34, 211, 238, 0.4); color: #e0e7ff; }
.type-tab.active { background: rgba(34, 211, 238, 0.15); border-color: rgba(34, 211, 238, 0.5); color: #22d3ee; box-shadow: 0 0 15px rgba(34, 211, 238, 0.2); }
.quick-searches { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 1rem; padding: 1rem; background: rgba(5, 8, 22, 0.5); border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.15); }
.quick-label { font-size: 0.875rem; color: #64748b; margin-right: 0.25rem; }
.quick-link { font-size: 0.875rem; color: #a855f7; text-decoration: none; padding: 0.375rem 0.875rem; background: rgba(168, 85, 247, 0.1); border-radius: 20px; transition: all 0.2s ease; border: 1px solid rgba(168, 85, 247, 0.2); }
.quick-link:hover { background: rgba(168, 85, 247, 0.2); color: #c4b5fd; border-color: rgba(168, 85, 247, 0.4); transform: translateY(-1px); }
`,
      }}
    />
  </div>
  );
};
