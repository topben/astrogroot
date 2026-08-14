import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";
import type { Locale, LocaleDict } from "../lib/i18n.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n.ts";
import { SEARCH_VALIDATION_SCRIPT } from "../lib/search-validation-script.ts";

const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .dashboard, .search-page, .error-page, .detail-page {
    min-height: 100vh;
    background: #050816;
    color: #e0e7ff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
    position: relative;
    overflow-x: clip;
  }
  .header { text-align: center; padding: 2rem 1rem 2rem; position: relative; z-index: 1; }
  .header-search { padding: 2rem 1rem 1.5rem; }
  .lang-switcher { position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.35rem; z-index: 2; }
  .lang-switcher a { padding: 0.55rem 0.85rem; font-size: 0.8125rem; font-weight: 500; color: #94a3b8; text-decoration: none; border-radius: 8px; border: 1px solid rgba(34,211,238,0.25); background: rgba(15,23,42,0.6); backdrop-filter: blur(8px); transition: all 0.2s ease; min-height: 36px; display: inline-flex; align-items: center; touch-action: manipulation; -webkit-tap-highlight-color: rgba(34,211,238,0.25); }
  .lang-switcher a:hover { color: #e0e7ff; border-color: rgba(34,211,238,0.5); background: rgba(34,211,238,0.1); }
  .lang-switcher a.lang-active { color: #22d3ee; border-color: rgba(34,211,238,0.6); background: rgba(34,211,238,0.15); box-shadow: 0 0 12px rgba(34,211,238,0.25); }
  .brand-link { display: inline-flex; flex-direction: column; align-items: center; gap: 0.75rem; text-decoration: none; color: inherit; transition: opacity 0.3s ease; }
  .brand-link:hover { opacity: 0.95; }
  .logo-img { height: 180px; width: auto; object-fit: contain; filter: drop-shadow(0 0 30px rgba(34,211,238,0.5)) drop-shadow(0 0 60px rgba(168,85,247,0.4)); transition: filter 0.3s ease; }
  .brand-link:hover .logo-img { filter: drop-shadow(0 0 40px rgba(34,211,238,0.7)) drop-shadow(0 0 80px rgba(168,85,247,0.5)); }
  .header-search .logo-img { height: 120px; }
  .gradient-text { font-size: 3.5rem; font-weight: 700; margin-bottom: 0; letter-spacing: -0.02em; text-shadow: 0 0 40px rgba(34,211,238,0.4), 0 0 80px rgba(168,85,247,0.3); }
  .header-search .gradient-text { font-size: 2.75rem; }
  .gradient-text a { text-decoration: none; }
  .text-astro { background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #67e8f9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; filter: drop-shadow(0 0 20px rgba(34,211,238,0.6)); }
  .text-groot { background: linear-gradient(135deg, #a855f7 0%, #c084fc 50%, #e879f9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; filter: drop-shadow(0 0 20px rgba(168,85,247,0.6)); }
  .header-subtitle { font-size: 1.5rem; color: #67e8f9; margin-bottom: 0.5rem; font-weight: 500; text-shadow: 0 0 15px rgba(34,211,238,0.4); }
  .header-description { font-size: 1.125rem; color: #a5b4fc; opacity: 0.95; }
  .navigation { display: flex; justify-content: center; gap: 1rem; padding: 1.5rem; position: relative; z-index: 1; }
  .nav-link { padding: 0.875rem 2rem; color: #a5b4fc; text-decoration: none; border-radius: 12px; transition: all 0.3s ease; background: rgba(15,23,42,0.6); border: 1px solid rgba(34,211,238,0.25); backdrop-filter: blur(10px); box-shadow: 0 0 20px rgba(0,0,0,0.2); }
  .nav-link:hover { background: rgba(34,211,238,0.1); border-color: rgba(34,211,238,0.5); transform: translateY(-2px); box-shadow: 0 4px 25px rgba(34,211,238,0.3), 0 0 40px rgba(168,85,247,0.2); }
  .nav-link.active { background: linear-gradient(135deg, rgba(34,211,238,0.15) 0%, rgba(168,85,247,0.2) 100%); border-color: rgba(168,85,247,0.5); box-shadow: 0 0 25px rgba(168,85,247,0.4), inset 0 0 20px rgba(34,211,238,0.1); }
  .nav-link.active .nav-glow { color: #e0e7ff; text-shadow: 0 0 12px rgba(168,85,247,0.9); }
  .nav-glow { transition: all 0.3s ease; }
  .main-content { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; position: relative; z-index: 1; }
  .main-content-narrow { max-width: 900px; }
  .section-title { margin-bottom: 2rem; font-size: 2rem; font-weight: 600; background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 0 0 30px rgba(168,85,247,0.3); }
  .stats-section, .info-section, .search-container { background: rgba(5,8,22,0.7); border-radius: 20px; padding: 2.5rem; margin-bottom: 2rem; border: 1px solid rgba(34,211,238,0.2); backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 40px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.05); }
  .detail-section { background: rgba(5,8,22,0.7); border-radius: 20px; padding: 2.5rem; margin-bottom: 2rem; border: 1px solid rgba(34,211,238,0.2); backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 40px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.05); }
  .detail-title { font-size: 2rem; font-weight: 700; margin-bottom: 0.75rem; color: #e0e7ff; }
  .detail-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.95rem; color: #94a3b8; margin-bottom: 1.5rem; }
  .detail-summary-label { font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.08em; color: #22d3ee; margin-bottom: 0.5rem; }
  .detail-summary { line-height: 1.8; color: #c7d2fe; font-size: 1.05rem; }
  .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 { color: #e0e7ff; margin-top: 1.25em; margin-bottom: 0.5em; font-weight: 600; }
  .markdown-body h1 { font-size: 1.4em; }
  .markdown-body h2 { font-size: 1.25em; }
  .markdown-body h3 { font-size: 1.1em; }
  .markdown-body h4 { font-size: 1em; color: #a5b4fc; }
  .markdown-body p { margin-bottom: 0.75em; }
  .markdown-body ul, .markdown-body ol { margin-left: 1.5rem; margin-bottom: 0.75em; line-height: 1.8; }
  .markdown-body li { margin-bottom: 0.25em; }
  .markdown-body li::marker { color: #a855f7; }
  .markdown-body strong { color: #e0e7ff; font-weight: 600; }
  .markdown-body em { color: #c7d2fe; font-style: italic; }
  .markdown-body code { background: rgba(34, 211, 238, 0.1); color: #67e8f9; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; font-family: "SF Mono", "Fira Code", monospace; }
  .markdown-body pre { background: rgba(5, 8, 22, 0.9); border: 1px solid rgba(34, 211, 238, 0.2); border-radius: 8px; padding: 1rem; overflow-x: auto; margin-bottom: 0.75em; }
  .markdown-body pre code { background: none; padding: 0; color: #c7d2fe; }
  .markdown-body blockquote { border-left: 3px solid rgba(168, 85, 247, 0.5); padding-left: 1rem; margin-left: 0; margin-bottom: 0.75em; color: #a5b4fc; }
  .markdown-body a { color: #22d3ee; text-decoration: underline; text-decoration-color: rgba(34, 211, 238, 0.4); transition: text-decoration-color 0.2s ease; }
  .markdown-body a:hover { text-decoration-color: #22d3ee; }
  .markdown-body hr { border: none; border-top: 1px solid rgba(34, 211, 238, 0.15); margin: 1.25em 0; }
  .markdown-body table { border-collapse: collapse; width: 100%; margin-bottom: 0.75em; }
  .markdown-body th, .markdown-body td { border: 1px solid rgba(34, 211, 238, 0.2); padding: 0.5rem 0.75rem; text-align: left; }
  .markdown-body th { background: rgba(34, 211, 238, 0.08); color: #e0e7ff; font-weight: 600; }
  .detail-actions { display: flex; gap: 0.75rem; margin-top: 1.75rem; flex-wrap: wrap; }
  .detail-button { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.1rem; border-radius: 10px; border: 1px solid rgba(34,211,238,0.3); background: rgba(15,23,42,0.6); color: #e0e7ff; text-decoration: none; transition: all 0.2s ease; }
  .detail-button:hover { border-color: rgba(34,211,238,0.6); background: rgba(34,211,238,0.1); }
  .section-title-search { margin-bottom: 0.75rem; }
  .search-description { color: #a5b4fc; margin-bottom: 2rem; font-size: 1.0625rem; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; }
  .stat-card { text-align: center; padding: 2rem 1.5rem; background: linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(168,85,247,0.12) 100%); border-radius: 16px; border: 1px solid rgba(168,85,247,0.35); color: #e0e7ff; transition: all 0.3s ease; position: relative; overflow: hidden; box-shadow: 0 0 25px rgba(0,0,0,0.2); }
  .stat-card:hover { transform: translateY(-4px); border-color: rgba(168,85,247,0.6); box-shadow: 0 8px 35px rgba(168,85,247,0.35), 0 0 50px rgba(34,211,238,0.15); }
  .stat-icon { font-size: 2rem; margin-bottom: 0.75rem; filter: drop-shadow(0 0 12px rgba(255,215,0,0.5)) drop-shadow(0 0 8px rgba(168,85,247,0.5)); }
  .stat-value { font-size: 3rem; font-weight: 700; margin-bottom: 0.5rem; background: linear-gradient(135deg, #22d3ee 0%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 0 0 25px rgba(168,85,247,0.4); }
  .stat-label { font-size: 0.9375rem; color: #a5b4fc; font-weight: 500; }
  .info-text { margin-bottom: 1.5rem; line-height: 1.8; color: #c7d2fe; font-size: 1.0625rem; }
  .info-list { margin-left: 2rem; margin-bottom: 1.5rem; line-height: 2; color: #c7d2fe; }
  .info-list li { margin-bottom: 0.5rem; }
  .info-list li::marker { color: #a855f7; filter: drop-shadow(0 0 6px rgba(168,85,247,0.6)); }
  .donate-section { background: linear-gradient(135deg, rgba(168,85,247,0.14) 0%, rgba(34,211,238,0.10) 50%, rgba(255,215,0,0.06) 100%); border-radius: 20px; padding: 2.5rem; margin-bottom: 2rem; border: 1px solid rgba(168,85,247,0.45); backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 30px rgba(168,85,247,0.18), inset 0 1px 0 rgba(255,255,255,0.06); position: relative; overflow: hidden; animation: donatePulse 7s ease-in-out infinite; }
  @keyframes donatePulse { 0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 30px rgba(168,85,247,0.18), inset 0 1px 0 rgba(255,255,255,0.06); } 50% { box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 70px rgba(168,85,247,0.35), 0 0 110px rgba(34,211,238,0.18), inset 0 1px 0 rgba(255,255,255,0.06); } }
  .donate-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
  .donate-icon { font-size: 1.75rem; filter: drop-shadow(0 0 14px rgba(255,215,0,0.8)) drop-shadow(0 0 24px rgba(168,85,247,0.5)); }
  .donate-title { font-size: 1.75rem; font-weight: 700; margin: 0; background: linear-gradient(135deg, #fde68a 0%, #c084fc 50%, #67e8f9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; filter: drop-shadow(0 0 20px rgba(192,132,252,0.35)); }
  .donate-intro { color: #c7d2fe; line-height: 1.75; margin-bottom: 1.5rem; font-size: 1.0625rem; }
  .donate-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
  .ens-pill { display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.85rem 1.4rem; background: rgba(5,8,22,0.85); border: 1px solid rgba(34,211,238,0.55); border-radius: 999px; font-family: "SF Mono", "Fira Code", "Menlo", monospace; font-size: 1.1rem; color: #67e8f9; text-shadow: 0 0 14px rgba(34,211,238,0.55); box-shadow: 0 0 24px rgba(34,211,238,0.22), inset 0 1px 0 rgba(255,255,255,0.05); position: relative; overflow: hidden; }
  .ens-pill::before { content: ""; position: absolute; top: 0; left: -60%; width: 60%; height: 100%; background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.18) 50%, transparent 75%); animation: ensShimmer 4.5s linear infinite; pointer-events: none; }
  @keyframes ensShimmer { 0% { left: -60%; } 100% { left: 160%; } }
  .ens-eth-glyph { font-weight: 700; color: #fde68a; text-shadow: 0 0 12px rgba(253,224,71,0.6); }
  .ens-text { letter-spacing: 0.08em; }
  .donate-copy { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.75rem 1.15rem; border-radius: 10px; border: 1px solid rgba(168,85,247,0.55); background: rgba(168,85,247,0.14); color: #e0e7ff; cursor: pointer; font-size: 0.95rem; font-weight: 500; font-family: inherit; transition: all 0.2s ease; }
  .donate-copy:hover { background: rgba(168,85,247,0.28); border-color: rgba(168,85,247,0.75); box-shadow: 0 0 20px rgba(168,85,247,0.4); transform: translateY(-1px); }
  .donate-copy:focus-visible { outline: 2px solid #c084fc; outline-offset: 2px; }
  .donate-copy.copied { background: rgba(34,197,94,0.2); border-color: rgba(34,197,94,0.65); color: #86efac; box-shadow: 0 0 18px rgba(34,197,94,0.3); }
  .donate-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }
  .donate-button { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.1rem; border-radius: 10px; border: 1px solid rgba(34,211,238,0.35); background: rgba(15,23,42,0.6); color: #e0e7ff; text-decoration: none; font-size: 0.95rem; transition: all 0.2s ease; }
  .donate-button:hover { border-color: rgba(34,211,238,0.65); background: rgba(34,211,238,0.12); box-shadow: 0 0 18px rgba(34,211,238,0.25); transform: translateY(-1px); }
  .donate-thanks { margin-top: 1.25rem; font-size: 0.95rem; color: #a5b4fc; opacity: 0.9; }
  @media (prefers-reduced-motion: reduce) { .donate-section, .ens-pill::before { animation: none; } }
  .site-footer { position: relative; z-index: 1; text-align: center; padding: 2rem 1rem 2.5rem; margin-top: 2rem; border-top: 1px solid rgba(34, 211, 238, 0.1); }
  .footer-links { display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap; }
  .footer-link { display: inline-flex; align-items: center; gap: 0.4rem; color: #64748b; text-decoration: none; font-size: 0.875rem; transition: color 0.2s ease; }
  .footer-link:hover { color: #22d3ee; }
  .footer-link svg { opacity: 0.7; transition: opacity 0.2s ease; }
  .footer-link:hover svg { opacity: 1; }
  .calendar-modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); overflow-y: auto; }
  .calendar-modal-backdrop[hidden] { display: none !important; }
  .calendar-popover { position: relative; min-width: 280px; max-width: min(320px, calc(100vw - 2rem)); padding: 1.25rem; padding-top: 2.25rem; background: rgba(5, 8, 22, 0.98); border: 1px solid rgba(34, 211, 238, 0.35); border-radius: 16px; box-shadow: 0 0 40px rgba(0,0,0,0.5), 0 0 60px rgba(168, 85, 247, 0.2), 0 0 80px rgba(34, 211, 238, 0.12); backdrop-filter: blur(12px); flex-shrink: 0; margin: auto; }
  .calendar-close { position: absolute; top: 0.75rem; right: 0.75rem; width: 2rem; height: 2rem; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 8px; color: #94a3b8; font-size: 1.5rem; line-height: 1; cursor: pointer; transition: color 0.2s ease, background 0.2s ease; }
  .calendar-close:hover { color: #e0e7ff; background: rgba(168, 85, 247, 0.2); }
  .calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .calendar-month-year { font-size: 1rem; font-weight: 600; color: #e0e7ff; text-shadow: 0 0 20px rgba(34, 211, 238, 0.3); }
  .calendar-nav { width: 2rem; height: 2rem; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(34, 211, 238, 0.1); border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 8px; color: #22d3ee; font-size: 1.25rem; cursor: pointer; transition: all 0.2s ease; line-height: 1; }
  .calendar-nav:hover { background: rgba(34, 211, 238, 0.2); border-color: rgba(34, 211, 238, 0.5); box-shadow: 0 0 15px rgba(34, 211, 238, 0.25); }
  .calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 0.5rem; text-align: center; font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
  .calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .calendar-day { width: 2.25rem; height: 2.25rem; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 8px; font-size: 0.875rem; color: #e0e7ff; cursor: pointer; transition: all 0.2s ease; margin: 0 auto; }
  .calendar-day:hover { background: rgba(168, 85, 247, 0.2); color: #fff; box-shadow: 0 0 12px rgba(168, 85, 247, 0.3); }
  .calendar-day.other-month { color: #475569; opacity: 0.7; }
  .calendar-day.other-month:hover { background: rgba(34, 211, 238, 0.1); color: #94a3b8; }
`;

const UI_REFRESH_STYLES = `
  :root {
    color-scheme: dark;
    --page: #060914;
    --surface: rgba(12, 18, 35, 0.92);
    --surface-strong: #10182a;
    --surface-soft: rgba(17, 26, 46, 0.72);
    --line: rgba(148, 163, 184, 0.18);
    --line-strong: rgba(94, 234, 212, 0.38);
    --text: #f8fafc;
    --text-soft: #cbd5e1;
    --muted: #94a3b8;
    --cyan: #5eead4;
    --violet: #a78bfa;
    --gold: #fbbf24;
    --danger: #fda4af;
    --radius-lg: 20px;
    --radius-md: 14px;
    --shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  }
  html { scroll-behavior: smooth; }
  body { background: var(--page); }
  button, input, select { font: inherit; }
  a, button, input, select { -webkit-tap-highlight-color: transparent; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  :where(a, button, input, select):focus-visible {
    outline: 3px solid rgba(94, 234, 212, 0.78);
    outline-offset: 3px;
  }
  .skip-link {
    position: fixed; top: 0.75rem; left: 0.75rem; z-index: 10000;
    padding: 0.7rem 1rem; border-radius: 10px; color: #06111d;
    background: var(--cyan); font-weight: 750; text-decoration: none;
    transform: translateY(-160%); transition: transform 0.18s ease;
  }
  .skip-link:focus { transform: translateY(0); }
  .dashboard, .search-page, .error-page, .detail-page {
    background:
      radial-gradient(circle at 85% 4%, rgba(124, 58, 237, 0.14), transparent 28rem),
      radial-gradient(circle at 8% 85%, rgba(8, 145, 178, 0.12), transparent 30rem),
      var(--page);
    color: var(--text);
    font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .header {
    width: min(100%, 1180px); margin: 0 auto; padding: 1.35rem 1.5rem 0.9rem;
  }
  .header-search { padding-bottom: 0.4rem; }
  .brand-link { gap: 0; }
  .brand-link picture { display: block; line-height: 0; }
  .logo-img {
    width: 132px; height: 132px; border-radius: 24px;
    filter: drop-shadow(0 15px 35px rgba(34, 211, 238, 0.16));
  }
  .brand-link:hover .logo-img {
    filter: drop-shadow(0 18px 42px rgba(94, 234, 212, 0.24));
  }
  .header-search .logo-img { width: 84px; height: 84px; border-radius: 18px; }
  .header-subtitle {
    margin: 0.7rem 0 0.35rem; color: var(--text);
    font-size: clamp(1.65rem, 3vw, 2.4rem); font-weight: 760;
    letter-spacing: -0.035em; text-shadow: none;
  }
  .header-description {
    max-width: 640px; margin: 0 auto; color: var(--text-soft);
    font-size: clamp(0.98rem, 2vw, 1.1rem); line-height: 1.65;
  }
  .lang-switcher { top: 1.25rem; right: 1.5rem; }
  .lang-switcher a {
    min-height: 40px; padding: 0.5rem 0.72rem; border-color: var(--line);
    border-radius: 10px; color: var(--muted); background: rgba(10, 15, 29, 0.78);
    box-shadow: none;
  }
  .lang-switcher a:hover {
    color: var(--text); border-color: rgba(94, 234, 212, 0.45);
    background: var(--surface-strong);
  }
  .lang-switcher a.lang-active {
    color: var(--cyan); border-color: var(--line-strong);
    background: rgba(94, 234, 212, 0.09); box-shadow: none;
  }
  .navigation {
    position: sticky; top: 0.75rem; z-index: 30;
    width: max-content; max-width: calc(100% - 2rem); margin: 0.4rem auto 0;
    padding: 0.35rem; gap: 0.25rem; border: 1px solid var(--line);
    border-radius: 16px; background: rgba(6, 9, 20, 0.84);
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24); backdrop-filter: blur(18px);
  }
  .nav-link {
    min-height: 44px; padding: 0.72rem 1.15rem;
    display: inline-flex; align-items: center; justify-content: center;
    border: 0; border-radius: 11px; color: var(--muted);
    background: transparent; box-shadow: none; font-size: 0.92rem; font-weight: 650;
  }
  .nav-link:hover {
    color: var(--text); border-color: transparent; background: rgba(148, 163, 184, 0.09);
    transform: none; box-shadow: none;
  }
  .nav-link.active {
    color: #07121d; background: linear-gradient(135deg, var(--cyan), #67e8f9);
    border-color: transparent; box-shadow: 0 8px 22px rgba(45, 212, 191, 0.16);
  }
  .nav-link.active .nav-glow { color: inherit; text-shadow: none; }
  .main-content {
    width: min(100%, 1180px); margin: 1.6rem auto 4rem; padding: 0 1.5rem;
  }
  .main-content-narrow { max-width: 830px; }
  .section-title {
    margin-bottom: 1.3rem; color: var(--text); background: none;
    -webkit-text-fill-color: currentColor;
    font-size: clamp(1.35rem, 2.5vw, 1.8rem); font-weight: 740;
    letter-spacing: -0.025em; text-shadow: none;
  }
  .stats-section, .info-section, .search-container, .detail-section, .donate-section,
  .quick-search-section {
    padding: clamp(1.25rem, 3vw, 2rem); margin-bottom: 1.25rem;
    border: 1px solid var(--line); border-radius: var(--radius-lg);
    background: var(--surface); box-shadow: var(--shadow); backdrop-filter: blur(18px);
  }
  .quick-search-section {
    padding-block: clamp(1.75rem, 5vw, 3rem); text-align: center;
    background:
      linear-gradient(135deg, rgba(94, 234, 212, 0.09), transparent 42%),
      linear-gradient(315deg, rgba(167, 139, 250, 0.1), transparent 48%),
      var(--surface);
    border-color: rgba(94, 234, 212, 0.22);
  }
  .quick-search-section .section-title { margin-bottom: 1.5rem; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.8rem; }
  .stat-card {
    min-width: 0; padding: 1.25rem; display: grid;
    grid-template-columns: auto 1fr; grid-template-areas: "icon value" "icon label";
    column-gap: 0.9rem; align-items: center; text-align: left;
    border: 1px solid var(--line); border-radius: var(--radius-md);
    background: var(--surface-soft); box-shadow: none;
  }
  .stat-card:hover {
    transform: none; border-color: rgba(94, 234, 212, 0.33); box-shadow: none;
  }
  .stat-icon {
    grid-area: icon; width: 2.6rem; height: 2.6rem; margin: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 12px; color: var(--cyan); background: rgba(94, 234, 212, 0.09);
    font-size: 0.75rem; font-weight: 800; letter-spacing: 0.02em; filter: none;
  }
  .stat-value {
    grid-area: value; margin: 0; color: var(--text); background: none;
    -webkit-text-fill-color: currentColor; font-size: clamp(1.55rem, 3vw, 2rem);
    line-height: 1.05; text-shadow: none;
  }
  .stat-label {
    grid-area: label; margin-top: 0.25rem; color: var(--muted); font-size: 0.8rem;
  }
  .dashboard-grid {
    display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
    gap: 1.25rem; margin-bottom: 1.25rem;
  }
  .dashboard-grid > section { margin-bottom: 0; }
  .info-text, .info-list, .donate-intro {
    color: var(--text-soft); font-size: 1rem; line-height: 1.75;
  }
  .info-list { margin-left: 1.25rem; line-height: 1.7; }
  .info-list li { margin-bottom: 0.75rem; padding-left: 0.25rem; }
  .donate-section {
    animation: none;
    background: linear-gradient(145deg, rgba(167, 139, 250, 0.1), transparent 55%), var(--surface);
    border-color: rgba(167, 139, 250, 0.22);
  }
  .donate-title {
    color: var(--text); background: none; -webkit-text-fill-color: currentColor;
    font-size: 1.45rem; filter: none;
  }
  .donate-icon { color: var(--gold); filter: none; }
  .ens-pill {
    max-width: 100%; border-color: var(--line); color: var(--cyan);
    background: rgba(6, 9, 20, 0.65); box-shadow: none; font-size: 0.95rem;
  }
  .ens-pill::before { display: none; }
  .donate-copy, .donate-button, .detail-button {
    min-height: 44px; border-color: var(--line);
    background: rgba(148, 163, 184, 0.07); color: var(--text-soft);
  }
  .donate-copy:hover, .donate-button:hover, .detail-button:hover {
    border-color: var(--line-strong); background: rgba(94, 234, 212, 0.09);
    color: var(--text); box-shadow: none; transform: none;
  }
  .tool-section { padding: 0; overflow: hidden; }
  .tool-card {
    padding: 1.35rem 1.5rem; display: grid;
    grid-template-columns: auto 1fr auto; gap: 1rem; align-items: center;
    color: inherit; text-decoration: none;
  }
  .tool-card:hover { background: rgba(94, 234, 212, 0.05); }
  .tool-card-icon {
    width: 2.75rem; height: 2.75rem; display: inline-flex;
    align-items: center; justify-content: center; border-radius: 12px;
    color: var(--gold); background: rgba(251, 191, 36, 0.1); font-size: 1.15rem;
  }
  .tool-card-title { display: block; color: var(--text); font-weight: 700; }
  .tool-card-description {
    display: block; margin-top: 0.25rem; color: var(--muted);
    font-size: 0.88rem; line-height: 1.55;
  }
  .tool-card-arrow { color: var(--cyan); font-size: 1.35rem; }
  .detail-section { padding: clamp(1.4rem, 4vw, 2.7rem); }
  .detail-back-link {
    display: inline-flex; align-items: center; gap: 0.4rem;
    margin-bottom: 1.5rem; color: var(--muted); text-decoration: none; font-size: 0.9rem;
  }
  .detail-back-link:hover { color: var(--cyan); }
  .detail-title {
    margin-bottom: 1.15rem; color: var(--text);
    font-size: clamp(1.75rem, 4vw, 2.55rem); line-height: 1.18;
    letter-spacing: -0.035em;
  }
  .detail-meta { margin-bottom: 0.8rem; color: var(--muted); font-size: 0.86rem; }
  .detail-type {
    padding: 0.25rem 0.6rem; border: 1px solid rgba(94, 234, 212, 0.25);
    border-radius: 999px; color: var(--cyan); background: rgba(94, 234, 212, 0.07);
    font-size: 0.72rem; font-weight: 750; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .detail-summary-label {
    margin: 2rem 0 0.85rem; color: var(--text);
    font-size: 1.1rem; font-weight: 720; letter-spacing: -0.01em; text-transform: none;
  }
  .detail-summary { color: var(--text-soft); font-size: 1.02rem; line-height: 1.82; }
  .markdown-body p { margin-bottom: 1em; }
  .site-footer { margin-top: 0; padding-bottom: 2.5rem; border-color: var(--line); }
  .footer-link { min-height: 44px; color: var(--muted); }
  .footer-link:hover { color: var(--cyan); }
  @media (max-width: 900px) {
    html { scroll-behavior: auto; }
    .dashboard, .search-page, .error-page, .detail-page {
      background: linear-gradient(180deg, #060914 0%, #090d1b 46%, #060914 100%);
    }
    .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dashboard-grid { grid-template-columns: 1fr; }
    .navigation {
      position: relative; top: auto; background: #080d1b;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18); backdrop-filter: none;
    }
    .lang-switcher a, .nav-link, .stats-section, .info-section, .search-container,
    .detail-section, .donate-section, .quick-search-section,
    .calendar-modal-backdrop, .calendar-popover {
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    .lang-switcher a { background: #0a0f1d; }
    .stats-section, .info-section, .search-container, .detail-section,
    .donate-section, .quick-search-section {
      background: #0c1223;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
    }
    .stats-section, .info-section, .donate-section, .tool-section {
      content-visibility: auto;
      contain-intrinsic-block-size: auto 320px;
    }
  }
  @media (max-width: 640px) {
    .header { padding: 4.3rem 1rem 0.65rem; }
    .header-search { padding-top: 4.15rem; }
    .lang-switcher { top: 0.75rem; right: 0.75rem; }
    .logo-img { width: 104px; height: 104px; border-radius: 20px; }
    .header-search .logo-img { width: 70px; height: 70px; }
    .navigation {
      width: calc(100% - 1.5rem); max-width: none; overflow-x: auto;
      justify-content: flex-start; scrollbar-width: none;
    }
    .navigation::-webkit-scrollbar { display: none; }
    .nav-link { flex: 1 0 auto; padding-inline: 0.9rem; }
    .main-content { margin-top: 1rem; padding-inline: 0.75rem; }
    .stats-grid { grid-template-columns: 1fr; }
    .stat-card { padding: 1rem; }
    .tool-card { grid-template-columns: auto 1fr; }
    .tool-card-arrow { display: none; }
    .detail-section { border-radius: 16px; }
    .detail-actions { flex-direction: column; }
    .detail-button { justify-content: center; }
    .markdown-body table { display: block; overflow-x: auto; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export type AlternateUrls = {
  en: string;
  "zh-TW": string;
  "zh-CN": string;
  xDefault?: string;
};

export function localeSwitcherHref(alternateUrls: AlternateUrls, locale: Locale): string {
  const href = alternateUrls[locale];

  try {
    const pageUrl = new URL(href);
    // UI language choices must be explicit. If English omits ?lang=en, a browser
    // with Chinese Accept-Language immediately resolves the page back to Chinese.
    pageUrl.searchParams.set("lang", locale);
    const returnUrl = pageUrl.searchParams.get("returnUrl");
    if (!returnUrl?.startsWith("/search")) return pageUrl.toString();

    const localizedReturnUrl = new URL(returnUrl, pageUrl.origin);
    localizedReturnUrl.searchParams.set("lang", locale);

    pageUrl.searchParams.set(
      "returnUrl",
      `${localizedReturnUrl.pathname}${localizedReturnUrl.search}${localizedReturnUrl.hash}`,
    );
    return pageUrl.toString();
  } catch {
    return href;
  }
}

type LayoutProps = PropsWithChildren<{
  pageClass: string;
  activeNav?: "dashboard" | "search";
  headerVariant?: "default" | "search";
  locale?: Locale;
  dict?: LocaleDict;
  pageTitle: string;
  pageDescription: string;
  canonicalUrl: string;
  alternateUrls: AlternateUrls;
  localeSwitcherUrls?: AlternateUrls;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  robots?: string;
  showHeader?: boolean;
  showNav?: boolean;
  showFooter?: boolean;
}>;

function searchHref(locale?: Locale): string {
  if (locale) return `/search?lang=${encodeURIComponent(locale)}`;
  return "/search";
}

function homeHref(locale?: Locale): string {
  if (locale) return `/?lang=${encodeURIComponent(locale)}`;
  return "/";
}

function mapHref(locale?: Locale): string {
  if (locale) return `/map?lang=${encodeURIComponent(locale)}`;
  return "/map";
}

const LOCALE_LABELS: Record<Locale, string> = {
  "en": "EN",
  "zh-TW": "繁中",
  "zh-CN": "簡中",
};

export const Layout: FC<LayoutProps> = (props) => {
  const {
    pageClass,
    activeNav = "dashboard",
    headerVariant = "default",
    locale,
    dict,
    children,
    pageTitle,
    pageDescription,
    canonicalUrl,
    alternateUrls,
    localeSwitcherUrls,
    ogImage,
    ogType = "website",
    twitterCard = "summary",
    robots,
    showHeader = true,
    showNav = true,
    showFooter = true,
  } = props;
  const headerClass = headerVariant === "search" ? "header header-search" : "header";
  const currentLocale = locale ?? "en";
  const ogLocale = currentLocale === "en" ? "en_US" : currentLocale === "zh-TW" ? "zh_TW" : "zh_CN";
  const navDashboard = dict?.nav.dashboard ?? "Dashboard";
  const navSearch = dict?.nav.search ?? "Search";
  const navMap = dict?.nav.map ?? "Knowledge Map";
  const headerSubtitle = dict?.header.subtitle ?? "Research Library";
  const headerDescription = dict?.header.description ??
    "Your astronomy and space science knowledge hub";
  const calendarWeekdays = dict?.calendar.weekdays ??
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const calendarMonths = dict?.calendar.months ??
    [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
  const calendarPickDate = dict?.calendar.pickDate ?? "Pick a date";
  const calendarPrevMonth = dict?.calendar.prevMonth ?? "Previous month";
  const calendarNextMonth = dict?.calendar.nextMonth ?? "Next month";
  const calendarClose = dict?.calendar.close ?? "Close calendar";
  const skipLabel = currentLocale === "zh-TW"
    ? "跳至主要內容"
    : currentLocale === "zh-CN"
    ? "跳至主要内容"
    : "Skip to main content";
  const primaryNavLabel = currentLocale === "zh-TW"
    ? "主要導覽"
    : currentLocale === "zh-CN"
    ? "主要导航"
    : "Primary navigation";
  const languageLabel = currentLocale === "zh-TW"
    ? "語言"
    : currentLocale === "zh-CN"
    ? "语言"
    : "Language";
  const calendarMonthsStr = calendarMonths.join("\u001F");
  const fallbackOgImage = "/static/astrogroot-logo.png";
  const ogImageUrl = (() => {
    const image = ogImage ?? fallbackOgImage;
    try {
      return new URL(image, canonicalUrl).toString();
    } catch {
      return image;
    }
  })();
  const xDefaultUrl = alternateUrls.xDefault ?? alternateUrls.en;
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={currentLocale}>
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{pageTitle}</title>
          <meta name="description" content={pageDescription} />
          <link rel="canonical" href={canonicalUrl} />
          <link rel="alternate" hreflang="en" href={alternateUrls.en} />
          <link rel="alternate" hreflang="zh-Hant" href={alternateUrls["zh-TW"]} />
          <link rel="alternate" hreflang="zh-Hans" href={alternateUrls["zh-CN"]} />
          <link rel="alternate" hreflang="x-default" href={xDefaultUrl} />
          <link rel="icon" href="/static/favicon.png" type="image/png" />
          {robots ? <meta name="robots" content={robots} /> : null}
          <meta property="og:type" content={ogType} />
          <meta property="og:title" content={pageTitle} />
          <meta property="og:description" content={pageDescription} />
          <meta property="og:image" content={ogImageUrl} />
          <meta property="og:url" content={canonicalUrl} />
          <meta property="og:site_name" content="AstroGroot" />
          <meta property="og:locale" content={ogLocale} />
          <meta name="twitter:card" content={twitterCard} />
          <meta name="twitter:title" content={pageTitle} />
          <meta name="twitter:description" content={pageDescription} />
          <meta name="twitter:image" content={ogImageUrl} />
          <style dangerouslySetInnerHTML={{ __html: SHARED_STYLES }} />
          <style dangerouslySetInnerHTML={{ __html: UI_REFRESH_STYLES }} />
        </head>
        <body>
          <a class="skip-link" href="#main-content">{skipLabel}</a>
          <div class={pageClass}>
            {showHeader
              ? (
                <header class={headerClass}>
                  <div class="lang-switcher" role="group" aria-label={languageLabel}>
                    {SUPPORTED_LOCALES.map((loc) => (
                      <a
                        href={localeSwitcherHref(localeSwitcherUrls ?? alternateUrls, loc)}
                        class={currentLocale === loc ? "lang-active" : ""}
                        aria-current={currentLocale === loc ? "page" : undefined}
                        aria-label={loc === "en"
                          ? "English"
                          : loc === "zh-TW"
                          ? "繁體中文"
                          : "简体中文"}
                      >
                        {LOCALE_LABELS[loc]}
                      </a>
                    ))}
                  </div>
                  <a href={homeHref(locale)} class="brand-link" aria-label="AstroGroot home">
                    <picture>
                      <source srcset="/static/astrogroot-logo-320.webp" type="image/webp" />
                      <img
                        src="/static/astrogroot-logo.png"
                        alt=""
                        class="logo-img"
                        width="132"
                        height="132"
                        decoding="async"
                      />
                    </picture>
                  </a>
                  {headerVariant === "default" && (
                    <>
                      <h1 class="header-subtitle">{headerSubtitle}</h1>
                      <p class="header-description">{headerDescription}</p>
                    </>
                  )}
                </header>
              )
              : null}
            {showNav && (activeNav === "dashboard" || activeNav === "search")
              ? (
                <nav class="navigation" aria-label={primaryNavLabel}>
                  <a
                    href={homeHref(locale)}
                    class={activeNav === "dashboard" ? "nav-link active" : "nav-link"}
                    aria-current={activeNav === "dashboard" ? "page" : undefined}
                  >
                    <span class="nav-glow">{navDashboard}</span>
                  </a>
                  <a
                    href={searchHref(locale)}
                    class={activeNav === "search" ? "nav-link active" : "nav-link"}
                    aria-current={activeNav === "search" ? "page" : undefined}
                  >
                    <span class="nav-glow">{navSearch}</span>
                  </a>
                  <a href={mapHref(locale)} class="nav-link">
                    <span class="nav-glow">{navMap}</span>
                  </a>
                </nav>
              )
              : null}
            {children}
            {showFooter
              ? (
                <footer class="site-footer">
                  <div class="footer-links">
                    <a
                      href="https://github.com/topben/astrogroot"
                      target="_blank"
                      rel="noopener"
                      class="footer-link"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="16"
                        height="16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                      GitHub
                    </a>
                    <a
                      href="https://docs.google.com/spreadsheets/d/1tc5hTo12MniREvjuCuKNT03Qss7ovJecBMWrU9dnQRQ/edit?usp=sharing"
                      target="_blank"
                      rel="noopener"
                      class="footer-link"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="16"
                        height="16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M2 1.75C2 .784 2.784 0 3.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0112.25 16h-8.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H3.75zM5.5 7a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5zm0 3a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5z" />
                      </svg>
                      {dict?.common.recommendedPapers ?? "Recommended Papers"}
                    </a>
                  </div>
                </footer>
              )
              : null}
            {showFooter
              ? (
                <div
                  id="calendar-modal-backdrop"
                  class="calendar-modal-backdrop"
                  hidden
                  aria-hidden="true"
                >
                  <div
                    id="calendar-popover"
                    class="calendar-popover"
                    role="dialog"
                    aria-modal="true"
                    aria-label={calendarPickDate}
                    data-weekdays={calendarWeekdays.join("\u001F")}
                    data-months={calendarMonthsStr}
                    data-pick-date={calendarPickDate}
                    data-prev-month={calendarPrevMonth}
                    data-next-month={calendarNextMonth}
                    data-close={calendarClose}
                  >
                    <button type="button" class="calendar-close" aria-label={calendarClose}>
                      ×
                    </button>
                    <div class="calendar-header">
                      <button
                        type="button"
                        class="calendar-nav calendar-prev"
                        aria-label={calendarPrevMonth}
                      >
                        ‹
                      </button>
                      <div class="calendar-month-year" id="calendar-month-year"></div>
                      <button
                        type="button"
                        class="calendar-nav calendar-next"
                        aria-label={calendarNextMonth}
                      >
                        ›
                      </button>
                    </div>
                    <div class="calendar-weekdays">
                      {calendarWeekdays.map((w) => <span key={w}>{w}</span>)}
                    </div>
                    <div class="calendar-days" id="calendar-days"></div>
                  </div>
                </div>
              )
              : null}
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: SEARCH_VALIDATION_SCRIPT,
            }}
          />
        </body>
      </html>
    </>
  );
};
