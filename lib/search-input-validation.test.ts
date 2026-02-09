import { Converter } from "https://esm.sh/opencc-js";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const s2t = Converter({ from: "cn", to: "tw" });
const t2s = Converter({ from: "tw", to: "cn" });

function hasLatin(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

function hasCjk(value: string): boolean {
  return /[\u3400-\u9FFF]/.test(value);
}

function isTraditional(value: string): boolean {
  return s2t(value) === value;
}

function isSimplified(value: string): boolean {
  return t2s(value) === value;
}

function isInvalidForLocale(value: string, locale: "en" | "zh-TW" | "zh-CN"): boolean {
  const text = value.trim();
  if (!text) return false;
  const latin = hasLatin(text);
  const cjk = hasCjk(text);
  if (locale === "en") return !latin || cjk;
  if (locale === "zh-TW") return latin || !cjk || !isTraditional(text);
  if (locale === "zh-CN") return latin || !cjk || !isSimplified(text);
  return false;
}

Deno.test("search input validation: English locale", () => {
  assertEquals(isInvalidForLocale("black holes", "en"), false);
  assertEquals(isInvalidForLocale("Mars rover", "en"), false);
  assertEquals(isInvalidForLocale("黑洞", "en"), true);
  assertEquals(isInvalidForLocale("Mars 火星", "en"), true);
  assertEquals(isInvalidForLocale(" ", "en"), false);
});

Deno.test("search input validation: Traditional Chinese locale", () => {
  assertEquals(isInvalidForLocale("繁體中文", "zh-TW"), false);
  assertEquals(isInvalidForLocale("黑洞", "zh-TW"), false);
  assertEquals(isInvalidForLocale("简体中文", "zh-TW"), true);
  assertEquals(isInvalidForLocale("robot", "zh-TW"), true);
  assertEquals(isInvalidForLocale("中文", "zh-TW"), false);
});

Deno.test("search input validation: Simplified Chinese locale", () => {
  assertEquals(isInvalidForLocale("简体中文", "zh-CN"), false);
  assertEquals(isInvalidForLocale("黑洞", "zh-CN"), false);
  assertEquals(isInvalidForLocale("繁體中文", "zh-CN"), true);
  assertEquals(isInvalidForLocale("robot", "zh-CN"), true);
  assertEquals(isInvalidForLocale("中文", "zh-CN"), false);
});
