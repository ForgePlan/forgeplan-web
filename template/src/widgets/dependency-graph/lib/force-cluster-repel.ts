import type { Force, SimulationNodeDatum } from "d3-force";

export interface ForceClusterRepelOptions<NodeT> {
  strength?: number;
  minDistance?: number;
  getClusterId: (node: NodeT) => string | undefined;
}

export interface ForceClusterRepel<NodeT extends SimulationNodeDatum>
  extends Force<NodeT, undefined> {
  strength(): number;
  strength(value: number): this;
  minDistance(): number;
  minDistance(value: number): this;
}

const DEFAULT_STRENGTH = 800;
const DEFAULT_MIN_DISTANCE = 250;
// TODO(epsilon): kept tiny to avoid masking the inverse-square law at
// d ≈ 0; sufficient because two nodes ending exactly co-located is
// extremely rare in d3 simulations (phyllotaxis init + collide force).
const EPSILON = 1e-4;

export function forceClusterRepel<NodeT extends SimulationNodeDatum>(
  options: ForceClusterRepelOptions<NodeT>,
): ForceClusterRepel<NodeT> {
  let strength = options.strength ?? DEFAULT_STRENGTH;
  let minDistance = options.minDistance ?? DEFAULT_MIN_DISTANCE;
  const getClusterId = options.getClusterId;

  let cachedNodes: NodeT[] = [];
  let clusterIds: (string | undefined)[] = [];

  function recomputeClusterIds(): void {
    clusterIds = cachedNodes.map((n) => getClusterId(n));
  }

  // O(N²) pair iteration. Acceptable per PRD-005 SC-6 (target ≤ 270 nodes,
  // settle < 5 s). d3-quadtree would give O(N log N) but ships without TS
  // types in this repo and adding @types/d3-quadtree expands devDeps; the
  // strict-mode rule forbids `any` casts. Naive loop stays type-clean.
  const force = ((alpha: number): void => {
    const nodes = cachedNodes;
    const n = nodes.length;
    if (n < 2) return;

    const minDistSq = minDistance * minDistance;

    for (let i = 0; i < n; i++) {
      const a = nodes[i]!;
      const ax = a.x ?? 0;
      const ay = a.y ?? 0;
      const aCluster = clusterIds[i];

      for (let j = i + 1; j < n; j++) {
        const bCluster = clusterIds[j];
        if (
          aCluster !== undefined &&
          bCluster !== undefined &&
          aCluster === bCluster
        ) {
          continue;
        }

        const b = nodes[j]!;
        const bx = b.x ?? 0;
        const by = b.y ?? 0;

        let dx = ax - bx;
        let dy = ay - by;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDistSq) continue;

        const dist = Math.sqrt(distSq);
        if (dist < EPSILON) {
          // FIXME(coincident): tiny deterministic jitter so two co-located
          // nodes from different clusters separate; sign derived from
          // index parity to stay reproducible across ticks.
          dx = (i % 2 === 0 ? 1 : -1) * EPSILON;
          dy = (j % 2 === 0 ? 1 : -1) * EPSILON;
        }

        const safeDistSq = distSq + EPSILON;
        const magnitude = (strength * alpha) / safeDistSq;
        const invDist = 1 / Math.max(dist, EPSILON);
        const fx = dx * invDist * magnitude;
        const fy = dy * invDist * magnitude;

        a.vx = (a.vx ?? 0) + fx;
        a.vy = (a.vy ?? 0) + fy;
        b.vx = (b.vx ?? 0) - fx;
        b.vy = (b.vy ?? 0) - fy;
      }
    }
  }) as ForceClusterRepel<NodeT>;

  force.initialize = (nodes: NodeT[]): void => {
    cachedNodes = nodes;
    recomputeClusterIds();
  };

  function strengthFn(): number;
  function strengthFn(value: number): ForceClusterRepel<NodeT>;
  function strengthFn(value?: number): number | ForceClusterRepel<NodeT> {
    if (value === undefined) return strength;
    strength = value;
    return force;
  }

  function minDistanceFn(): number;
  function minDistanceFn(value: number): ForceClusterRepel<NodeT>;
  function minDistanceFn(value?: number): number | ForceClusterRepel<NodeT> {
    if (value === undefined) return minDistance;
    minDistance = value;
    return force;
  }

  force.strength = strengthFn;
  force.minDistance = minDistanceFn;

  return force;
}
