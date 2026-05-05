---
created: 2026-05-05
depth: standard
id: RFC-004
kind: rfc
status: draft
title: "Force parameter design for hierarchy clustering (PRD-005)"
updated: 2026-05-05
---

# RFC-004: Force parameter design for hierarchy clustering

## Summary

Hierarchy clustering in `ForceView` requires a stack of d3-force forces
on top of the existing `forceManyBody` + `forceLink` + `forceCenter`.
This RFC pins the set of forces, their strengths, and their tuning
constants so future tweaks have a baseline to compare against.

## Motivation

Without a fixed parameter design, every iteration on cluster behaviour
turns into a feedback loop of "looks too tight" / "spreads too much" /
"oscillates" — wasting cycles. Pinning the parameters here gives the
implementation a target and the user a concrete thing to push back on.

## Type hierarchy (input)

`TYPE_ORDER` is used **only** to pick the cluster root (the most senior
type present in the dataset). It is NOT a per-type ring radius lookup —
that turned out to be the wrong abstraction (each project has different
mix and density per type, and per-type rings let dense rings overlap).

```ts
const TYPE_ORDER = [
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
```

## Orbits = hierarchy depth, radius = adaptive

Within each cluster, orbits are computed by **BFS from the root**, not
type. Members of the same hierarchy depth share an orbit. This means:

- Root sits at the centroid (depth 0).
- Direct children (any type) → ring 1.
- Grand-children → ring 2.
- And so on, until everything reachable is placed.
- Unreachable nodes → outermost ring (fallback bucket).

Ring radius is computed **per ring** so its circumference is wide enough
to fit all members of that depth without overlap. Given `N` nodes of
average node-card width `W` plus gap `g`, minimum spacing along the
circle is `s = W + g`, so:

```
R(n) = max(R(n-1) + R_GAP, N(n) · s / (2π))
```

Where `R_GAP` is the minimum gap between concentric rings (≥ tallest
node-card height) so two adjacent rings don't visually merge.

Constants:

| Constant           | Value  | Rationale                                                                                                                        |
| ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `MIN_NODE_SPACING` | 140 px | average node-card width (~120px) + 20px gap; ensures center-to-center spacing exceeds card width so adjacent cards never overlap |
| `RING_GAP`         | 64 px  | ≥ tallest node card height + small breathing                                                                                     |
| `BASE_RADIUS`      | 90 px  | starting radius for ring 1 (when N small)                                                                                        |
| `MAX_RINGS`        | 8      | beyond this, dump remaining nodes onto outermost ring                                                                            |

## Force stack (in application order)

```ts
simulation
  // 1. Centripetal pull toward cluster centroid (XY)
  .force("clusterX", forceX((d) => clusterCentroidX(d)).strength(0.25))
  .force("clusterY", forceY((d) => clusterCentroidY(d)).strength(0.25))

  // 2. Hierarchy-depth orbital radius around centroid (forceRadial)
  //    Each node's preferred radius = ringRadius[d.depth] for its cluster,
  //    where ringRadius is computed once per cluster via the adaptive formula
  //    R(n) = max(R(n-1) + RING_GAP, N(n) · MIN_NODE_SPACING / (2π)).
  .force(
    "orbital",
    forceRadial((d) => clusterRingRadius(d), ...centroid).strength(0.15),
  )

  // 3. Inter-cluster repel — keeps cluster centroids apart
  //    Custom force: pushes any two centroids apart with strength inversely proportional to distance squared.
  .force("clusterRepel", forceClusterRepel({ strength: 800, minDistance: 250 }))

  // 4. Anti-collision — no two node bboxes overlap
  .force(
    "collide",
    forceCollide((d) => Math.max(d.w, d.h) / 2 + 6).iterations(2),
  )

  // 5. Existing: link force, charge, center
  .force(
    "link",
    forceLink(links)
      .id((d) => d.id)
      .distance(80)
      .strength(0.4),
  )
  .force("charge", forceManyBody().strength(-150)) // weaker than current to avoid blowing clusters apart
  .force("center", forceCenter(width / 2, height / 2));
```

## Tuning constants

| Constant                 | Value                           | Rationale                                                           |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------- |
| Cluster gravity strength | 0.25                            | Strong enough to group, soft enough so collide can resolve overlaps |
| Orbital strength         | 0.15                            | Soft pull — lets links + collide override when needed               |
| Inter-cluster repel      | strength: 800, minDistance: 250 | Centroids stay >250px apart on 1600×900 canvas                      |
| Collide padding          | 6 px                            | Visual breathing room between cards                                 |
| Collide iterations       | 2                               | d3 default; perf budget vs accuracy                                 |
| Charge                   | -150                            | Weaker than default -300 to keep clusters cohesive                  |
| Link distance            | 80                              | Same as current                                                     |
| Alpha decay              | 0.025                           | Settle in ~60 ticks (~1s @ 60fps)                                   |

## Implementation phases

1. `lib/cluster.svelte.ts` — `detectClusters` returning centroid layout (grid-positioned)
2. `lib/force-cluster-repel.ts` — custom d3 force for inter-cluster repel
3. `ForceView.svelte` — wire new forces into existing simulation
4. `RadialView.svelte` — angular-step + ring-overflow fix (independent of cluster lib)

## Options Considered

| Option                               | Description                                                | Verdict                                       |
| ------------------------------------ | ---------------------------------------------------------- | --------------------------------------------- |
| A — hardcoded constants in ForceView | All forces inline                                          | Rejected — every tweak edits a 450-LOC file   |
| **B — RFC + lib helpers**            | Constants in `lib/cluster.svelte.ts`; ForceView reads them | **Chosen** — testable, single source of truth |
| C — `d3-force-cluster` npm package   | Add runtime dep                                            | Rejected — different semantics, adds dep      |

## Proposed Direction

Option B. Pin force parameters in `lib/cluster.svelte.ts`. ForceView
imports constants + `detectClusters` helper. Custom `forceClusterRepel`
in its own `lib/force-cluster-repel.ts`. Keeps ForceView's render path
readable and the parameter design auditable in one place.

## Invariants

- Node `<rect>` bboxes never overlap after simulation settles.
- Cluster centroids stay within canvas bounds.
- No new runtime npm deps (d3-force already a dep; nothing new).
- `prefers-reduced-motion` honoured — pre-tick instead of animating.

## Rollback Plan

If clustering causes regressions (oscillation, perf <30 fps, user
rejects):

1. Revert FR-003..FR-007 commits (each independently revertable).
2. ForceView returns to uniform `forceManyBody + forceLink + forceCenter`.
3. RadialView fix (FR-001) stands alone — independent of cluster lib.

## Centroid placement

Cluster centroids placed on a grid: ⌈√N⌉ × ⌈√N⌉ for N clusters, with
spacing `min(width, height) / (gridSize + 1)`. Single cluster → canvas
center.

## Reduced-motion compat

When `prefers-reduced-motion: reduce` matches, skip simulation
animation: pre-tick 80 times before first paint, then `simulation.stop()`.
Existing `motionDuration` helper from PRD-003 covers `.transition` calls.

## Alternative considered

- **Hierarchy from edges only** — detect roots as nodes with no incoming
  `refines`/`belongs-to`/`informs` edges. Rejected: too sensitive to
  graph noise; type-priority is more predictable for a 0.x npm package.
- **Cluster collapse to single node** when zoomed out — defer; needs UX
  for «click to expand cluster».
- **Run cluster pass once + freeze** — defer; live filter/search wants
  re-clustering on data change.

## Risks

Inherited from PRD-005 R-1..R-5. RFC pins parameters so R-1
(oscillation) becomes empirically falsifiable: if oscillation observed
at the values above, escalate decay or shrink strengths in 0.05 steps.
