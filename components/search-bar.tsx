import type { FC } from "hono/jsx";

interface SearchBarProps {
  initialQuery?: string;
  initialType?: string;
  initialSortBy?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
}

/** Static search form + vanilla JS for filter toggle and submit. No Preact. */
export const SearchBar: FC<SearchBarProps> = (props) => {
  const q = props.initialQuery ?? "";
  const type = props.initialType ?? "all";
  const sortBy = props.initialSortBy ?? "relevance";
  const dateFrom = props.initialDateFrom ?? "";
  const dateTo = props.initialDateTo ?? "";
  return (
  <div class="search-bar-container">
    <form id="search-form" class="search-form" method="get" action="/search">
      <div class="search-input-wrapper">
        <input
          type="text"
          name="q"
          id="search-input"
          placeholder="Search astronomy papers, videos, and NASA content..."
          class="search-input"
          autocomplete="off"
          defaultValue={q}
        />
        <button type="submit" class="search-button" id="search-btn">
          Search
        </button>
      </div>
      <button type="button" class="filter-toggle" id="filter-toggle" aria-expanded="false">
        Show Filters
      </button>
      <div class="filters-panel" id="filters-panel" hidden>
        <div class="filter-group">
          <label for="filter-type">Content Type:</label>
          <select name="type" id="filter-type" defaultValue={type}>
            <option value="all">All Content</option>
            <option value="papers">Research Papers</option>
            <option value="videos">Videos</option>
            <option value="nasa">NASA Content</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-sort">Sort By:</label>
          <select name="sortBy" id="filter-sort" defaultValue={sortBy}>
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
            <option value="title">Title</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-dateFrom">Date From:</label>
          <input type="date" name="dateFrom" id="filter-dateFrom" defaultValue={dateFrom} />
        </div>
        <div class="filter-group">
          <label for="filter-dateTo">Date To:</label>
          <input type="date" name="dateTo" id="filter-dateTo" defaultValue={dateTo} />
        </div>
      </div>
    </form>
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  var toggle = document.getElementById('filter-toggle');
  var panel = document.getElementById('filters-panel');
  if (toggle && panel) {
    toggle.addEventListener('click', function() {
      var open = !panel.hidden;
      panel.hidden = !open;
      toggle.textContent = open ? "Hide Filters" : "Show Filters";
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  }
  var form = document.getElementById('search-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      var q = document.getElementById('search-input');
      if (q && !q.value.trim()) e.preventDefault();
    });
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
.filter-toggle { align-self: flex-start; padding: 0.625rem 1.25rem; font-size: 0.9375rem; color: #a855f7; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 10px; cursor: pointer; transition: all 0.3s ease; font-weight: 500; }
.filter-toggle:hover { background: rgba(168, 85, 247, 0.2); border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 15px rgba(168, 85, 247, 0.3); transform: translateY(-1px); }
.filters-panel { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; padding: 2rem; background: rgba(5, 8, 22, 0.8); border-radius: 16px; margin-top: 1rem; border: 1px solid rgba(34, 211, 238, 0.2); backdrop-filter: blur(10px); box-shadow: 0 0 30px rgba(0,0,0,0.2); }
.filter-group { display: flex; flex-direction: column; gap: 0.75rem; }
.filter-group label { font-size: 0.9375rem; font-weight: 600; color: #c7d2fe; }
.filter-group select, .filter-group input { padding: 0.75rem; background: rgba(5, 8, 22, 0.9); border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 10px; font-size: 0.9375rem; color: #e0e7ff; outline: none; }
.filter-group select:focus, .filter-group input:focus { border-color: rgba(168, 85, 247, 0.6); box-shadow: 0 0 20px rgba(168, 85, 247, 0.25); background: rgba(5, 8, 22, 0.95); }
`,
      }}
    />
  </div>
  );
};
