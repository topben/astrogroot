import type { FC } from "hono/jsx";
import { Layout } from "../layout.tsx";
import { SearchBar } from "../search-bar.tsx";

export const SearchPage: FC = () => (
  <Layout pageClass="search-page" activeNav="search" headerVariant="search">
    <main class="main-content main-content-narrow">
      <div class="search-container">
        <h2 class="section-title section-title-search">Search the Library</h2>
        <p class="search-description">Explore astronomy papers, videos, and NASA content</p>
        <SearchBar />
      </div>
    </main>
  </Layout>
);
