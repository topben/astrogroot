import { JSX } from "preact";
import { useState } from "preact/hooks";

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  isLoading?: boolean;
}

export interface SearchFilters {
  type?: "all" | "papers" | "videos" | "nasa";
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "relevance" | "date" | "title";
}

export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    type: "all",
    sortBy: "relevance",
  });

  const handleSubmit = (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), filters);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div class="search-bar-container">
      <form onSubmit={handleSubmit} class="search-form">
        <div class="search-input-wrapper">
          <input
            type="text"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="Search astronomy papers, videos, and NASA content..."
            class="search-input"
            disabled={isLoading}
          />
          <button
            type="submit"
            class="search-button"
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>

        <button
          type="button"
          class="filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? "Hide Filters" : "Show Filters"}
        </button>
      </form>

      {showFilters && (
        <div class="filters-panel">
          <div class="filter-group">
            <label>Content Type:</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange("type", (e.target as HTMLSelectElement).value)}
            >
              <option value="all">All Content</option>
              <option value="papers">Research Papers</option>
              <option value="videos">Videos</option>
              <option value="nasa">NASA Content</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Sort By:</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", (e.target as HTMLSelectElement).value)}
            >
              <option value="relevance">Relevance</option>
              <option value="date">Date</option>
              <option value="title">Title</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Date From:</label>
            <input
              type="date"
              value={filters.dateFrom || ""}
              onChange={(e) => handleFilterChange("dateFrom", (e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="filter-group">
            <label>Date To:</label>
            <input
              type="date"
              value={filters.dateTo || ""}
              onChange={(e) => handleFilterChange("dateTo", (e.target as HTMLInputElement).value)}
            />
          </div>
        </div>
      )}

      <style>{`
        .search-bar-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .search-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .search-input-wrapper {
          display: flex;
          gap: 0.5rem;
        }

        .search-input {
          flex: 1;
          padding: 0.75rem 1rem;
          font-size: 1rem;
          border: 2px solid #ddd;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          border-color: #4a90e2;
        }

        .search-button {
          padding: 0.75rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          color: white;
          background: #4a90e2;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .search-button:hover:not(:disabled) {
          background: #357abd;
        }

        .search-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .filter-toggle {
          align-self: flex-start;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          color: #4a90e2;
          background: transparent;
          border: 1px solid #4a90e2;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-toggle:hover {
          background: #4a90e2;
          color: white;
        }

        .filters-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
          margin-top: 1rem;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .filter-group label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #333;
        }

        .filter-group select,
        .filter-group input {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
