const baseStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
`;

export function renderHomePage(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>AstroGroot Research Library</title>
  <style>
    ${baseStyles}
    body {
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
    }
    h1 { font-size: 3rem; margin-bottom: 1rem; }
    p { font-size: 1.25rem; opacity: 0.9; margin-bottom: 2rem; }
    .stats { display: flex; gap: 2rem; margin-bottom: 2rem; }
    .stat { background: rgba(255,255,255,0.2); padding: 1.5rem 2rem; border-radius: 12px; }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-label { font-size: 0.875rem; opacity: 0.8; }
  </style>
</head>
<body>
  <h1>AstroGroot Research Library</h1>
  <p>Your astronomy and space science knowledge hub</p>
  <div class="stats">
    <div class="stat">
      <div class="stat-value">0</div>
      <div class="stat-label">Research Papers</div>
    </div>
    <div class="stat">
      <div class="stat-value">0</div>
      <div class="stat-label">Videos</div>
    </div>
    <div class="stat">
      <div class="stat-value">0</div>
      <div class="stat-label">NASA Content</div>
    </div>
  </div>
  <p>Run the crawler to collect data!</p>
</body>
</html>
`;
}

export function renderSearchPage(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>AstroGroot Search</title>
  <style>
    ${baseStyles}
    body {
      color: #333;
      padding: 2rem;
    }
    header { text-align: center; margin-bottom: 2rem; color: white; }
    header a { color: white; text-decoration: none; font-size: 2.5rem; }
    nav { display: flex; justify-content: center; gap: 1rem; margin-bottom: 2rem; }
    nav a {
      padding: 0.75rem 1.5rem;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
    }
    nav a.active { background: rgba(255, 255, 255, 0.2); }
    main {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    h2 { color: #667eea; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <header>
    <a href="/">AstroGroot</a>
  </header>
  <nav>
    <a href="/">Dashboard</a>
    <a href="/search" class="active">Search</a>
  </nav>
  <main>
    <h2>Search the Library</h2>
    <p>Search functionality coming soon...</p>
  </main>
</body>
</html>
`;
}

export function renderNotFoundPage(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>AstroGroot | Not Found</title>
  <style>
    ${baseStyles}
    body {
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
    }
    h1 { font-size: 3rem; margin-bottom: 1rem; }
    a { color: white; text-decoration: underline; }
  </style>
</head>
<body>
  <h1>404 - Page Not Found</h1>
  <p>The page you were looking for doesn't exist.</p>
  <p><a href="/">Back to dashboard</a></p>
</body>
</html>
`;
}
