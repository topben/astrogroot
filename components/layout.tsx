import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";
import type { Locale, LocaleDict } from "../lib/i18n.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n.ts";

const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .dashboard, .search-page, .error-page, .detail-page {
    min-height: 100vh;
    background: #050816;
    color: #e0e7ff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
    position: relative;
    overflow-x: hidden;
  }
  .starfield {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-image:
      radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.9), transparent),
      radial-gradient(2px 2px at 60% 70%, rgba(255,255,255,0.9), transparent),
      radial-gradient(1px 1px at 50% 50%, #fff, transparent),
      radial-gradient(1px 1px at 80% 10%, rgba(255,215,0,0.4), transparent),
      radial-gradient(2px 2px at 90% 40%, #fff, transparent),
      radial-gradient(1px 1px at 33% 60%, rgba(34,211,238,0.5), transparent),
      radial-gradient(1px 1px at 55% 80%, #fff, transparent),
      radial-gradient(2px 2px at 15% 90%, rgba(255,215,0,0.3), transparent),
      radial-gradient(1px 1px at 75% 20%, #fff, transparent),
      radial-gradient(1px 1px at 40% 10%, rgba(168,85,247,0.4), transparent),
      radial-gradient(1px 1px at 10% 20%, #fff, transparent),
      radial-gradient(2px 2px at 85% 85%, rgba(255,255,255,0.8), transparent),
      radial-gradient(1px 1px at 25% 45%, rgba(34,211,238,0.6), transparent),
      radial-gradient(1px 1px at 70% 15%, rgba(255,215,0,0.35), transparent),
      radial-gradient(2px 2px at 5% 60%, #fff, transparent),
      radial-gradient(1px 1px at 95% 55%, rgba(168,85,247,0.5), transparent),
      radial-gradient(1px 1px at 45% 5%, #fff, transparent),
      radial-gradient(1px 1px at 12% 78%, rgba(255,255,255,0.85), transparent),
      radial-gradient(2px 2px at 65% 35%, rgba(255,215,0,0.3), transparent),
      radial-gradient(1px 1px at 88% 92%, rgba(34,211,238,0.45), transparent),
      radial-gradient(1px 1px at 38% 25%, #fff, transparent),
      radial-gradient(1px 1px at 52% 65%, rgba(168,85,247,0.4), transparent),
      radial-gradient(2px 2px at 72% 48%, #fff, transparent),
      radial-gradient(1px 1px at 18% 12%, rgba(255,255,255,0.9), transparent),
      radial-gradient(1px 1px at 92% 28%, #fff, transparent);
    background-size: 200% 200%; background-position: 0% 0%;
    animation: starfield 60s linear infinite; opacity: 0.8; z-index: 0;
  }
  .starfield-2 {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-image:
      radial-gradient(1px 1px at 8% 42%, #fff, transparent),
      radial-gradient(1px 1px at 62% 8%, rgba(255,255,255,0.9), transparent),
      radial-gradient(2px 2px at 28% 88%, rgba(34,211,238,0.5), transparent),
      radial-gradient(1px 1px at 78% 62%, #fff, transparent),
      radial-gradient(1px 1px at 42% 38%, rgba(255,215,0,0.4), transparent),
      radial-gradient(1px 1px at 15% 55%, rgba(168,85,247,0.45), transparent),
      radial-gradient(2px 2px at 92% 75%, #fff, transparent),
      radial-gradient(1px 1px at 55% 22%, rgba(255,255,255,0.85), transparent),
      radial-gradient(1px 1px at 35% 72%, #fff, transparent),
      radial-gradient(1px 1px at 68% 45%, rgba(34,211,238,0.5), transparent),
      radial-gradient(1px 1px at 22% 18%, rgba(255,215,0,0.35), transparent),
      radial-gradient(1px 1px at 48% 82%, #fff, transparent),
      radial-gradient(1px 1px at 82% 32%, rgba(168,85,247,0.4), transparent),
      radial-gradient(2px 2px at 5% 95%, #fff, transparent),
      radial-gradient(1px 1px at 98% 15%, rgba(255,255,255,0.9), transparent);
    background-size: 250% 250%; background-position: 0% 0%;
    animation: starfield-2 45s linear infinite reverse; opacity: 0.75; z-index: 0;
  }
  @keyframes starfield { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }
  @keyframes starfield-2 { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }
  .starfield-js { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; }
  .starfield-js .star { position: absolute; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; animation: starTrack linear infinite; }
  @keyframes starTrack { 0% { transform: translate(0, 0); opacity: var(--op, 0.9); } 50% { opacity: var(--op-mid, 0.6); } 100% { transform: translate(var(--tx, 80px), var(--ty, -60px)); opacity: var(--op, 0.9); } }
  .nebula { position: fixed; border-radius: 50%; filter: blur(100px); opacity: 0.2; z-index: 0; }
  .nebula-1 { width: 600px; height: 600px; background: radial-gradient(circle, #a855f7 0%, #7c3aed 40%, transparent 70%); top: -200px; right: -200px; }
  .nebula-2 { width: 500px; height: 500px; background: radial-gradient(circle, #22d3ee 0%, #06b6d4 40%, transparent 70%); bottom: -150px; left: -150px; }
  .header { text-align: center; padding: 2rem 1rem 2rem; position: relative; z-index: 1; }
  .header-search { padding: 2rem 1rem 1.5rem; }
  .lang-switcher { position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.35rem; z-index: 2; }
  .lang-switcher a { padding: 0.4rem 0.65rem; font-size: 0.8125rem; font-weight: 500; color: #94a3b8; text-decoration: none; border-radius: 8px; border: 1px solid rgba(34,211,238,0.25); background: rgba(15,23,42,0.6); backdrop-filter: blur(8px); transition: all 0.2s ease; }
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

export type AlternateUrls = {
  en: string;
  "zh-TW": string;
  "zh-CN": string;
  xDefault?: string;
};

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
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  robots?: string;
  showHeader?: boolean;
  showNav?: boolean;
  showFooter?: boolean;
}>;

function searchHref(locale?: Locale): string {
  if (locale && locale !== "en") return `/search?lang=${encodeURIComponent(locale)}`;
  return "/search";
}

function homeHref(locale?: Locale): string {
  if (locale && locale !== "en") return `/?lang=${encodeURIComponent(locale)}`;
  return "/";
}

const LOCALE_LABELS: Record<Locale, string> = {
  "en": "EN",
  "zh-TW": "繁中",
  "zh-CN": "簡中",
};

function currentPageHref(activeNav: "dashboard" | "search" | undefined, locale: Locale): string {
  return activeNav === "search" ? searchHref(locale) : homeHref(locale);
}

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
  const headerSubtitle = dict?.header.subtitle ?? "Research Library";
  const headerDescription = dict?.header.description ?? "Your astronomy and space science knowledge hub";
  const calendarWeekdays = dict?.calendar.weekdays ?? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const calendarMonths = dict?.calendar.months ?? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const calendarPickDate = dict?.calendar.pickDate ?? "Pick a date";
  const calendarPrevMonth = dict?.calendar.prevMonth ?? "Previous month";
  const calendarNextMonth = dict?.calendar.nextMonth ?? "Next month";
  const calendarClose = dict?.calendar.close ?? "Close calendar";
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
        </head>
        <body>
          <div class={pageClass}>
            <div class="starfield" />
            <div class="starfield-2" />
            <div id="starfield-js" class="starfield-js" aria-hidden="true" />
            <div class="nebula nebula-1" />
            <div class="nebula nebula-2" />
            {showHeader ? (
              <header class={headerClass}>
                <div class="lang-switcher" role="group" aria-label="Language">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <a
                      href={currentPageHref(activeNav, loc)}
                      class={currentLocale === loc ? "lang-active" : ""}
                      aria-current={currentLocale === loc ? "true" : undefined}
                      aria-label={loc === "en" ? "English" : loc === "zh-TW" ? "繁體中文" : "简体中文"}
                    >
                      {LOCALE_LABELS[loc]}
                    </a>
                  ))}
                </div>
                <a href={homeHref(locale)} class="brand-link" aria-label="AstroGroot home">
                  <img
                    src="/static/astrogroot-logo.png"
                    alt="AstroGroot - Astronomy Research Library"
                    class="logo-img"
                    width="420"
                    height="180"
                  />
                </a>
                {headerVariant === "default" && (
                  <>
                    <p class="header-subtitle">{headerSubtitle}</p>
                    <p class="header-description">{headerDescription}</p>
                  </>
                )}
              </header>
            ) : null}
            {showNav && (activeNav === "dashboard" || activeNav === "search") ? (
              <nav class="navigation">
                <a href={homeHref(locale)} class={activeNav === "dashboard" ? "nav-link active" : "nav-link"}>
                  <span class="nav-glow">{navDashboard}</span>
                </a>
                <a href={searchHref(locale)} class={activeNav === "search" ? "nav-link active" : "nav-link"}>
                  <span class="nav-glow">{navSearch}</span>
                </a>
              </nav>
            ) : null}
            {children}
            {showFooter ? (
              <footer class="site-footer">
                <div class="footer-links">
                  <a href="https://github.com/topben/astrogroot" target="_blank" rel="noopener" class="footer-link">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                    GitHub
                  </a>
                  <a href="https://docs.google.com/spreadsheets/d/1tc5hTo12MniREvjuCuKNT03Qss7ovJecBMWrU9dnQRQ/edit?usp=sharing" target="_blank" rel="noopener" class="footer-link">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M2 1.75C2 .784 2.784 0 3.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0112.25 16h-8.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H3.75zM5.5 7a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5zm0 3a.75.75 0 000 1.5h5a.75.75 0 000-1.5h-5z"/></svg>
                    {dict?.common.recommendedPapers ?? "Recommended Papers"}
                  </a>
                </div>
              </footer>
            ) : null}
            {showFooter ? (
              <div id="calendar-modal-backdrop" class="calendar-modal-backdrop" hidden aria-hidden="true">
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
                  <button type="button" class="calendar-close" aria-label={calendarClose}>×</button>
                  <div class="calendar-header">
                    <button type="button" class="calendar-nav calendar-prev" aria-label={calendarPrevMonth}>‹</button>
                    <div class="calendar-month-year" id="calendar-month-year"></div>
                    <button type="button" class="calendar-nav calendar-next" aria-label={calendarNextMonth}>›</button>
                  </div>
                  <div class="calendar-weekdays">
                    {calendarWeekdays.map((w) => <span key={w}>{w}</span>)}
                  </div>
                  <div class="calendar-days" id="calendar-days"></div>
                </div>
              </div>
            ) : null}
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `
(function() {
  var container = document.getElementById('starfield-js');
  if (!container) return;
  var colors = ['#fff', 'rgba(34,211,238,0.9)', 'rgba(255,215,0,0.7)', 'rgba(168,85,247,0.8)', 'rgba(255,255,255,0.85)'];
  var count = 60 + Math.floor(Math.random() * 90);
  for (var i = 0; i < count; i++) {
    var star = document.createElement('div');
    star.className = 'star';
    var size = 1 + Math.random() * 2.5;
    var left = Math.random() * 100;
    var top = Math.random() * 100;
    var tx = (Math.random() - 0.5) * 240;
    var ty = (Math.random() - 0.5) * 240;
    var duration = 25 + Math.random() * 55;
    var delay = Math.random() * 12;
    var op = 0.5 + Math.random() * 0.5;
    var opMid = op * 0.5 + Math.random() * 0.3;
    star.style.cssText = 'left:' + left + '%;top:' + top + '%;width:' + size + 'px;height:' + size + 'px;color:' + colors[Math.floor(Math.random() * colors.length)] + ';--tx:' + tx + 'px;--ty:' + ty + 'px;--op:' + op + ';--op-mid:' + opMid + ';animation-duration:' + duration + 's;animation-delay:-' + delay + 's;';
    container.appendChild(star);
  }
})();
`,
            }}
          />
        </body>
      </html>
    </>
  );
};
