import { marked } from "marked";
import DOMPurify from "dompurify";

export type SafeHtml = string & { readonly __safeHtml: unique symbol };

marked.setOptions({
  gfm: true,
  breaks: false,
});

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer");
  }
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

export function renderBody(md: string): SafeHtml {
  let html: string;
  try {
    // TODO(marked-types): cast valid only while async:false; revisit after marked >= 19 type fix.
    html = marked.parse(md, { async: false }) as string;
  } catch {
    // FIXME(marked-failure): fall back to escaped raw text so the panel
    // never throws into the UI.
    return `<pre class="raw-fallback">${escapeHtml(md)}</pre>` as SafeHtml;
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  }) as SafeHtml;
}
