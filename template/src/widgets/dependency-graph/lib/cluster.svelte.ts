import type { ArtifactSummary } from "@/entities/artifact";
import type { GraphEdge } from "@/entities/graph";
import { getOrInit } from "./map-utils";

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

// Geometry-driven constants. Card is roughly NODE_W × NODE_H (85 × 20
// for a typical "EVID-001" label; some longer ids reach ~110×20). The
// bounding-circle diameter D = √(W² + H²) ≈ 87 for 85×20. Pad with
// SAFE_GAP for breathing.
//
// Ring radius rules (rigorous):
//  1. Two nodes on the SAME ring at angular separation Δθ have chord
//     c = 2r·sin(Δθ/2). For no bbox overlap with N evenly-spaced nodes:
//        2r·sin(π/N) ≥ D + SAFE_GAP    →    r ≥ (D + SAFE_GAP) / (2·sin(π/N))
//     This is CHORD-based and is what the renderer actually needs.
//     The previous N·MIN_NODE_SPACING/(2π) was ARC-based and underestimates.
//  2. Two nodes on ADJACENT rings at the same angle have radial gap
//     |r₂ − r₁|. Worst case (angle = 0 or π) the cards are aligned
//     horizontally and overlap when |r₂ − r₁| < W + SAFE_GAP.
//     So RING_GAP must be at least max(W, H) + SAFE_GAP.
export const NODE_W_NOMINAL = 110;
export const NODE_H_NOMINAL = 20;
export const SAFE_GAP = 16;
export const CARD_DIAG = Math.sqrt(
  NODE_W_NOMINAL * NODE_W_NOMINAL + NODE_H_NOMINAL * NODE_H_NOMINAL,
);
export const MIN_CHORD = CARD_DIAG + SAFE_GAP;
export const RING_GAP = Math.max(NODE_W_NOMINAL, NODE_H_NOMINAL) + SAFE_GAP;
// Inter-cluster gap is the visible space between two clusters' OUTER
// rings (edge-to-edge), independent of each cluster's maxR. Held
// constant by the centroid sweep so clusters look uniformly spaced.
export const INTER_CLUSTER_GAP = RING_GAP * 1.5;
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
  /** Multiplier on per-ring radii. <1 when the cluster's natural outer
   * ring would exceed the viewport slot; sweep then resolves residual
   * card overlap. 1 when no scaling needed. */
  radiusScale: number;
  /** Per-member ring assignment (root → ring 0). Computed once in
   * detectClusters and reused by both RadialView and ForceView so the
   * orbit pipeline isn't re-run per render. */
  orbits: RingDepthMap;
  /** Per-ring radius (already multiplied by radiusScale), indexed by
   * ring number. Sparse array — entry undefined for rings absent in
   * this cluster. */
  radii: number[];
}

export interface ClusterDetectionResult {
  clusters: ClusterInfo[];
  /** node id → cluster id (root id) */
  nodeToCluster: Record<string, string>;
  /** Per-node hierarchy adjacency built from the input edges. Reused
   * by callers that need anchored angular layout (RadialView). */
  nodeAdjacency: Map<string, string[]>;
}

/** Per-node ring (orbit index) within its cluster. Ring 0 = root. */
export type RingDepthMap = Record<string, number>;

interface Viewport {
  width: number;
  height: number;
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
    getOrInit(adj, e.from, () => []).push(e.to);
    // FIXME(directionality): treat hierarchy edges as undirected for
    // root-walk because relation direction varies (Evidence informs PRD
    // vs PRD refines RFC). Tighten when forgeplan settles a convention.
    getOrInit(adj, e.to, () => []).push(e.from);
  }
  return adj;
}

/**
 * For a single cluster, compute each member's ring index by COMPACT
 * type rank: take all distinct types present in the cluster, sort them
 * by TYPE_ORDER seniority, then the ring index of a member is the
 * position of its type in that sorted list. So if a cluster has PRD,
 * RFC, EVID — PRD→0, RFC→1, EVID→2. If a cluster lacks some type, the
 * remaining types collapse inward (no empty ring). Root is always
 * ring 0 even if it shares a type with a sibling.
 */
export function computeOrbitRing(
  rootId: string,
  members: ArtifactSummary[],
): RingDepthMap {
  const presentTypes = new Set<string>();
  for (const m of members) presentTypes.add(String(m.kind).toLowerCase());
  const orderedTypes: string[] = [];
  for (const t of TYPE_ORDER) {
    if (presentTypes.has(t)) orderedTypes.push(t);
  }
  for (const t of presentTypes) {
    if (!orderedTypes.includes(t)) orderedTypes.push(t);
  }
  const typeToRing = new Map<string, number>();
  orderedTypes.forEach((t, i) => typeToRing.set(t, Math.min(i, MAX_RINGS - 1)));

  const out: RingDepthMap = {};
  for (const m of members) {
    const ring = typeToRing.get(String(m.kind).toLowerCase()) ?? MAX_RINGS - 1;
    out[m.id] = ring;
  }
  out[rootId] = 0;
  return out;
}

/**
 * Parent-anchored angular layout. Within a cluster, place each ring's
 * members so that members connected (by hierarchy) to the previous
 * ring are angularly close to their parent. Members on ring 1 spread
 * evenly across [0, 2π). Members on ring N >= 2 are grouped by their
 * parent on ring N-1 (BFS-ancestor through hierarchy edges); each
 * group occupies an angular sector centred on the parent's angle, the
 * sector width proportional to group count. Orphans (no parent on the
 * inner ring) get the largest free angular slot.
 */
export function computeAnchoredAngles(
  rootId: string,
  members: ArtifactSummary[],
  rings: RingDepthMap,
  adjacency: Map<string, string[]>,
): Map<string, number> {
  const angle = new Map<string, number>();
  angle.set(rootId, 0);

  const byRing = new Map<number, string[]>();
  for (const m of members) {
    const r = rings[m.id] ?? 0;
    if (r === 0) continue;
    getOrInit(byRing, r, () => []).push(m.id);
  }
  const ringIndices = Array.from(byRing.keys()).sort((a, b) => a - b);

  for (const r of ringIndices) {
    const ids = byRing.get(r)!;
    if (r === ringIndices[0]) {
      ids.forEach((id, i) => {
        angle.set(id, (2 * Math.PI * i) / ids.length);
      });
      continue;
    }
    // Find each member's preferred angle from its inner-ring neighbours.
    const innerCandidates = (id: string): number[] => {
      const cands: number[] = [];
      for (const nbr of adjacency.get(id) ?? []) {
        const ar = rings[nbr];
        if (ar !== undefined && ar < r && angle.has(nbr)) {
          cands.push(angle.get(nbr)!);
        }
      }
      return cands;
    };
    const preferred = new Map<string, number | null>();
    for (const id of ids) {
      const c = innerCandidates(id);
      if (c.length === 0) preferred.set(id, null);
      else {
        // circular mean
        let sx = 0,
          sy = 0;
        for (const a of c) {
          sx += Math.cos(a);
          sy += Math.sin(a);
        }
        preferred.set(id, Math.atan2(sy, sx));
      }
    }
    const anchored = ids
      .filter((id) => preferred.get(id) !== null)
      .sort((a, b) => preferred.get(a)! - preferred.get(b)!);
    const orphans = ids.filter((id) => preferred.get(id) === null);
    const ordered = [...anchored, ...orphans];
    const N = ordered.length;
    if (N === 0) continue;
    if (anchored.length === 0) {
      ordered.forEach((id, i) => {
        angle.set(id, (2 * Math.PI * i) / N);
      });
      continue;
    }
    // Place anchored ones close to their preferred angle but enforce
    // minimum angular separation 2π/N. Then orphans fill remaining gaps.
    const slot = (2 * Math.PI) / N;
    const anchoredAngles: number[] = [];
    let prev = -Infinity;
    for (const id of anchored) {
      let target = preferred.get(id)!;
      if (target < 0) target += 2 * Math.PI;
      if (target < prev + slot) target = prev + slot;
      anchoredAngles.push(target);
      prev = target;
    }
    // Wrap-around fairness: shift everything so the centroid stays put.
    anchored.forEach((id, i) => {
      const a = anchoredAngles[i];
      if (a !== undefined) angle.set(id, a % (2 * Math.PI));
    });
    if (orphans.length > 0) {
      const used = anchoredAngles
        .map((a) => a % (2 * Math.PI))
        .sort((a, b) => a - b);
      const gaps: { start: number; size: number }[] = [];
      for (let i = 0; i < used.length; i++) {
        const a = used[i]!;
        const b = i + 1 < used.length ? used[i + 1]! : used[0]! + 2 * Math.PI;
        gaps.push({ start: a, size: b - a });
      }
      gaps.sort((a, b) => b.size - a.size);
      orphans.forEach((id, i) => {
        const g = gaps[i % gaps.length];
        if (!g) return;
        const frac = (i + 1) / (orphans.length + 1);
        let a = g.start + g.size * frac;
        a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        angle.set(id, a);
      });
    }
  }
  return angle;
}

/**
 * Adaptive ring radius — chord-based, not arc-based. Returns a function
 * `radius(ring)` whose values grow monotonically and obey two rules:
 *  - same-ring chord ≥ MIN_CHORD: r ≥ MIN_CHORD / (2·sin(π/N)) for N≥2,
 *    and r ≥ MIN_CHORD/2 for N=1 of a non-root ring.
 *  - adjacent-ring radial gap ≥ RING_GAP (handles same-angle overlap
 *    on neighbouring rings).
 * Result is cached per ring.
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
    const minByGap = prev + RING_GAP;
    let minByChord: number;
    if (N <= 0) minByChord = 0;
    else if (N === 1) minByChord = MIN_CHORD / 2;
    else minByChord = MIN_CHORD / (2 * Math.sin(Math.PI / N));
    const r = Math.max(BASE_RADIUS, minByGap, minByChord);
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
    return { clusters: [], nodeToCluster: {}, nodeAdjacency: new Map() };
  }

  const kindById = new Map<string, string>();
  for (const node of nodes) {
    kindById.set(node.id, String(node.kind).toLowerCase());
  }

  const topType = findTopType(nodes);

  if (topType === null) {
    const members = nodes.map((n) => n.id);
    const fallbackOrbits: RingDepthMap = {};
    members.forEach((id, i) => {
      fallbackOrbits[id] = i === 0 ? 0 : 1;
    });
    const fallbackCounts = ringCounts(fallbackOrbits);
    const fallbackRadius = computeRingRadius((r) => fallbackCounts.get(r) ?? 0);
    const fallbackRadii: number[] = [];
    for (const r of fallbackCounts.keys()) {
      fallbackRadii[r] = fallbackRadius(r);
    }
    const cluster: ClusterInfo = {
      id: "__single__",
      centroid: { x: viewport.width / 2, y: viewport.height / 2 },
      members,
      radiusScale: 1,
      orbits: fallbackOrbits,
      radii: fallbackRadii,
    };
    const nodeToCluster: Record<string, string> = {};
    for (const id of members) nodeToCluster[id] = cluster.id;
    return {
      clusters: [cluster],
      nodeToCluster,
      nodeAdjacency: buildHierarchyAdjacency(edges, new Set(members)),
    };
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
    getOrInit(memberIdsByCluster, target, () => []).push(node.id);
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
  const orbitsByCluster = new Map<string, RingDepthMap>();
  const ringCountsByCluster = new Map<string, Map<number, number>>();
  const radiusFnByCluster = new Map<string, (ring: number) => number>();
  let globalMaxR = BASE_RADIUS;
  for (const [rootId, ids] of memberIdsByCluster) {
    const memberSummaries = ids
      .map((id) => memberMetaById.get(id))
      .filter((m): m is ArtifactSummary => m !== undefined);
    const orbits = computeOrbitRing(rootId, memberSummaries);
    const counts = ringCounts(orbits);
    const radius = computeRingRadius((r) => counts.get(r) ?? 0);
    // CRITICAL: iterate in sorted order so the radius cache populates
    // ring 0 → ring 1 → ring 2 → ... Each ring needs `prev` (ring-1)
    // already cached for the radial-gap rule. Map.keys() returns
    // insertion order, which is hash-bucket order from ringCounts and
    // does not match orbit ordering.
    const sortedRings = [...counts.keys()].sort((a, b) => a - b);
    let actualMaxR = 0;
    for (const r of sortedRings) {
      const v = radius(r);
      if (v > actualMaxR) actualMaxR = v;
    }
    if (actualMaxR === 0) actualMaxR = BASE_RADIUS;
    actualMaxByCluster.set(rootId, actualMaxR);
    orbitsByCluster.set(rootId, orbits);
    ringCountsByCluster.set(rootId, counts);
    radiusFnByCluster.set(rootId, radius);
    if (actualMaxR > globalMaxR) globalMaxR = actualMaxR;
  }

  // Place centroids so neighbouring outer rings sit at a uniform
  // edge-gap. K(N) is over-determined (you can't keep ALL pairwise
  // gaps equal for N≥4), so we relax to NEIGHBOUR-pair uniformity:
  //  - Find the largest cluster; place it at canvas centre.
  //  - The biggest cluster's "reach" is R₀ + INTER_CLUSTER_GAP + R_max
  //    where R_max = max remaining maxR.
  //  - Arrange the rest on a circle of radius `outerRadius` around the
  //    centre, evenly spaced in angle. Each circumferential neighbour
  //    pair has the same centroid distance, hence the same edge-gap
  //    (because all outer-ring clusters share the same maxR class
  //    when angles are uniform). When sizes differ, the gap-to-centre
  //    is constant and gap-between-siblings is computed via chord.
  const naturalRArr = centroidIds.map(
    (id) => actualMaxByCluster.get(id) ?? BASE_RADIUS,
  );

  let safePositions: { x: number; y: number }[];
  if (centroidIds.length === 1) {
    safePositions = [{ x: viewport.width / 2, y: viewport.height / 2 }];
  } else if (centroidIds.length === 2) {
    const cx = viewport.width / 2;
    const cy = viewport.height / 2;
    const d = naturalRArr[0]! + naturalRArr[1]! + INTER_CLUSTER_GAP;
    safePositions = [
      { x: cx - d / 2, y: cy },
      { x: cx + d / 2, y: cy },
    ];
  } else {
    // Pick the index of the largest cluster as the centre.
    let centreIdx = 0;
    for (let k = 1; k < naturalRArr.length; k++) {
      if (naturalRArr[k]! > naturalRArr[centreIdx]!) centreIdx = k;
    }
    const others = naturalRArr.map((_, k) => k).filter((k) => k !== centreIdx);
    const M = others.length;
    // Outer-circle radius from centre = max(R_centre + GAP + R_outer)
    // for each outer cluster, so every outer ring is at the same
    // edge-gap from the centre cluster's outer ring.
    let outerRadius = 0;
    for (const k of others) {
      const need =
        naturalRArr[centreIdx]! + INTER_CLUSTER_GAP + naturalRArr[k]!;
      if (need > outerRadius) outerRadius = need;
    }
    // Also enforce circumferential separation: chord between adjacent
    // outer clusters at angular step 2π/M must satisfy
    //   chord = 2·outerRadius·sin(π/M) ≥ R_a + R_b + INTER_CLUSTER_GAP
    // Use the worst-case (two largest among `others`) for the bound.
    if (M >= 2) {
      const sortedOthers = others
        .slice()
        .sort((a, b) => naturalRArr[b]! - naturalRArr[a]!);
      const worstPair =
        naturalRArr[sortedOthers[0]!]! +
        naturalRArr[sortedOthers[1]!]! +
        INTER_CLUSTER_GAP;
      const minByChord = worstPair / (2 * Math.sin(Math.PI / M));
      if (minByChord > outerRadius) outerRadius = minByChord;
    }
    const cx = viewport.width / 2;
    const cy = viewport.height / 2;
    safePositions = new Array(centroidIds.length);
    safePositions[centreIdx] = { x: cx, y: cy };
    others.forEach((k, idx) => {
      const a = -Math.PI / 2 + (2 * Math.PI * idx) / M;
      safePositions[k] = {
        x: cx + Math.cos(a) * outerRadius,
        y: cy + Math.sin(a) * outerRadius,
      };
    });
  }

  const clusterById = new Map<string, ClusterInfo>();
  centroidIds.forEach((id, index) => {
    const orbits = orbitsByCluster.get(id) ?? {};
    const counts = ringCountsByCluster.get(id);
    const radiusFn = radiusFnByCluster.get(id);
    const radii: number[] = [];
    if (counts && radiusFn) {
      // Sorted iteration so radiusFn's cache resolves dependencies in
      // order (ring N reads ring N-1 from the cache). Match the
      // actualMaxR pass above.
      const sortedRings = [...counts.keys()].sort((a, b) => a - b);
      for (const r of sortedRings) {
        radii[r] = radiusFn(r);
      }
    }
    clusterById.set(id, {
      id,
      centroid: safePositions[index]!,
      members: memberIdsByCluster.get(id)!,
      radiusScale: 1,
      orbits,
      radii,
    });
  });

  return {
    clusters: centroidIds.map((id) => clusterById.get(id)!),
    nodeToCluster,
    nodeAdjacency: adjacency,
  };
}
