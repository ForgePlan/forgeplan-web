import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";

/**
 * Assign each node to a column index = its hierarchy depth from any
 * root (a node with no incoming hierarchy edge inside the filtered
 * set). Roots → column 0; their direct children → column 1; etc.
 *
 * Cycles get the smallest depth they were first reached at (BFS).
 * Disconnected nodes (no incoming AND no outgoing hierarchy edges)
 * fall into column 0 alongside the roots.
 */
export type ColumnMap = Record<string, number>;

const HIERARCHY_RELATIONS: ReadonlySet<string> = new Set([
  "informs",
  "refines",
  "belongs-to",
  "contains",
  "supersedes",
]);

export function assignSankeyColumns(
  nodes: ArtifactSummary[],
  edges: GraphEdge[],
): ColumnMap {
  const ids = new Set(nodes.map((n) => n.id));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const id of ids) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }
  for (const e of edges) {
    if (!HIERARCHY_RELATIONS.has(e.relation)) continue;
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    outgoing.get(e.from)!.push(e.to);
    incoming.get(e.to)!.push(e.from);
  }

  const columns: ColumnMap = {};
  // Roots: zero incoming hierarchy edges.
  const queue: string[] = [];
  for (const id of ids) {
    if ((incoming.get(id) ?? []).length === 0) {
      columns[id] = 0;
      queue.push(id);
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curCol = columns[cur] ?? 0;
    for (const child of outgoing.get(cur) ?? []) {
      const next = curCol + 1;
      const existing = columns[child];
      if (existing === undefined || next < existing) {
        columns[child] = next;
        queue.push(child);
      }
    }
  }
  // Any node not reached (cycles entirely disconnected from a root)
  // falls back to column 0.
  for (const id of ids) {
    if (columns[id] === undefined) columns[id] = 0;
  }
  return columns;
}

/**
 * Build {nodes, links} payload for d3-sankey. Each node gets `column`
 * pre-set so d3-sankey honours the assignment without auto-shuffling
 * by topological depth (which gives different results for cycles).
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
    // Skip self-links and reverse-direction (column[from] >= column[to])
    // — d3-sankey rejects them anyway.
    const fromCol = columns[e.from] ?? 0;
    const toCol = columns[e.to] ?? 0;
    if (fromCol >= toCol) continue;
    sankeyLinks.push({
      source: e.from,
      target: e.to,
      value: 1,
      relation: e.relation,
    });
  }
  return { nodes: sankeyNodes, links: sankeyLinks };
}
