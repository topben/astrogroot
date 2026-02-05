import type { FC } from "hono/jsx";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";
import { Layout, type AlternateUrls } from "../layout.tsx";

function homeHref(locale?: Locale): string {
  if (locale && locale !== "en") return `/?lang=${encodeURIComponent(locale)}`;
  return "/";
}

const ERROR_STYLES = `
  .starfield { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-image: radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.9), transparent), radial-gradient(2px 2px at 60% 70%, rgba(255,255,255,0.9), transparent), radial-gradient(1px 1px at 50% 50%, #fff, transparent), radial-gradient(1px 1px at 80% 10%, rgba(255,215,0,0.4), transparent), radial-gradient(1px 1px at 33% 60%, rgba(34,211,238,0.5), transparent), radial-gradient(1px 1px at 10% 20%, #fff, transparent), radial-gradient(2px 2px at 85% 85%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 25% 45%, rgba(34,211,238,0.6), transparent), radial-gradient(1px 1px at 70% 15%, rgba(255,215,0,0.35), transparent), radial-gradient(2px 2px at 5% 60%, #fff, transparent), radial-gradient(1px 1px at 95% 55%, rgba(168,85,247,0.5), transparent), radial-gradient(1px 1px at 45% 5%, #fff, transparent), radial-gradient(1px 1px at 12% 78%, rgba(255,255,255,0.85), transparent), radial-gradient(2px 2px at 65% 35%, rgba(255,215,0,0.3), transparent), radial-gradient(1px 1px at 88% 92%, rgba(34,211,238,0.45), transparent); background-size: 200% 200%; animation: starfield 60s linear infinite; opacity: 0.8; z-index: 0; }
  .starfield-2 { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-image: radial-gradient(1px 1px at 8% 42%, #fff, transparent), radial-gradient(1px 1px at 62% 8%, rgba(255,255,255,0.9), transparent), radial-gradient(2px 2px at 28% 88%, rgba(34,211,238,0.5), transparent), radial-gradient(1px 1px at 78% 62%, #fff, transparent), radial-gradient(1px 1px at 42% 38%, rgba(255,215,0,0.4), transparent), radial-gradient(1px 1px at 15% 55%, rgba(168,85,247,0.45), transparent), radial-gradient(2px 2px at 92% 75%, #fff, transparent), radial-gradient(1px 1px at 55% 22%, rgba(255,255,255,0.85), transparent), radial-gradient(1px 1px at 35% 72%, #fff, transparent), radial-gradient(1px 1px at 68% 45%, rgba(34,211,238,0.5), transparent); background-size: 250% 250%; animation: starfield-2 45s linear infinite reverse; opacity: 0.75; z-index: 0; }
  @keyframes starfield { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }
  @keyframes starfield-2 { 0% { background-position: 0% 0%; } 100% { background-position: 100% 100%; } }
  .starfield-js { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; }
  .starfield-js .star { position: absolute; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px currentColor; animation: starTrack linear infinite; }
  @keyframes starTrack { 0% { transform: translate(0, 0); opacity: var(--op, 0.9); } 50% { opacity: var(--op-mid, 0.6); } 100% { transform: translate(var(--tx, 80px), var(--ty, -60px)); opacity: var(--op, 0.9); } }
  .nebula { position: fixed; border-radius: 50%; filter: blur(100px); opacity: 0.2; z-index: 0; }
  .nebula-1 { width: 600px; height: 600px; background: radial-gradient(circle, #a855f7 0%, transparent 70%); top: -200px; right: -200px; }
  .nebula-2 { width: 500px; height: 500px; background: radial-gradient(circle, #22d3ee 0%, transparent 70%); bottom: -150px; left: -150px; }
  .error-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #050816; color: #e0e7ff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; text-align: center; padding: 2rem; position: relative; overflow: hidden; }
  .error-content { position: relative; z-index: 1; }
  .error-title { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem; }
  .error-number { font-size: 8rem; font-weight: 700; background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1; text-shadow: 0 0 50px rgba(168,85,247,0.5); }
  .error-text { font-size: 2.5rem; font-weight: 600; background: linear-gradient(135deg, #67e8f9 0%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .error-message { font-size: 1.25rem; margin-bottom: 3rem; color: #a5b4fc; max-width: 500px; }
  .return-button { display: inline-block; padding: 1rem 2.5rem; background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%); color: #e0e7ff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 1.0625rem; transition: all 0.3s ease; box-shadow: 0 4px 25px rgba(168,85,247,0.4), 0 0 40px rgba(34,211,238,0.2); }
  .return-button:hover { transform: translateY(-2px); box-shadow: 0 6px 35px rgba(168,85,247,0.5), 0 0 50px rgba(34,211,238,0.3); filter: brightness(1.1); }
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
  const message = d?.error404.message ?? "The page you're looking for doesn't exist in this galaxy.";
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
      <div class="error-content">
        <h1 class="error-title">
          <span class="error-number">404</span>
          <span class="error-text">{title}</span>
        </h1>
        <p class="error-message">{message}</p>
        <a href={homeHref(locale)} class="return-button">
          <span>{returnButton}</span>
        </a>
      </div>
      <style dangerouslySetInnerHTML={{ __html: ERROR_STYLES }} />
    </Layout>
  );
};
