export function relationClass(relation: string): string {
  const r = relation?.toLowerCase() ?? "";
  if (r === "informs") return "edge informs";
  if (r === "risks" || r === "risk") return "edge risk";
  return "edge";
}

export function relationFill(relation: string): string {
  const r = relation?.toLowerCase() ?? "";
  if (r === "informs") return "rgba(229, 229, 229, 0.65)";
  if (r === "risks" || r === "risk") return "var(--accent)";
  return "rgba(229, 229, 229, 0.85)";
}

export function relationStroke(relation: string): string {
  const r = relation?.toLowerCase() ?? "";
  if (r === "informs") return "rgba(229, 229, 229, 0.55)";
  if (r === "risks" || r === "risk") return "var(--accent)";
  if (r === "refines") return "rgba(160, 192, 255, 0.65)";
  if (r === "belongs-to" || r === "contains")
    return "rgba(255, 200, 120, 0.65)";
  if (r === "supersedes") return "rgba(255, 160, 200, 0.65)";
  return "rgba(229, 229, 229, 0.55)";
}
