export const SEARCH_VALIDATION_SCRIPT = `
import { Converter } from "https://esm.sh/opencc-js";
const s2t = Converter({ from: "cn", to: "tw" });
const t2s = Converter({ from: "tw", to: "cn" });
const extractHan = (text) => (text.match(/\\p{Script=Han}/gu) || []).join("");
const hasLatinLetter = (text) => /\\p{Script=Latin}/u.test(text);
const hasLetter = (text) => /\\p{Letter}/u.test(text);
const isInvalidForLocale = (value, locale) => {
  const text = String(value || "").trim();
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
};
if (typeof window !== "undefined" && !window.__astroSearchValidation) {
  window.__astroSearchValidation = { isInvalidForLocale };
}
`;
