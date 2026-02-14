import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isInvalidForLocale } from "./search-validation.ts";

Deno.test("search input validation: English locale", () => {
  assertEquals(isInvalidForLocale("black holes", "en"), false);
  assertEquals(isInvalidForLocale("Mars rover", "en"), false);
  assertEquals(isInvalidForLocale("2024", "en"), false);
  assertEquals(isInvalidForLocale("Спутник", "en"), true);
  assertEquals(isInvalidForLocale("黑洞", "en"), true);
  assertEquals(isInvalidForLocale("Mars 火星", "en"), true);
  assertEquals(isInvalidForLocale(" ", "en"), false);
});

Deno.test("search input validation: Traditional Chinese locale", () => {
  assertEquals(isInvalidForLocale("繁體中文", "zh-TW"), false);
  assertEquals(isInvalidForLocale("黑洞", "zh-TW"), false);
  assertEquals(isInvalidForLocale("简体中文", "zh-TW"), true);
  assertEquals(isInvalidForLocale("NASA 衛星", "zh-TW"), false);
  assertEquals(isInvalidForLocale("robot", "zh-TW"), false);
  assertEquals(isInvalidForLocale("中文", "zh-TW"), false);
});

Deno.test("search input validation: Simplified Chinese locale", () => {
  assertEquals(isInvalidForLocale("简体中文", "zh-CN"), false);
  assertEquals(isInvalidForLocale("黑洞", "zh-CN"), false);
  assertEquals(isInvalidForLocale("繁體中文", "zh-CN"), true);
  assertEquals(isInvalidForLocale("SpaceX 火箭", "zh-CN"), false);
  assertEquals(isInvalidForLocale("robot", "zh-CN"), false);
  assertEquals(isInvalidForLocale("中文", "zh-CN"), false);
});
