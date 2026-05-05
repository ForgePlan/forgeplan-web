---
created: 2026-05-05
depth: standard
id: RFC-004
kind: rfc
status: active
title: Geometry-first hierarchy clustering layout (PRD-005)
updated: 2026-05-05
---

# RFC-004: Geometry-first hierarchy clustering layout

## Summary

RadialView places artifact cards on concentric orbit rings around a
cluster centroid. Multiple clusters are arranged so the largest is at
the canvas centre with smaller clusters orbiting it. Ring radii and
inter-cluster centroid distances are computed from rigorous geometry
(chord, regular-polygon trigonometry, sum-of-radii non-overlap), so
non-overlap is provable rather than empirical — no sweep, no jitter
hacks, no scale heuristics.

ForceView extends a d3-force simulation with cluster-aware forces; it
remains physics-driven and benefits from the same `detectClusters` /
`computeOrbitRing` / `computeRingRadius` lib but is not bound to the
exact-on-orbit invariant that RadialView relies on.

## Motivation

Earlier iterations of F4 used arc-based radius approximation and a
post-layout pairwise sweep. Both produced visible defects:

- arc length `N·s/(2π)` understates the radius needed for N nodes when
  N is small — chord-based geometry is the correct rule;
- the sweep pushed cards off the orbit ring, breaking the "card centre
  exactly on orbit" intent the user requested;
- inter-cluster spacing was set on a Cartesian grid, which produced
  visibly uneven outer-ring gaps when cluster sizes differed by 3×.

Pinning the geometry in this RFC means future tweaks have a single,
falsifiable spec to compare against.

## Geometric constants

```ts
NODE_W_NOMINAL    = 110          // typical card width incl. label
NODE_H_NOMINAL    = 20           // card height
SAFE_GAP          = 16           // breathing room
CARD_DIAG         = √(110² + 20²) ≈ 111.8
MIN_CHORD         = CARD_DIAG + SAFE_GAP ≈ 127.8
RING_GAP          = max(W, H) + SAFE_GAP = 126
INTER_CLUSTER_GAP = RING_GAP * 1.5 = 189
BASE_RADIUS       = 90
MAX_RINGS         = 8
```

Two cards on the **same ring** with N evenly-spaced members occupy
chord `c = 2r·sin(π/N)`. For non-overlap of bounding circles:

```
2r·sin(π/N) ≥ MIN_CHORD     ⇒     r ≥ MIN_CHORD / (2·sin(π/N))
```

Two cards on **adjacent rings** at the same angular position have
horizontal/vertical bbox edges separated by `Δr`. Worst case is a
horizontal angle (0 or π) where the cards are width-aligned and
overlap whenever `Δr < W`. Hence:

```
RING_GAP ≥ max(W, H) + SAFE_GAP
```

Two cluster **centroids** must keep their outer rings apart:

```
dist(C_i, C_j) ≥ R_i + R_j + INTER_CLUSTER_GAP
```

## Cluster detection (input)

`TYPE_ORDER` picks the cluster root — the most senior type present.
Hierarchy edges (`informs`, `refines`, `belongs-to`, `contains`,
`supersedes`) form an undirected graph; each non-root member follows
its first ancestor centroid.

## Orbit assignment (compact, type-driven)

`computeOrbitRing` builds the cluster's `presentTypes`, sorts them by
`TYPE_ORDER` seniority, and maps each member's type to its position
in that sorted list. So a cluster with PRD/RFC/EVID has rings 0/1/2;
a cluster lacking RFC has rings 0/1 (no empty ring). Capped at
`MAX_RINGS - 1`.

This is intentionally NOT BFS edge-depth: type-rank produces a stable
visual hierarchy that matches the artifact taxonomy the user thinks
in. BFS edge-depth (used in earlier drafts) drifted with graph
density and produced inconsistent rings.

## Angular placement (parent-anchored)

`computeAnchoredAngles` distributes nodes around a cluster:

- Ring 1 spreads evenly on [0, 2π).
- Each ring N≥2 member: preferred angle = circular mean of its
  inner-ring connected neighbours. Circular mean = `atan2(Σ sin θ_k, Σ cos θ_k)` —
  the correct way to average angles (Fisher 1995, _Statistical
  Analysis of Circular Data_); the naïve arithmetic mean breaks at the
  0/2π wrap.
- Anchored members are sorted by preferred angle and placed greedily
  with min separation `2π/N` so they never collide.
- Orphans (no parent on the inner ring) fill the largest free angular
  gap.

## Adaptive ring radius

`computeRingRadius` returns a function `radius(ring)` enforcing both
geometric rules above:

```ts
function radius(ring) {
  const N = nodesPerRing(ring);
  const prev = radius(ring - 1) ?? 0;
  let minByChord;
  if (N === 0)      minByChord = 0;
  else if (N === 1) minByChord = MIN_CHORD / 2;
  else              minByChord = MIN_CHORD / (2·sin(π/N));
  const minByGap = prev + RING_GAP;
  return max(BASE_RADIUS, minByGap, minByChord);
}
```

Because both constraints flow into one `max`, the renderer can place
each card at exactly `(cx + cos θ · r, cy + sin θ · r)` and be
provably non-overlapping. No sweep is needed.

## Cluster placement (radial around the largest)

For K clusters:

- **K = 1**: centroid = canvas centre.
- **K = 2**: line through canvas centre; centroid distance =
  `R_0 + R_1 + INTER_CLUSTER_GAP`.
- **K ≥ 3**: largest cluster (by `actualMaxR`) occupies the centre.
  The remaining `M = K - 1` sit on a regular polygon at angular step
  `2π/M`, starting at `-π/2` (north). Polygon radius `outerRadius`:

  ```
  outerRadius = max(
    max_k (R_centre + INTER_CLUSTER_GAP + R_k),                  // radial spec
    (R_a + R_b + INTER_CLUSTER_GAP) / (2·sin(π/M))               // chord spec
                       where R_a, R_b = two largest among others
  )
  ```

  The radial term keeps every outer ring at the same edge-gap from the
  centre cluster's outer ring; the chord term keeps adjacent outer
  clusters apart on the polygon. Both terms are necessary because
  satisfying one does not imply the other for arbitrary M and `R_*`.

## Force stack (ForceView)

ForceView is physics-driven and does not enforce the exact-on-orbit
invariant. It uses the same lib (`detectClusters`, `computeOrbitRing`,
`computeRingRadius`) for SOFT pulls:

```ts
simulation
  .force("link", forceLink(links).distance(80).strength(0.4))
  .force("charge", forceManyBody().strength(-150))
  .force("center", forceCenter(width / 2, height / 2))
  .force("clusterX", forceX(clusterCentroidX).strength(0.25))
  .force("clusterY", forceY(clusterCentroidY).strength(0.25))
  .force("orbital", forceRadial(clusterRingRadius, ...).strength(0.15))
  .force("clusterRepel", forceClusterRepel({ strength: 800, minDistance: 250 }))
  .force("collide", forceCollide(node => max(w, h)/2 + 6).iterations(2));
```

Initial node positions are seeded at each node's cluster centroid with
±10 px jitter so `forceCollide` always has a non-zero gradient at t=0.
`prefers-reduced-motion` pre-ticks 80 then `simulation.stop()`.

## Visual

Orbit rings: `stroke-opacity: 0.16`, `stroke-width: 1`,
`stroke-dasharray: 3 5`. Visible to the viewer without competing with
relation edges (which run at 0.32–0.45 opacity).

## Proposed Direction

Adopt the geometry-first layout end-to-end:

1. `lib/cluster.svelte.ts` exports the constants (`MIN_CHORD`,
   `RING_GAP`, `INTER_CLUSTER_GAP`), `computeRingRadius` (chord +
   radial-gap), `computeOrbitRing` (compact type-rank mapping), and
   `computeAnchoredAngles` (circular-mean parent anchor).
2. `detectClusters` places centroids using the radial-around-largest
   pattern with the combined radial+chord `outerRadius` bound.
3. `RadialView.svelte` consumes the lib and places each card at
   `(cx + cos θ·r, cy + sin θ·r)` — no sweep, no clamp, no scale.
4. `ForceView.svelte` keeps its physics simulation but reuses the
   same lib for soft pulls (`forceX/Y`, `forceRadial`, custom
   `forceClusterRepel`).
5. EVID-012 captures DOM-verified acceptance against the formula.

This direction is preferred over the earlier sweep+arc draft because
it makes non-overlap a property of the placement, not a property of
the post-processing — falsifiable in unit tests, not just visual
review.

## Implementation Phases

1. **F4-a (lib)** — chord-based `computeRingRadius`,
   `computeAnchoredAngles`, `computeOrbitRing` (compact type-rank).
2. **F4-b (RadialView)** — wire lib, drop sweep / clamp / scale.
3. **F4-c (cluster placement)** — radial-around-largest, combined
   radial+chord `outerRadius` bound.
4. **F4-d (ForceView)** — soft cluster pulls, `forceClusterRepel`,
   reduced-motion pre-tick.
5. **F4-e (style)** — visible orbit rings (opacity 0.16, dash 3 5).
6. **F4-f (evidence)** — DOM-verified acceptance against the formula
   (EVID-012).

## Options Considered

| Option                        | Description                                                    | Verdict                                                                          |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Arc-based radius `N·s / (2π)` | Approximate ring circumference                                 | Rejected — under-estimates r for small N, allows overlap                         |
| Sweep-based anti-collision    | Pairwise push after layout                                     | Rejected — pushes cards off orbit; user wants exact-on-ring                      |
| Per-cluster radius scale      | Shrink rings to fit between centroids                          | Rejected — scaled rings violate chord/gap constraints                            |
| BFS edge-depth orbits         | Ring index = BFS distance from root                            | Rejected — unstable across graph density                                         |
| **Geometry-first chord+gap**  | This RFC: chord rule + radial-gap rule + radial-around-largest | **Chosen** — non-overlap provable, exact-on-orbit, uniform inter-cluster spacing |

## Invariants

- Card centre `(cx + cos θ·r, cy + sin θ·r)` lies exactly on the orbit ring
  it is assigned to.
- Two cards on the same ring never have overlapping bounding boxes.
- Two cards on adjacent rings at the same angle never have overlapping bounding boxes.
- Two cluster outer rings have edge-gap ≥ `INTER_CLUSTER_GAP - ε` (centroid-distance
  may exceed the spec when `outerRadius` is bumped by the chord constraint).
- No new runtime npm deps.
- `prefers-reduced-motion` honoured in ForceView.

## Rollback Plan

If the geometry-first layout regresses:

1. Revert the `lib/cluster.svelte.ts` and `RadialView.svelte` commits
   on `feature/graph-clustering-f4` (each independently revertable).
2. RadialView returns to the earlier sweep-based layout from the
   first half of F4. ForceView is unaffected.

## Risks

- **R-1 — densely-populated centre cluster overflows the viewport.** When
  the centre cluster has many EVID members on its outermost ring, its
  natural radius exceeds half the viewport. Mitigation: `fitToView`
  zooms out to fit; the user can pan. Not a layout bug.
- **R-2 — over-determined K(N) inter-cluster spacing.** For K ≥ 4 you
  cannot keep ALL pairwise edge-gaps equal on a 2D plane. We relax to
  centre-to-outer uniformity; outer-to-outer gaps vary with M but stay
  bounded by the chord rule.
- **R-3 — type-rank ring assignment loses signal when most members
  share one type.** Then the cluster collapses to a single ring with
  high N, ring radius grows large. Acceptable; the typology
  imbalance is a property of the workspace, not a layout defect.

