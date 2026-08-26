import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { renderToString } from "hono/jsx/dom/server";
import { loadDictionary, type Locale } from "../lib/i18n.ts";
import {
  type AlternateUrls,
  Layout,
  localeSwitcherHref,
  TOKIMI_OFFICIAL_EMAIL,
  TOKIMI_OFFICIAL_SITE,
} from "./layout.tsx";

function alternateUrls(returnUrl: string): AlternateUrls {
  const detailParams = new URLSearchParams({
    type: "paper",
    id: "2401.00001",
    returnUrl,
  });

  return {
    en: `https://astrogroot.example/detail?${detailParams.toString()}`,
    "zh-TW": `https://astrogroot.example/detail?${detailParams.toString()}&lang=zh-TW`,
    "zh-CN": `https://astrogroot.example/detail?${detailParams.toString()}&lang=zh-CN`,
  };
}

Deno.test("locale switcher localizes a nested detail return URL", () => {
  const urls = alternateUrls("/search?q=black+holes&type=papers&lang=en&page=2");
  const switchedUrl = new URL(localeSwitcherHref(urls, "zh-TW"));
  const returnUrl = new URL(
    switchedUrl.searchParams.get("returnUrl") ?? "",
    switchedUrl.origin,
  );

  assertEquals(switchedUrl.searchParams.get("lang"), "zh-TW");
  assertEquals(returnUrl.pathname, "/search");
  assertEquals(returnUrl.searchParams.get("q"), "black holes");
  assertEquals(returnUrl.searchParams.get("type"), "papers");
  assertEquals(returnUrl.searchParams.get("page"), "2");
  assertEquals(returnUrl.searchParams.get("lang"), "zh-TW");
});

Deno.test("locale switcher keeps English explicit for Chinese-language browsers", () => {
  const urls = alternateUrls("/search?q=%E9%BB%91%E6%B4%9E&lang=zh-CN&sortBy=date");
  const switchedUrl = new URL(localeSwitcherHref(urls, "en"));
  const returnUrl = new URL(
    switchedUrl.searchParams.get("returnUrl") ?? "",
    switchedUrl.origin,
  );

  assertEquals(switchedUrl.searchParams.get("lang"), "en");
  assertEquals(returnUrl.searchParams.get("q"), "黑洞");
  assertEquals(returnUrl.searchParams.get("sortBy"), "date");
  assertEquals(returnUrl.searchParams.get("lang"), "en");
});

Deno.test("locale switcher adds an explicit language to non-search URLs", () => {
  const urls = alternateUrls("https://example.com/elsewhere?lang=en");
  const switchedUrl = new URL(localeSwitcherHref(urls, "zh-CN"));

  assertEquals(switchedUrl.searchParams.get("lang"), "zh-CN");
});

Deno.test("layout renders the localized fraud warning with exact official contacts", async () => {
  const expectedMessages: Record<Locale, string> = {
    en:
      "Any @gmail.com address claiming to represent Tokimi is not an official Tokimi contact channel.",
    "zh-TW": "任何以 @gmail.com 結尾、並自稱 Tokimi 的帳號，都不是 Tokimi 官方聯絡管道。",
    "zh-CN": "任何以 @gmail.com 结尾、并自称 Tokimi 的帐号，都不是 Tokimi 官方联络渠道。",
  };

  for (const locale of Object.keys(expectedMessages) as Locale[]) {
    const dict = await loadDictionary(locale);
    const html = renderToString(
      Layout({
        pageClass: "test-page",
        locale,
        dict,
        pageTitle: "Test",
        pageDescription: "Test page",
        canonicalUrl: "https://astrogroot.org/",
        alternateUrls: {
          en: "https://astrogroot.org/?lang=en",
          "zh-TW": "https://astrogroot.org/?lang=zh-TW",
          "zh-CN": "https://astrogroot.org/?lang=zh-CN",
        },
        showHeader: false,
        showNav: false,
        showFooter: false,
        children: "Test content",
      }),
    );

    assertStringIncludes(html, 'class="identity-notice"');
    assertStringIncludes(html, 'role="note"');
    assertStringIncludes(html, expectedMessages[locale]);
    assertStringIncludes(html, `href="${TOKIMI_OFFICIAL_SITE}"`);
    assertStringIncludes(html, `href="mailto:${TOKIMI_OFFICIAL_EMAIL}"`);
  }
});

Deno.test("standalone user pages include the same official verification links", async () => {
  for (const path of ["../static/knowledge-map.html", "../static/rocket-exam.html"]) {
    const html = await Deno.readTextFile(new URL(path, import.meta.url));
    assertStringIncludes(html, 'class="identity-notice"');
    assertStringIncludes(html, 'role="note"');
    assertStringIncludes(html, "@gmail.com");
    assertStringIncludes(html, "Do not pay or share verification codes.");
    assertStringIncludes(html, `href="${TOKIMI_OFFICIAL_SITE}"`);
    assertStringIncludes(html, `href="mailto:${TOKIMI_OFFICIAL_EMAIL}"`);
  }
});
