import type { FC } from "hono/jsx";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";
import { type AlternateUrls, Layout } from "../layout.tsx";

export interface DetailPageProps {
  title: string;
  typeLabel: string;
  publishedDate?: string;
  summaryHtml: string;
  sourceUrl?: string;
  returnUrl?: string; // Search URL to return to (preserves query + filters)
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
  const defaultSearchHref = `/search?lang=${encodeURIComponent(locale)}`;
  const searchHref = props.returnUrl ?? defaultSearchHref;
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
      <main class="main-content main-content-narrow" id="main-content">
        <article class="detail-section">
          <a class="detail-back-link" href={searchHref}>
            <span aria-hidden="true">←</span> {backLabel}
          </a>
          <div class="detail-meta">
            <span class="detail-type">{props.typeLabel}</span>
            {props.publishedDate
              ? <time datetime={props.publishedDate}>{props.publishedDate}</time>
              : null}
          </div>
          <h1 class="detail-title">{props.title}</h1>
          <h2 class="detail-summary-label">{summaryLabel}</h2>
          <div
            class="detail-summary markdown-body"
            dangerouslySetInnerHTML={{ __html: props.summaryHtml }}
          />
          <div class="detail-actions">
            <a class="detail-button" href={searchHref}>{backLabel}</a>
            {props.sourceUrl
              ? (
                <a
                  class="detail-button"
                  href={props.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {sourceLabel} <span aria-hidden="true">↗</span>
                </a>
              )
              : null}
          </div>
        </article>
      </main>
      {props.jsonLd
        ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(props.jsonLd) }}
          />
        )
        : null}
    </Layout>
  );
};
