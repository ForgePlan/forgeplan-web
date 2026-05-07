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

export const MIN_NODE_HEIGHT_PX = 32;
export const MIN_CANVAS_HEIGHT_PX = 760;
export const LABEL_LINE_HEIGHT_PX = 22;

export function adaptiveCanvasHeight(
  nodes: Pick<SankeyPayloadNode, "column">[],
  minHeight: number = MIN_CANVAS_HEIGHT_PX,
  minNodeHeight: number = MIN_NODE_HEIGHT_PX,
  nodePadding: number = 26,
  margin: number = 32,
): number {
  if (nodes.length === 0) return minHeight;
  const counts = new Map<number, number>();
  for (const n of nodes) counts.set(n.column, (counts.get(n.column) ?? 0) + 1);
  let maxCol = 0;
  for (const c of counts.values()) if (c > maxCol) maxCol = c;
  const required = maxCol * minNodeHeight + Math.max(0, maxCol - 1) * nodePadding + 2 * margin;
  return Math.max(minHeight, required);
}

interface LabelDropNode {
  id: string;
  column?: number;
  x0?: number;
  y0?: number;
  y1?: number;
}

export function dropCollidingLabels(
  nodes: LabelDropNode[],
  lineHeight: number = LABEL_LINE_HEIGHT_PX,
): Set<string> {
  const dropped = new Set<string>();
  const byColumn = new Map<number, LabelDropNode[]>();
  for (const n of nodes) {
    const col = n.column ?? Math.round(n.x0 ?? 0);
    const bucket = byColumn.get(col) ?? [];
    bucket.push(n);
    byColumn.set(col, bucket);
  }
  for (const bucket of byColumn.values()) {
    const sorted = bucket
      .filter((n) => n.y0 != null && n.y1 != null)
      .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
    let lastVisibleCenter = -Infinity;
    for (const n of sorted) {
      const center = ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2;
      if (center - lastVisibleCenter < lineHeight) {
        dropped.add(n.id);
      } else {
        lastVisibleCenter = center;
      }
    }
  }
  return dropped;
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
