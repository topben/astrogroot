export const SEARCH_VALIDATION_SCRIPT = `
(function() {
  var extractHan = function(text) { return (text.match(/\\p{Script=Han}/gu) || []).join(""); };
  var hasLatinLetter = function(text) { return /\\p{Script=Latin}/u.test(text); };
  var hasLetter = function(text) { return /\\p{Letter}/u.test(text); };
  var isInvalidForLocale = function(value, locale) {
    var text = String(value || "").trim();
    if (!text) return false;
    var han = extractHan(text);
    var hasHan = han.length > 0;
    if (locale === "en") {
      if (hasHan) return true;
      if (hasLetter(text) && !hasLatinLetter(text)) return true;
      return false;
    }
    if (!hasHan) return true;
    if (locale === "zh-TW") return window.__astroS2T ? window.__astroS2T(han) !== han : false;
    if (locale === "zh-CN") return window.__astroT2S ? window.__astroT2S(han) !== han : false;
    return false;
  };
  window.__astroSearchValidation = { isInvalidForLocale: isInvalidForLocale };
  import("https://esm.sh/opencc-js").then(function(mod) {
    window.__astroS2T = mod.Converter({ from: "cn", to: "tw" });
    window.__astroT2S = mod.Converter({ from: "tw", to: "cn" });
  }).catch(function(err) {
    console.warn("OpenCC load failed; CJK script validation disabled", err);
  });
})();
`;
