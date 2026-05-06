import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";
import {
  HIERARCHY_RELATIONS,
  compactTierMap,
  normaliseHierarchyEdge,
  typeTier,
} from "./type-tier";

/**
 * Map from artifact id to its column index (0 = most abstract /
 * leftmost). Column = compact-tier position of the kind: tiers absent
 * from the workspace collapse inward, so a workspace with only PRD,
 * RFC, EVID gets {prd: 0, rfc: 1, evidence: 2}.
 */
export type ColumnMap = Record<string, number>;

export function assignSankeyColumns(
  nodes: ArtifactSummary[],
  _edges: GraphEdge[],
): ColumnMap {
  const tiers = compactTierMap(nodes.map((n) => n.kind));
  const out: ColumnMap = {};
  for (const n of nodes) {
    out[n.id] = tiers.get(String(n.kind).toLowerCase()) ?? typeTier(n.kind);
  }
  return out;
}

/**
 * d3-sankey-shaped payload. Each node carries `column` (its tier-
 * position) and the original kind. Each link is normalised via
 * `normaliseHierarchyEdge` so source.column < target.column always
 * holds — the diagram flows left → right from abstract to concrete.
 */
export interface SankeyPayloadNode {
  id: string;
  name: string;
  column: number;
  kind: string;
  status: string;
  title: string;
}

export interface SankeyPayloadLink {
  source: string;
  target: string;
  value: number;
  relation: string;
}

export function buildSankeyPayload(
  nodes: ArtifactSummary[],
  edges: GraphEdge[],
): { nodes: SankeyPayloadNode[]; links: SankeyPayloadLink[] } {
  const columns = assignSankeyColumns(nodes, edges);
  const ids = new Set(nodes.map((n) => n.id));
  const sankeyNodes: SankeyPayloadNode[] = nodes.map((n) => ({
    id: n.id,
    name: n.id,
    column: columns[n.id] ?? 0,
    kind: n.kind,
    status: n.status,
    title: n.title,
  }));
  const sankeyLinks: SankeyPayloadLink[] = [];
  for (const e of edges) {
    if (!HIERARCHY_RELATIONS.has(e.relation)) continue;
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    const norm = normaliseHierarchyEdge(e.from, e.to, e.relation);
    if (!norm) continue;
    const sourceCol = columns[norm.parent] ?? 0;
    const targetCol = columns[norm.child] ?? 0;
    // Drop intra-tier edges (e.g. supersedes between two ADRs) and
    // any edge that would flow right-to-left after normalisation —
    // d3-sankey rejects them anyway and they confuse the diagram.
    if (sourceCol >= targetCol) continue;
    sankeyLinks.push({
      source: norm.parent,
      target: norm.child,
      value: 1,
      relation: e.relation,
    });
  }
  return { nodes: sankeyNodes, links: sankeyLinks };
}
