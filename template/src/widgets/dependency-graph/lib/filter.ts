import type { ArtifactSummary } from '@/entities/artifact';
import type { GraphEdge } from '@/entities/graph';

export function filterArtifacts(
  nodes: ArtifactSummary[],
  kindFilter: Set<string>,
  statusFilter: Set<string>
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
  visibleIds: Set<string>
): GraphEdge[] {
  return edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to));
}
