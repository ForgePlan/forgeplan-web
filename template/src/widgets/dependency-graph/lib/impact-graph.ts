import type { GraphEdge } from "@/entities/graph";
import { HIERARCHY_RELATIONS, normaliseHierarchyEdge } from "./type-tier";

export const MAX_IMPACT_DEPTH = 8;

/**
 * Forward BFS from rootId through normalised parent→child hierarchy
 * edges. Returns id → depth (0 = root). Bounded by MAX_IMPACT_DEPTH.
 *
 * "Downstream" means: things that depend on the root. If the root
 * is a PRD, downstream contains RFCs that refine it, EVIDs that
 * inform it, etc. — the cascade you'd disturb if the PRD is changed.
 */
export function computeDownstream(
  rootId: string,
  edges: GraphEdge[],
): Map<string, number> {
  return bfs(rootId, edges, "down");
}

/**
 * Backward BFS — returns ancestors (things the root depends on).
 */
export function computeUpstream(
  rootId: string,
  edges: GraphEdge[],
): Map<string, number> {
  return bfs(rootId, edges, "up");
}

function bfs(
  rootId: string,
  edges: GraphEdge[],
  dir: "down" | "up",
): Map<string, number> {
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    if (!HIERARCHY_RELATIONS.has(e.relation)) continue;
    const norm = normaliseHierarchyEdge(e.from, e.to, e.relation);
    if (!norm) continue;
    const key = dir === "down" ? norm.parent : norm.child;
    const val = dir === "down" ? norm.child : norm.parent;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(val);
  }

  const out = new Map<string, number>();
  out.set(rootId, 0);
  let frontier: string[] = [rootId];
  let depth = 1;
  while (frontier.length > 0 && depth <= MAX_IMPACT_DEPTH) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of childrenOf.get(id) ?? []) {
        if (out.has(child)) continue;
        out.set(child, depth);
        next.push(child);
      }
    }
    frontier = next;
    depth += 1;
  }
  return out;
}
