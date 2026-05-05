import {
  hierarchy,
  partition,
  type HierarchyRectangularNode,
} from "d3-hierarchy";
import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";
import {
  HIERARCHY_RELATIONS,
  compactTierMap,
  normaliseHierarchyEdge,
} from "./type-tier";

export interface SunburstNode {
  id: string;
  kind: string;
  status: string;
  title: string;
  tier: number;
  children?: SunburstNode[];
}

/**
 * Build a hierarchy tree where each artifact attaches to its semantic
 * parent (most-abstract neighbour by type tier). The tree depth equals
 * the artifact's compact-tier index, so the resulting sunburst's
 * concentric rings line up with the type taxonomy:
 *
 *   ring 1 = most abstract type present (e.g. epic / prd)
 *   ring 2 = next tier
 *   ...
 *   outer ring = leaves (evidence / orphan kinds)
 *
 * For each artifact we look at all incoming hierarchy edges, normalise
 * each via `normaliseHierarchyEdge` (so source ↦ parent, target ↦
 * child in the abstract→concrete sense), then pick the parent whose
 * tier is one less than ours (so the child sits exactly one ring
 * outside its parent). If no such parent exists, the artifact attaches
 * to the synthetic root and ends up on its own tier ring.
 */
export function buildSunburstTree(
  nodes: ArtifactSummary[],
  edges: GraphEdge[],
): SunburstNode {
  const ids = new Set(nodes.map((n) => n.id));
  const meta = new Map(nodes.map((n) => [n.id, n] as const));
  const tiers = compactTierMap(nodes.map((n) => n.kind));
  const tierOf = (id: string): number => {
    const m = meta.get(id);
    return tiers.get(String(m?.kind ?? "").toLowerCase()) ?? tiers.size;
  };

  // For each child id, collect candidate parents (after normalisation).
  const parentCandidates = new Map<string, string[]>();
  for (const id of ids) parentCandidates.set(id, []);
  for (const e of edges) {
    if (!HIERARCHY_RELATIONS.has(e.relation)) continue;
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    const norm = normaliseHierarchyEdge(e.from, e.to, e.relation);
    if (!norm) continue;
    if (norm.parent === norm.child) continue;
    parentCandidates.get(norm.child)!.push(norm.parent);
  }

  // For each child pick the parent whose tier is closest from below
  // (highest tier value strictly less than the child's tier). If
  // multiple candidates share that tier, pick the lexicographically
  // smallest id for determinism. Children whose tier-0 status leaves
  // no valid parent stay attached to the synthetic root.
  const parentOf = new Map<string, string>();
  for (const id of ids) {
    const childTier = tierOf(id);
    const cands = (parentCandidates.get(id) ?? [])
      .filter((p) => tierOf(p) < childTier)
      .sort((a, b) => {
        const ta = tierOf(a);
        const tb = tierOf(b);
        if (ta !== tb) return tb - ta; // higher (closer) first
        return a.localeCompare(b);
      });
    if (cands.length > 0) parentOf.set(id, cands[0]!);
  }

  // Children index.
  const childrenOf = new Map<string, string[]>();
  for (const id of ids) childrenOf.set(id, []);
  for (const [child, parent] of parentOf) {
    childrenOf.get(parent)!.push(child);
  }

  const visited = new Set<string>();
  function buildSubtree(id: string): SunburstNode {
    visited.add(id);
    const m = meta.get(id);
    const node: SunburstNode = {
      id,
      kind: m?.kind ?? "note",
      status: m?.status ?? "active",
      title: m?.title ?? "",
      tier: tierOf(id),
    };
    const kids = (childrenOf.get(id) ?? [])
      .filter((k) => !visited.has(k))
      .sort((a, b) => a.localeCompare(b));
    if (kids.length > 0) node.children = kids.map((k) => buildSubtree(k));
    return node;
  }

  const roots: SunburstNode[] = [];
  // Sort roots by tier (most abstract first), then by id.
  const sortedRootIds = Array.from(ids)
    .filter((id) => !parentOf.has(id))
    .sort((a, b) => {
      const ta = tierOf(a);
      const tb = tierOf(b);
      if (ta !== tb) return ta - tb;
      return a.localeCompare(b);
    });
  for (const id of sortedRootIds) {
    if (!visited.has(id)) roots.push(buildSubtree(id));
  }
  // Cycle survivors.
  for (const id of ids) {
    if (!visited.has(id)) roots.push(buildSubtree(id));
  }

  return {
    id: "__workspace__",
    kind: "workspace",
    status: "active",
    title: "Workspace",
    tier: -1,
    children: roots,
  };
}

/**
 * Run d3-hierarchy.partition on the tree to produce angular layout.
 * Sectors are sorted by id within each parent so visit order is
 * stable across renders.
 */
export function computeSunburstPartition(
  tree: SunburstNode,
  radius: number,
): HierarchyRectangularNode<SunburstNode> {
  const root = hierarchy<SunburstNode>(tree)
    .sum((d) => (d.children && d.children.length > 0 ? 0 : 1))
    .sort((a, b) => a.data.id.localeCompare(b.data.id));
  return partition<SunburstNode>().size([2 * Math.PI, radius])(root);
}
