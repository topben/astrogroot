import type { FC } from "hono/jsx";
import { type AlternateUrls, Layout } from "../layout.tsx";
import type { Locale, LocaleDict } from "../../lib/i18n.ts";
import { DEVELOPER_GUIDE, IFF_SERVICES } from "../../lib/developer-guide.ts";

const STYLES = `
  .developer-guide { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem 3rem; }
  .developer-guide a { color: #78e4da; text-underline-offset: .25em; }
  .developer-guide a:hover { color: #fff; }
  .developer-guide a:focus-visible { outline: 2px solid #78e4da; outline-offset: 5px; }
  .developer-guide-header { max-width: 820px; padding: 1rem 0 2.5rem; }
  .developer-guide-eyebrow { color: #9caec3; letter-spacing: .12em; font-size: .75rem; margin: 1.5rem 0 .75rem; }
  .developer-guide h1 { font-size: clamp(2rem, 4vw, 3.1rem); line-height: 1.2; color: #f3f6ff; margin-bottom: 1.25rem; text-wrap: balance; }
  .developer-guide p { color: #bbc8dc; line-height: 1.8; margin: .8rem 0; }
  .developer-guide-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem; }
  .developer-guide-service { border-top: 2px solid #78e4da; padding-top: 1.25rem; min-width: 0; }
  .developer-guide h2 { color: #f3f6ff; font-size: 1.5rem; line-height: 1.4; }
  .developer-guide h3 { color: #f3f6ff; font-size: 1.1rem; margin-top: 1.75rem; }
  .developer-guide-badge { display: block; color: #9caec3; font-size: .8rem; margin-bottom: .8rem; }
  .developer-guide-endpoint { margin: 1.5rem 0; }
  .developer-guide-endpoint dt { color: #9caec3; font-size: .8rem; margin-bottom: .5rem; }
  .developer-guide code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: .85rem; overflow-wrap: anywhere; color: #e2eafa; }
  .developer-guide-endpoint dd { background: #111b2d; padding: .9rem; border-radius: 6px; line-height: 1.7; }
  .developer-guide-links { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; list-style: none; padding: 0; margin: 1rem 0; }
  .developer-guide-links a { display: inline-flex; align-items: center; min-height: 44px; }
  .developer-guide-note { border-left: 2px solid #536480; padding: .1rem 0 .1rem 1.25rem; margin: 2rem 0; }
  .developer-guide-research, .developer-guide-directory { border-top: 1px solid #29364b; margin-top: 2.5rem; padding-top: 2rem; }
  .developer-guide pre { overflow-x: auto; padding: 1.2rem; background: #111b2d; border-radius: 6px; line-height: 1.8; margin: 1rem 0; }
  .developer-guide pre code { white-space: pre-wrap; }
  @media (max-width: 700px) { .developer-guide-grid { grid-template-columns: 1fr; gap: 2rem; } .developer-guide { padding-inline: 1rem; } }
`;

export const DevelopersPage: FC<{
  locale: Locale;
  dict: LocaleDict;
  canonicalUrl: string;
  alternateUrls: AlternateUrls;
}> = ({ locale, dict, canonicalUrl, alternateUrls }) => {
  const t = DEVELOPER_GUIDE[locale];
  const companyTools = locale === "en"
    ? "https://tokimi.space/en/open-source/#agent-tools"
    : "https://tokimi.space/open-source/#agent-tools";
  return (
    <Layout
      pageClass="developers-page"
      headerVariant="search"
      showNav={false}
      locale={locale}
      dict={dict}
      pageTitle={`${t.title} — AstroGroot`}
      pageDescription={t.description}
      canonicalUrl={canonicalUrl}
      alternateUrls={alternateUrls}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <main class="developer-guide" id="main-content">
        <header class="developer-guide-header">
          <a href={`/?lang=${locale}`}>{t.returnHome}</a>
          <p class="developer-guide-eyebrow">ASTROGROOT / IFF / TOKIMI</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          <p>{t.relationship}</p>
        </header>
        <div class="developer-guide-grid">
          {(["monitor", "apostille"] as const).map((key) => {
            const service = IFF_SERVICES[key];
            return (
              <section class="developer-guide-service" aria-labelledby={`service-${key}`}>
                <span class="developer-guide-badge">{t.access}</span>
                <h2 id={`service-${key}`}>{service.name}</h2>
                <p>{t[key]}</p>
                <dl class="developer-guide-endpoint">
                  <dt>{t.endpoint}</dt>
                  <dd>
                    <code>{service.endpoint}</code>
                  </dd>
                </dl>
                <ul class="developer-guide-links">
                  <li>
                    <a href={service.docs}>{t.setup} →</a>
                  </li>
                  <li>
                    <a href={service.api}>{key === "monitor" ? t.apiDocs : t.localTools} →</a>
                  </li>
                  <li>
                    <a href={service.product}>{t.product} →</a>
                  </li>
                </ul>
              </section>
            );
          })}
        </div>
        <aside class="developer-guide-note">
          <p>{t.connect}</p>
          <p>{t.boundary}</p>
        </aside>
        <section class="developer-guide-research" aria-labelledby="research-api">
          <h2 id="research-api">{t.researchTitle}</h2>
          <p>{t.researchDescription}</p>
          <h3>{t.searchLabel}</h3>
          <p>{t.searchDescription}</p>
          <pre><code>GET https://astrogroot.org/api/search?q=robotics&amp;type=papers&amp;limit=5&amp;lang=en</code></pre>
          <h3>{t.mcpLabel}</h3>
          <p>{t.mcpDescription}</p>
          <pre><code>{'POST https://astrogroot.org/api/mcp\nContent-Type: application/json\n\n{"jsonrpc":"2.0","id":1,"method":"tools/list"}'}</code></pre>
          <p>{t.limits}</p>
        </section>
        <section class="developer-guide-directory" aria-labelledby="tokimi-tools">
          <h2 id="tokimi-tools">{t.directory}</h2>
          <p>{t.directoryDescription}</p>
          <ul class="developer-guide-links">
            <li>
              <a href={companyTools}>{t.directory} →</a>
            </li>
            <li>
              <a href="/llms.txt">{t.plainText} →</a>
            </li>
          </ul>
        </section>
      </main>
    </Layout>
  );
};
