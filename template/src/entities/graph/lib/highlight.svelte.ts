export type HighlightEdge = { from: string; to: string };

export const highlight = $state<{
  hoveredId: string | null;
  impactRoot: string | null;
  impactDirection: "down" | "up";
}>({
  hoveredId: null,
  impactRoot: null,
  impactDirection: "down",
});

export function setHovered(id: string | null): void {
  highlight.hoveredId = id;
}

export function clearHovered(): void {
  highlight.hoveredId = null;
}

export function setImpactRoot(
  id: string | null,
  dir: "down" | "up" = "down",
): void {
  highlight.impactRoot = id;
  highlight.impactDirection = dir;
}

export function impactedClass(
  id: string,
  impacted: Map<string, number> | null,
): string {
  if (!impacted) return "";
  const d = impacted.get(id);
  if (d === undefined) return "";
  if (d === 0) return "node-impact-root";
  if (d <= 2) return "node-impacted-near";
  return "node-impacted-far";
}

export function edgeClass(
  from: string,
  to: string,
  hovered: string | null,
  openedIds?: ReadonlySet<string>,
): string {
  const hasOpened = !!openedIds && openedIds.size > 0;
  if (!hasOpened && hovered === null) return "";
  if (hovered !== null && (hovered === from || hovered === to)) return "edge-active";
  if (hasOpened && (openedIds!.has(from) || openedIds!.has(to))) return "";
  return "edge-dim";
}

export function adjacentToSet(
  ids: ReadonlySet<string>,
  edges: ReadonlyArray<HighlightEdge>,
): Set<string> {
  const out = new Set<string>(ids);
  if (ids.size === 0) return out;
  for (const { from, to } of edges) {
    if (ids.has(from)) out.add(to);
    if (ids.has(to)) out.add(from);
  }
  return out;
}

export function bfsDistances(
  start: string | null,
  edges: ReadonlyArray<HighlightEdge>,
): Map<string, number> {
  const out = new Map<string, number>();
  if (start === null) return out;

  const adj = new Map<string, string[]>();
  for (const { from, to } of edges) {
    if (!adj.has(from)) adj.set(from, []);
    if (!adj.has(to)) adj.set(to, []);
    adj.get(from)!.push(to);
    adj.get(to)!.push(from);
  }

  out.set(start, 0);
  const queue: string[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const d = out.get(cur)!;
    const neighbors = adj.get(cur);
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (!out.has(n)) {
        out.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return out;
}

export function nodeClass(
  id: string,
  hovered: string | null,
  distances: Map<string, number>,
  openedIds?: ReadonlySet<string>,
  visibleIds?: ReadonlySet<string>,
): string {
  if (openedIds?.has(id)) return "node-active";
  if (visibleIds?.has(id)) return "node-near";
  if (hovered === null) return "";
  if (id === hovered) return "node-active";
  const d = distances.get(id);
  if (d === undefined) return "node-outside";
  if (d === 1) return "node-near";
  if (d === 2) return "node-mid";
  return "node-far";
}
