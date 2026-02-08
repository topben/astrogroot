import { Marked } from "marked";

const marked = new Marked({
  breaks: true,
  gfm: true,
});

/** Convert markdown text to HTML. Returns sanitized HTML string. */
export function renderMarkdown(text: string): string {
  if (!text) return "";
  const html = marked.parse(text);
  if (typeof html !== "string") return text;
  return html;
}
