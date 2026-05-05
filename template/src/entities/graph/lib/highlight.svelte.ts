export type HighlightEdge = { from: string; to: string };

export const highlight = $state<{ hoveredId: string | null }>({
  hoveredId: null,
});

export function setHovered(id: string | null): void {
  highlight.hoveredId = id;
}

export function clearHovered(): void {
  highlight.hoveredId = null;
}

export function edgeClass(
  from: string,
  to: string,
  hovered: string | null,
): string {
  if (hovered === null) return "";
  if (hovered === from || hovered === to) return "edge-active";
  return "edge-dim";
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
): string {
  if (hovered === null) return "";
  if (id === hovered) return "node-active";
  const d = distances.get(id);
  if (d === undefined) return "node-outside";
  if (d === 1) return "node-near";
  if (d === 2) return "node-mid";
  return "node-far";
}
