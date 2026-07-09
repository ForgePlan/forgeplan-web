import type { DecompForest, DecompInput, DensityVerdict } from "./types";

/**
 * Structural density (SPEC-004 INV-6, frozen): the fraction of authored
 * structural edges. In a forest of N nodes with K roots there are exactly
 * N − K real parent-child edges, so density = (N − roots)/max(1, N − 1) ∈ [0,1].
 * Higher = denser. O(1) from already-materialised fields.
 */
export function densityMetric(
  input: DecompInput,
  forest: DecompForest,
): number {
  const N = input.nodes.length;
  const realEdges = N - forest.roots.length;
  return realEdges / Math.max(1, N - 1);
}

/**
 * Route to idef0 (dense) or tier-stack (honest fallback) mode, deterministic
 * for a given DecompInput. Hard gate: N ≤ 2 ⇒ tier-stack regardless. Only the
 * numeric threshold is RFC-bound (RFC-028: 0.3); the metric + gate are frozen.
 */
export function densityGate(
  input: DecompInput,
  forest: DecompForest,
): DensityVerdict {
  const N = input.nodes.length;
  const threshold = input.threshold;
  if (N === 0) {
    return {
      metric: 0,
      threshold,
      mode: "tier-stack",
      reason: "E-EMPTY: no nodes",
    };
  }
  const metric = densityMetric(input, forest);
  if (N <= 2) {
    return {
      metric,
      threshold,
      mode: "tier-stack",
      reason: `N=${N} below the minimum for an IDEF0 diagram`,
    };
  }
  if (metric >= threshold) {
    return {
      metric,
      threshold,
      mode: "idef0",
      reason: `density ${metric.toFixed(3)} >= threshold ${threshold}`,
    };
  }
  return {
    metric,
    threshold,
    mode: "tier-stack",
    reason: `density ${metric.toFixed(3)} < threshold ${threshold} (real_edges=${
      N - forest.roots.length
    }, N=${N})`,
  };
}
