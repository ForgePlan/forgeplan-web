// All colors return as CSS var() so the dual-theme system (PRD-015 /
// RFC-014) applies without re-rendering. Call sites passing the result
// to an SVG presentation attribute MUST use `style:` directives.

export function relationClass(relation: string): string {
  const r = relation?.toLowerCase() ?? "";
  if (r === "informs") return "edge informs";
  if (r === "risks" || r === "risk") return "edge risk";
  return "edge";
}

export function relationFill(relation: string): string {
  const r = relation?.toLowerCase() ?? "";
  if (r === "informs") return "var(--edge-informs)";
  if (r === "risks" || r === "risk") return "var(--accent)";
  return "var(--edge-default)";
}

export function relationStroke(relation: string): string {
  const r = relation?.toLowerCase() ?? "";
  if (r === "informs") return "var(--edge-soft)";
  if (r === "risks" || r === "risk") return "var(--accent)";
  if (r === "refines") return "var(--edge-refines)";
  if (r === "belongs-to" || r === "contains") return "var(--edge-contains)";
  if (r === "supersedes") return "var(--edge-supersedes)";
  return "var(--edge-soft)";
}
