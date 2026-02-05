import type { FC } from "hono/jsx";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";
import { Layout, type AlternateUrls } from "../layout.tsx";

export interface DetailPageProps {
  title: string;
  typeLabel: string;
  publishedDate?: string;
  summary: string;
  sourceUrl?: string;
  locale?: Locale;
  dict?: LocaleDict;
  pageTitle: string;
  pageDescription: string;
  canonicalUrl: string;
  alternateUrls: AlternateUrls;
  ogImage?: string;
  jsonLd?: Record<string, unknown>;
}

export const DetailPage: FC<DetailPageProps> = (props) => {
  const locale = props.locale ?? "en";
  const d = props.dict;
  const backLabel = d?.common.back ?? "Back";
  const summaryLabel = d?.common.fullSummary ?? "Full Summary";
  const sourceLabel = d?.common.source ?? "Source";
  const searchHref = locale !== "en" ? `/search?lang=${encodeURIComponent(locale)}` : "/search";
  return (
    <Layout
      pageClass="detail-page"
      activeNav="search"
      headerVariant="search"
      locale={locale}
      dict={d}
      pageTitle={props.pageTitle}
      pageDescription={props.pageDescription}
      canonicalUrl={props.canonicalUrl}
      alternateUrls={props.alternateUrls}
      ogImage={props.ogImage}
      ogType="article"
      twitterCard={props.ogImage ? "summary_large_image" : "summary"}
    >
      <main class="main-content main-content-narrow">
        <section class="detail-section">
          <div class="detail-meta">
            <span>{props.typeLabel}</span>
            {props.publishedDate ? <span>{props.publishedDate}</span> : null}
          </div>
          <h1 class="detail-title">{props.title}</h1>
          <div class="detail-summary-label">{summaryLabel}</div>
          <div class="detail-summary">{props.summary}</div>
          <div class="detail-actions">
            <a class="detail-button" href={searchHref}>{backLabel}</a>
            {props.sourceUrl ? (
              <a class="detail-button" href={props.sourceUrl} target="_blank" rel="noopener">
                {sourceLabel}
              </a>
            ) : null}
          </div>
        </section>
      </main>
      {props.jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(props.jsonLd) }}
        />
      ) : null}
    </Layout>
  );
};
