import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";

export function filterArtifacts(
  nodes: ArtifactSummary[],
  kindFilter: Set<string>,
  statusFilter: Set<string>,
): ArtifactSummary[] {
  return nodes.filter((n) => {
    const k = n.kind.toLowerCase();
    const s = n.status.toLowerCase();
    if (kindFilter.size > 0 && !kindFilter.has(k)) return false;
    if (statusFilter.size > 0 && !statusFilter.has(s)) return false;
    return true;
  });
}

export function filterEdges(
  edges: GraphEdge[],
  visibleIds: Set<string>,
): GraphEdge[] {
  const out: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) continue;
    const key = `${e.from}>${e.to}:${e.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
