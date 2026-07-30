import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type AlternateUrls, localeSwitcherHref } from "./layout.tsx";

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

Deno.test("locale switcher removes the nested language parameter for English", () => {
  const urls = alternateUrls("/search?q=%E9%BB%91%E6%B4%9E&lang=zh-CN&sortBy=date");
  const switchedUrl = new URL(localeSwitcherHref(urls, "en"));
  const returnUrl = new URL(
    switchedUrl.searchParams.get("returnUrl") ?? "",
    switchedUrl.origin,
  );

  assertEquals(switchedUrl.searchParams.get("lang"), null);
  assertEquals(returnUrl.searchParams.get("q"), "黑洞");
  assertEquals(returnUrl.searchParams.get("sortBy"), "date");
  assertEquals(returnUrl.searchParams.get("lang"), null);
});

Deno.test("locale switcher leaves non-search return URLs unchanged", () => {
  const urls = alternateUrls("https://example.com/elsewhere?lang=en");

  assertEquals(localeSwitcherHref(urls, "zh-CN"), urls["zh-CN"]);
});
