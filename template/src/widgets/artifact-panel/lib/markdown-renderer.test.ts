// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderBody } from "./markdown-renderer";

describe("renderBody — markdown to sanitised HTML", () => {
  it("renders basic markdown", () => {
    const html = renderBody("# Hello\n\nWorld");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
    expect(html).toContain("<p");
    expect(html).toContain("World");
  });

  it("strips <script> tags (XSS)", () => {
    const html = renderBody("Test <script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("strips javascript: hrefs", () => {
    const html = renderBody("[click](javascript:alert(1))");
    expect(html).not.toMatch(/href="javascript:/);
  });

  it("preserves GFM tables", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const html = renderBody(md);
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
  });

  it("renders task-list checkboxes", () => {
    const md = "- [ ] todo\n- [x] done";
    const html = renderBody(md);
    expect(html).toMatch(/<input[^>]*type="checkbox"/);
  });

  it("falls back gracefully on empty input", () => {
    expect(renderBody("")).toBe("");
  });

  it("forces rel=noopener noreferrer on target=_blank anchors (CWE-1022)", () => {
    // Markdown doesn't emit target="_blank" by default; the hook protects
    // against raw HTML reaching the sanitiser with target attribute.
    const html = renderBody('<a href="https://evil" target="_blank">link</a>');
    expect(html).toContain('target="_blank"');
    expect(html).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(html).toMatch(/rel="[^"]*noreferrer[^"]*"/);
  });
});
