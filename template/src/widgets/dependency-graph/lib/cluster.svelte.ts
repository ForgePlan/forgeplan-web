import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";

// Type seniority — picks which artifact becomes a cluster root, NOT a
// per-type ring radius. Ring radii are computed adaptively per-cluster
// (see computeOrbitRing + computeRingRadius below). See RFC-004.
export const TYPE_ORDER = [
  "epic",
  "prd",
  "spec",
  "rfc",
  "adr",
  "evidence",
  "note",
  "problem",
  "solution",
] as const;

// Constants per RFC-004 §"Orbits = hierarchy depth, radius = adaptive".
export const MIN_NODE_SPACING = 140;
export const RING_GAP = 64;
export const BASE_RADIUS = 90;
export const MAX_RINGS = 8;

const HIERARCHY_RELATIONS: ReadonlySet<string> = new Set([
  "informs",
  "refines",
  "belongs-to",
  "contains",
  "supersedes",
]);

export interface ClusterInfo {
  id: string;
  centroid: { x: number; y: number };
  members: string[];
}

export interface ClusterDetectionResult {
  clusters: ClusterInfo[];
  /** node id → cluster id (root id) */
  nodeToCluster: Record<string, string>;
}

/** Per-node ring (orbit index) within its cluster. Ring 0 = root. */
export type RingDepthMap = Record<string, number>;

interface Viewport {
  width: number;
  height: number;
}

function gridCentroid(
  index: number,
  total: number,
  viewport: Viewport,
  minSpacing = 0,
): { x: number; y: number } {
  if (total <= 1) {
    return { x: viewport.width / 2, y: viewport.height / 2 };
  }
  const gridSize = Math.ceil(Math.sqrt(total));
  const baseSpacing =
    Math.min(viewport.width, viewport.height) / (gridSize + 1);
  const spacing = Math.max(baseSpacing, minSpacing);
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  const offsetX = (viewport.width - spacing * (gridSize - 1)) / 2;
  const offsetY = (viewport.height - spacing * (gridSize - 1)) / 2;
  return {
    x: offsetX + col * spacing,
    y: offsetY + row * spacing,
  };
}

function findTopType(nodes: ArtifactSummary[]): string | null {
  const present = new Set(nodes.map((n) => String(n.kind).toLowerCase()));
  return TYPE_ORDER.find((t) => present.has(t)) ?? null;
}

function buildHierarchyAdjacency(
  edges: GraphEdge[],
  knownIds: ReadonlySet<string>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const id of knownIds) adj.set(id, []);
  for (const e of edges) {
    if (!HIERARCHY_RELATIONS.has(e.relation)) continue;
    if (!adj.has(e.from) || !adj.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    // FIXME(directionality): treat hierarchy edges as undirected for
    // root-walk because relation direction varies (Evidence informs PRD
    // vs PRD refines RFC). Tighten when forgeplan settles a convention.
    adj.get(e.to)!.push(e.from);
  }
  return adj;
}

/**
 * BFS from rootId through the hierarchy adjacency, restricted to
 * `memberIds`. Returns edge-distance from root for each reachable
 * member. Unreachable members are NOT included; caller falls back to
 * type-rank.
 */
function bfsEdgeDepth(
  rootId: string,
  memberIds: ReadonlySet<string>,
  adjacency: Map<string, string[]>,
): Map<string, number> {
  const depth = new Map<string, number>();
  depth.set(rootId, 0);
  let frontier: string[] = [rootId];
  let dist = 1;
  while (frontier.length > 0 && dist <= MAX_RINGS) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nbr of adjacency.get(id) ?? []) {
        if (depth.has(nbr) || !memberIds.has(nbr)) continue;
        depth.set(nbr, dist);
        next.push(nbr);
      }
    }
    frontier = next;
    dist += 1;
  }
  return depth;
}

/**
 * For a single cluster, compute each member's ring index using
 * `min(typeRank, edgeDepth)`. Type rank is the index in TYPE_ORDER
 * (0 = epic, 1 = prd, ...). Edge depth is BFS distance from the cluster
 * root through hierarchy edges. Connected members are pulled inwards;
 * orphans fall back to their type rank. Capped at MAX_RINGS - 1.
 */
export function computeOrbitRing(
  rootId: string,
  members: ArtifactSummary[],
  adjacency: Map<string, string[]>,
): RingDepthMap {
  const memberIds = new Set(members.map((m) => m.id));
  const edgeDepth = bfsEdgeDepth(rootId, memberIds, adjacency);
  const out: RingDepthMap = {};
  for (const m of members) {
    const tr = TYPE_ORDER.indexOf(
      String(m.kind).toLowerCase() as (typeof TYPE_ORDER)[number],
    );
    const typeRank = tr === -1 ? MAX_RINGS - 1 : tr;
    const ed = edgeDepth.get(m.id);
    const edgeRank = ed === undefined ? Number.POSITIVE_INFINITY : ed;
    out[m.id] = Math.min(MAX_RINGS - 1, Math.min(typeRank, edgeRank));
  }
  out[rootId] = 0;
  return out;
}

/**
 * Adaptive ring radius. Returns a function `radius(ring)` whose values
 * grow monotonically: each successive ring is at least RING_GAP wider
 * than the previous, AND wide enough to fit `nodesPerRing(ring)` evenly
 * spaced by MIN_NODE_SPACING along the circumference. Result is cached
 * per ring.
 */
export function computeRingRadius(
  nodesPerRing: (ring: number) => number,
): (ring: number) => number {
  const cache = new Map<number, number>();
  cache.set(0, 0);
  return (ring: number) => {
    if (cache.has(ring)) return cache.get(ring)!;
    const N = Math.max(0, nodesPerRing(ring));
    const prev = cache.get(ring - 1) ?? 0;
    const minByCircumference =
      N === 0 ? 0 : (N * MIN_NODE_SPACING) / (2 * Math.PI);
    const minByGap = prev + RING_GAP;
    const r = Math.max(BASE_RADIUS, minByGap, minByCircumference);
    cache.set(ring, r);
    return r;
  };
}

/**
 * Build a map ringIndex → count for a given ring assignment. Helper for
 * `computeRingRadius` callers who need to know N per ring.
 */
export function ringCounts(rings: RingDepthMap): Map<number, number> {
  const counts = new Map<number, number>();
  for (const ring of Object.values(rings)) {
    counts.set(ring, (counts.get(ring) ?? 0) + 1);
  }
  return counts;
}

export function detectClusters(
  nodes: ArtifactSummary[],
  edges: GraphEdge[],
  viewport: Viewport,
): ClusterDetectionResult {
  if (nodes.length === 0) {
    return { clusters: [], nodeToCluster: {} };
  }

  const kindById = new Map<string, string>();
  for (const node of nodes) {
    kindById.set(node.id, String(node.kind).toLowerCase());
  }

  const topType = findTopType(nodes);

  if (topType === null) {
    const members = nodes.map((n) => n.id);
    const cluster: ClusterInfo = {
      id: "__single__",
      centroid: { x: viewport.width / 2, y: viewport.height / 2 },
      members,
    };
    const nodeToCluster: Record<string, string> = {};
    for (const id of members) nodeToCluster[id] = cluster.id;
    return { clusters: [cluster], nodeToCluster };
  }

  const centroidIds: string[] = [];
  for (const node of nodes) {
    if (kindById.get(node.id) === topType) centroidIds.push(node.id);
  }

  const knownIds = new Set(nodes.map((n) => n.id));
  const adjacency = buildHierarchyAdjacency(edges, knownIds);

  // Pass 1: assign members to centroids without committing centroid
  // positions yet — we need the largest cluster's member count to pick a
  // safe grid spacing in pass 2.
  const memberIdsByCluster = new Map<string, string[]>();
  for (const id of centroidIds) memberIdsByCluster.set(id, [id]);

  const centroidSet = new Set(centroidIds);
  const nodeToCluster: Record<string, string> = {};
  for (const id of centroidIds) nodeToCluster[id] = id;

  function findAncestorCentroid(startId: string): string | null {
    const visited = new Set<string>([startId]);
    const queue: string[] = [startId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        if (centroidSet.has(next)) return next;
        queue.push(next);
      }
    }
    return null;
  }

  for (const node of nodes) {
    if (centroidSet.has(node.id)) continue;
    const ancestor = findAncestorCentroid(node.id);
    const target = ancestor ?? centroidIds[0]!;
    nodeToCluster[node.id] = target;
    memberIdsByCluster.get(target)!.push(node.id);
  }

  // FR-005: compute the ACTUAL outermost-ring radius per cluster (using
  // the same orbit + ring-radius pipeline that the renderer will use),
  // pick the largest as `globalMaxR`, then derive the ideal
  // centroid-to-centroid spacing as `2 * globalMaxR + RING_GAP`. Cap by
  // half the smaller viewport dimension so a √K × √K grid still fits;
  // when capped, the post-layout sweep handles residual overlap.
  const memberMetaById = new Map<string, ArtifactSummary>();
  for (const node of nodes) memberMetaById.set(node.id, node);

  const actualMaxByCluster = new Map<string, number>();
  let globalMaxR = BASE_RADIUS;
  for (const [rootId, ids] of memberIdsByCluster) {
    const memberSummaries = ids
      .map((id) => memberMetaById.get(id))
      .filter((m): m is ArtifactSummary => m !== undefined);
    const orbits = computeOrbitRing(rootId, memberSummaries, adjacency);
    const counts = ringCounts(orbits);
    const radius = computeRingRadius((r) => counts.get(r) ?? 0);
    let actualMaxR = 0;
    for (const r of counts.keys()) {
      const v = radius(r);
      if (v > actualMaxR) actualMaxR = v;
    }
    if (actualMaxR === 0) actualMaxR = BASE_RADIUS;
    actualMaxByCluster.set(rootId, actualMaxR);
    if (actualMaxR > globalMaxR) globalMaxR = actualMaxR;
  }

  const idealSpacing = 2 * globalMaxR + RING_GAP;
  const cap = Math.min(viewport.width, viewport.height) / 2;
  const gridSpacing = Math.min(idealSpacing, cap);

  const clusterById = new Map<string, ClusterInfo>();
  centroidIds.forEach((id, index) => {
    clusterById.set(id, {
      id,
      centroid:
        centroidIds.length === 1
          ? { x: viewport.width / 2, y: viewport.height / 2 }
          : gridCentroid(index, centroidIds.length, viewport, gridSpacing),
      members: memberIdsByCluster.get(id)!,
    });
  });

  return {
    clusters: centroidIds.map((id) => clusterById.get(id)!),
    nodeToCluster,
  };
}
