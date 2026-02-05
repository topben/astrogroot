/**
 * i18n: UI static strings (dictionary-based).
 * Locale from ?lang= or Accept-Language; ISO 639-1 style (en, zh-TW, zh-CN).
 */

export const SUPPORTED_LOCALES = ["en", "zh-TW", "zh-CN"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: Locale = "en";

export interface LocaleDict {
  nav: { dashboard: string; search: string };
  header: { subtitle: string; description: string };
  stats: { title: string; papers: string; videos: string; nasa: string; total: string };
  search: {
    title: string;
    description: string;
    placeholder: string;
    button: string;
    showFilters: string;
    hideFilters: string;
    contentType: string;
    allContent: string;
    papers: string;
    videos: string;
    nasa: string;
    sortBy: string;
    relevance: string;
    date: string;
    sortByTitle: string;
    dateFrom: string;
    dateTo: string;
    try: string;
    hint: string;
    searching: string;
    found: string;
    noResults: string;
    error: string;
    relatedNotice: string;
    relatedLabel: string;
    page: string;
    of: string;
    prev: string;
    next: string;
  };
  about: {
    title: string;
    intro: string;
    sources: { papers: string; videos: string; nasa: string };
    ai: string;
  };
  common: {
    paper: string;
    video: string;
    nasa: string;
    more: string;
    back: string;
    fullSummary: string;
    source: string;
    recommendedPapers: string;
  };
  seo: {
    siteName: string;
    homeTitle: string;
    homeDescription: string;
    searchTitle: string;
    searchDescription: string;
    searchResultsTitle: string;
    searchResultsDescription: string;
    notFoundTitle: string;
    notFoundDescription: string;
  };
  error404: { title: string; message: string; returnButton: string };
  calendar: {
    weekdays: [string, string, string, string, string, string, string];
    months: [string, string, string, string, string, string, string, string, string, string, string, string];
    pickDate: string;
    prevMonth: string;
    nextMonth: string;
    close: string;
  };
}

const cache = new Map<Locale, LocaleDict>();

function parseAcceptLanguage(header: string | undefined): Locale | null {
  if (!header) return null;
  const parts = header.split(",").map((s) => s.split(";")[0].trim().toLowerCase());
  for (const part of parts) {
    const lang = part.slice(0, 2);
    if (lang === "zh") {
      if (part.includes("tw") || part.includes("hant")) return "zh-TW";
      if (part.includes("cn") || part.includes("hans")) return "zh-CN";
      return "zh-TW";
    }
    if (lang === "en") return "en";
  }
  return null;
}

/** Resolve locale from query ?lang= or Accept-Language. */
export function getLocaleFromRequest(queryLang: string | undefined, acceptLanguage: string | undefined): Locale {
  const q = queryLang?.trim();
  if (q && (SUPPORTED_LOCALES as readonly string[]).includes(q)) return q as Locale;
  const fromHeader = parseAcceptLanguage(acceptLanguage);
  return fromHeader ?? DEFAULT_LOCALE;
}

/** Load dictionary for locale (cached). */
export async function loadDictionary(locale: Locale): Promise<LocaleDict> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const path = new URL(`../locales/${locale}.json`, import.meta.url);
  const text = await Deno.readTextFile(path);
  const dict = JSON.parse(text) as LocaleDict;
  cache.set(locale, dict);
  return dict;
}

/** Replace {key} placeholders in string. */
export function interpolate(s: string, params: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}
