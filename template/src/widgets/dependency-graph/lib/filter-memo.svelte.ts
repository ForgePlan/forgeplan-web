import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";

// The 10s polling layer hands fresh array references for `nodes` / `edges`
// every tick even when payload is unchanged; reducing inputs to a content
// signature lets us skip the filter pass and downstream layout work when
// nothing actually changed.
export function nodesContentSignature(
  nodes: ArtifactSummary[],
  kindFilter: Set<string>,
  statusFilter: Set<string>,
): string {
  return (
    nodes.map((n) => `${n.id}:${n.kind}:${n.status}`).join("|") +
    "||" +
    Array.from(kindFilter).sort().join(",") +
    "||" +
    Array.from(statusFilter).sort().join(",")
  );
}

export function edgesContentSignature(
  edges: GraphEdge[],
  filteredIds: Set<string>,
): string {
  return (
    edges.map((e) => `${e.from}>${e.to}:${e.relation}`).join("|") +
    "||" +
    Array.from(filteredIds).sort().join(",")
  );
}
