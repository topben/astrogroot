import type { FC } from "hono/jsx";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";
import { type AlternateUrls, Layout } from "../layout.tsx";

function homeHref(locale?: Locale): string {
  if (locale) return `/?lang=${encodeURIComponent(locale)}`;
  return "/";
}

const ERROR_STYLES = `
  .error-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #050816; color: #e0e7ff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; text-align: center; padding: 2rem; position: relative; overflow: hidden; }
  .error-content { position: relative; z-index: 1; }
  .error-title { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
  .error-number { font-size: 8rem; font-weight: 700; background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1; text-shadow: 0 0 50px rgba(168,85,247,0.5); }
  .error-text { font-size: 2.5rem; font-weight: 600; background: linear-gradient(135deg, #67e8f9 0%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .error-message { font-size: 1.25rem; margin-bottom: 3rem; color: #a5b4fc; max-width: 500px; }
  .return-button { display: inline-block; padding: 1rem 2.5rem; background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%); color: #e0e7ff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 1.0625rem; transition: all 0.3s ease; box-shadow: 0 4px 25px rgba(168,85,247,0.4), 0 0 40px rgba(34,211,238,0.2); }
  .return-button:hover { transform: translateY(-2px); box-shadow: 0 6px 35px rgba(168,85,247,0.5), 0 0 50px rgba(34,211,238,0.3); filter: brightness(1.1); }
  .error-page {
    padding: 1.5rem;
    background:
      radial-gradient(circle at 50% 22%, rgba(124, 58, 237, 0.14), transparent 28rem),
      var(--page);
    color: var(--text);
  }
  .error-content {
    width: min(100%, 620px); padding: clamp(2rem, 7vw, 4rem);
    border: 1px solid var(--line); border-radius: 24px;
    background: var(--surface); box-shadow: var(--shadow);
  }
  .error-number {
    color: var(--cyan); background: none; -webkit-text-fill-color: currentColor;
    font-size: clamp(5rem, 18vw, 8rem); text-shadow: none;
  }
  .error-text {
    color: var(--text); background: none; -webkit-text-fill-color: currentColor;
    font-size: clamp(1.8rem, 6vw, 2.5rem);
  }
  .error-message { margin: 0 auto 2rem; color: var(--text-soft); line-height: 1.65; }
  .return-button {
    min-height: 50px; padding: 0.85rem 1.4rem;
    display: inline-flex; align-items: center; justify-content: center;
    color: #07121d; background: linear-gradient(135deg, var(--cyan), #67e8f9);
    box-shadow: 0 10px 24px rgba(45, 212, 191, 0.16);
  }
  .return-button:hover { transform: none; filter: brightness(1.05); box-shadow: none; }
`;

export interface NotFoundPageProps {
  locale?: Locale;
  dict?: LocaleDict;
  pageTitle: string;
  pageDescription: string;
  canonicalUrl: string;
  alternateUrls: AlternateUrls;
}

export const NotFoundPage: FC<NotFoundPageProps> = (props) => {
  const locale = props.locale ?? "en";
  const d = props.dict;
  const title = d?.error404.title ?? "Lost in Space";
  const message = d?.error404.message ??
    "The page you're looking for doesn't exist in this galaxy.";
  const returnButton = d?.error404.returnButton ?? "Return to Dashboard";
  return (
    <Layout
      pageClass="error-page"
      activeNav="dashboard"
      locale={locale}
      dict={d}
      pageTitle={props.pageTitle}
      pageDescription={props.pageDescription}
      canonicalUrl={props.canonicalUrl}
      alternateUrls={props.alternateUrls}
      robots="noindex"
      showHeader={false}
      showNav={false}
      showFooter={false}
    >
      <main class="error-content" id="main-content">
        <h1 class="error-title">
          <span class="error-number">404</span>
          <span class="error-text">{title}</span>
        </h1>
        <p class="error-message">{message}</p>
        <a href={homeHref(locale)} class="return-button">
          <span>{returnButton}</span>
        </a>
      </main>
      <style dangerouslySetInnerHTML={{ __html: ERROR_STYLES }} />
    </Layout>
  );
};
