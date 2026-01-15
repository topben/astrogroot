export default function Home() {
  return (
    <div class="dashboard">
      <header class="header">
        <h1>AstroGroot Research Library</h1>
        <p>Your astronomy and space science knowledge hub</p>
      </header>

      <nav class="navigation">
        <a href="/" class="nav-link active">Dashboard</a>
        <a href="/search" class="nav-link">Search</a>
      </nav>

      <main class="main-content">
        <section class="stats-section">
          <h2>Library Statistics</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">0</div>
              <div class="stat-label">Research Papers</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">0</div>
              <div class="stat-label">Videos</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">0</div>
              <div class="stat-label">NASA Content</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">0</div>
              <div class="stat-label">Total Items</div>
            </div>
          </div>
        </section>

        <section class="info-section">
          <h2>About AstroGroot</h2>
          <p>
            AstroGroot is an automated astronomy research library that collects, processes, and
            indexes content from multiple sources:
          </p>
          <ul>
            <li>Research papers from arXiv</li>
            <li>Educational videos from YouTube</li>
            <li>NASA imagery and content</li>
          </ul>
          <p>
            All content is processed using Claude AI for summarization and semantic search via
            vector embeddings.
          </p>
        </section>
      </main>

      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .dashboard {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .header {
          text-align: center;
          padding: 3rem 1rem;
          color: white;
        }

        .header h1 {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .header p {
          font-size: 1.25rem;
          opacity: 0.9;
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
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 1rem;
        }

        .stats-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .stats-section h2 {
          margin-bottom: 1.5rem;
          color: #667eea;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .stat-card {
          text-align: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          color: white;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .info-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .info-section h2 {
          margin-bottom: 1rem;
          color: #667eea;
        }

        .info-section p {
          margin-bottom: 1rem;
          line-height: 1.6;
        }

        .info-section ul {
          margin-left: 1.5rem;
          line-height: 1.8;
        }
      `}</style>
    </div>
  );
}
