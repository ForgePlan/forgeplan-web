import {
  hierarchy,
  partition,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";

const HIERARCHY_RELATIONS: ReadonlySet<string> = new Set([
  "informs",
  "refines",
  "belongs-to",
  "contains",
  "supersedes",
]);

export interface SunburstNode {
  id: string;
  kind: string;
  status: string;
  title: string;
  children?: SunburstNode[];
}

/**
 * Build a hierarchy tree rooted at a synthetic "Workspace" node, with
 * each artifact attached to its FIRST hierarchy parent (deterministic
 * BFS choice). Cycles are broken by the visited set. Disconnected
 * artifacts attach directly to the synthetic root.
 *
 * The tree shape suits d3-hierarchy.partition for a sunburst diagram:
 * inner ring = root; subsequent rings = children at increasing depth.
 */
export function buildSunburstTree(
  nodes: ArtifactSummary[],
  edges: GraphEdge[],
): SunburstNode {
  const ids = new Set(nodes.map((n) => n.id));
  const parentOf = new Map<string, string>();
  // Pick the first hierarchy edge that lands on `to` as its parent.
  for (const e of edges) {
    if (!HIERARCHY_RELATIONS.has(e.relation)) continue;
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    if (parentOf.has(e.to)) continue;
    parentOf.set(e.to, e.from);
  }
  // Build children index.
  const childrenOf = new Map<string, string[]>();
  for (const id of ids) childrenOf.set(id, []);
  for (const [child, parent] of parentOf) {
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(child);
  }
  const meta = new Map(nodes.map((n) => [n.id, n] as const));

  const visited = new Set<string>();
  function buildSubtree(id: string): SunburstNode {
    visited.add(id);
    const m = meta.get(id);
    const node: SunburstNode = {
      id,
      kind: m?.kind ?? "note",
      status: m?.status ?? "active",
      title: m?.title ?? "",
    };
    const kids = (childrenOf.get(id) ?? []).filter((k) => !visited.has(k));
    if (kids.length > 0) {
      node.children = kids.map((k) => buildSubtree(k));
    }
    return node;
  }

  const roots: SunburstNode[] = [];
  for (const id of ids) {
    if (!parentOf.has(id) && !visited.has(id)) {
      roots.push(buildSubtree(id));
    }
  }
  // Pick up cycle survivors (visited via subtree but not as roots).
  for (const id of ids) {
    if (!visited.has(id)) roots.push(buildSubtree(id));
  }
  return {
    id: "__workspace__",
    kind: "workspace",
    status: "active",
    title: "Workspace",
    children: roots,
  };
}

/**
 * Run d3-hierarchy.partition on the tree to get rectangular layout
 * coordinates (x0, x1 in [0, 2π], y0, y1 in [0, radius]).
 */
export function computeSunburstPartition(
  tree: SunburstNode,
  radius: number,
): HierarchyRectangularNode<SunburstNode> {
  const root = hierarchy<SunburstNode>(tree)
    .sum(() => 1)
    .sort((a, b) => {
      const av = a.value ?? 0;
      const bv = b.value ?? 0;
      return bv - av;
    });
  return partition<SunburstNode>().size([2 * Math.PI, radius])(root);
}
