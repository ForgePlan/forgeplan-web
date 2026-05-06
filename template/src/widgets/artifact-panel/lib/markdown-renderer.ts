import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  gfm: true,
  breaks: false,
});

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "strong",
  "em",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "hr",
  "input",
];
const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "class",
  "type",
  "checked",
  "disabled",
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderBody(md: string): string {
  let html: string;
  try {
    html = marked.parse(md, { async: false }) as string;
  } catch {
    // FIXME(marked-failure): fall back to escaped raw text so the panel
    // never throws into the UI.
    return `<pre class="raw-fallback">${escapeHtml(md)}</pre>`;
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
