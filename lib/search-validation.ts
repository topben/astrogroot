import { Converter } from "https://esm.sh/opencc-js";

const s2t = Converter({ from: "cn", to: "tw" });
const t2s = Converter({ from: "tw", to: "cn" });

export function extractHan(text: string): string {
  return (text.match(/\p{Script=Han}/gu) ?? []).join("");
}

function hasLatinLetter(text: string): boolean {
  return /\p{Script=Latin}/u.test(text);
}

function hasLetter(text: string): boolean {
  return /\p{Letter}/u.test(text);
}

export function isInvalidForLocale(
  value: string,
  locale: "en" | "zh-TW" | "zh-CN",
): boolean {
  const text = value.trim();
  if (!text) return false;
  const han = extractHan(text);
  const hasHan = han.length > 0;

  if (locale === "en") {
    if (hasHan) return true;
    if (hasLetter(text) && !hasLatinLetter(text)) return true;
    return false;
  }

  if (!hasHan) return true;
  if (locale === "zh-TW") return s2t(han) !== han;
  if (locale === "zh-CN") return t2s(han) !== han;
  return false;
}
