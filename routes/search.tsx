export default function Search() {
  return (
    <div class="search-page">
      <header class="header">
        <h1>
          <a href="/">AstroGroot</a>
        </h1>
      </header>

      <nav class="navigation">
        <a href="/" class="nav-link">Dashboard</a>
        <a href="/search" class="nav-link active">Search</a>
      </nav>

      <main class="main-content">
        <div class="search-container">
          <h2>Search the Library</h2>
          <p>Search functionality coming soon...</p>
        </div>
      </main>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .search-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .header {
          text-align: center;
          padding: 2rem 1rem;
        }

        .header h1 a {
          color: white;
          text-decoration: none;
          font-size: 2.5rem;
        }

        .navigation {
          display: flex;
          justify-content: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .nav-link {
          padding: 0.75rem 1.5rem;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .nav-link:hover,
        .nav-link.active {
          background: rgba(255, 255, 255, 0.2);
        }

        .main-content {
          max-width: 900px;
          margin: 2rem auto;
          padding: 0 1rem;
        }

        .search-container {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .search-container h2 {
          color: #667eea;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
