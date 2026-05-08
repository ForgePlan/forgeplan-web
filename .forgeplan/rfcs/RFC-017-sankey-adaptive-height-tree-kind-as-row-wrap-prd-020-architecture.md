---
depth: standard
id: RFC-017
kind: rfc
links:
- target: PRD-020
  relation: refines
status: active
title: Sankey adaptive height + Tree kind-as-row wrap (PRD-020 architecture)
---

---
id: RFC-017
title: "Sankey adaptive height + Tree kind-as-row wrap (PRD-020 architecture)"
status: Draft
author: fedorovvvv
created: 2026-05-08
updated: 2026-05-08
prd: PRD-020
depth: standard
---

# RFC-017: Sankey adaptive height + Tree kind-as-row wrap (PRD-020 architecture)

## Progress

```
Phase 1  ░░░░░░░░░░░░░░░░░░░░░░░░  0/2  (  0%)  Sankey
Phase 2  ░░░░░░░░░░░░░░░░░░░░░░░░  0/2  (  0%)  Tree
─────────────────────────────────────────────────
TOTAL                               0/4  (  0%)
```

---

## Summary

Replace the fixed `VIEW_H = 760` Sankey canvas with a height that grows with the densest column, plus drop colliding labels at idle. Replace the topological-depth Tree layout with a kind-as-row layout (same compact-tier order as Sankey) and wrap each row when its width would exceed 1.5× the viewport.

## Motivation

`SankeyView.svelte` and `TreeView.svelte` both assume the workspace is "small enough". At 123 artifacts (the playground) those assumptions fail visually:

- Sankey packs 26 EVID nodes into a 760-px column (≈2 px / node), then text labels for adjacent nodes overlap each other and the bars themselves. d3-sankey also pushes orphan components below the canvas as scattered sub-clusters with no kind-tier alignment — so the diagram reads as "tier columns + a chaotic puddle".
- Tree topologically layers by `incoming.size === 0`, dumping all root-level artifacts (EPIC + standalone EVID/PROBLEM/SOLUTION) into layer 0. With ~30 nodes in one row `maxRowW` swells to 4000+px and `fitToView` zooms everything down to a 1-px stripe.

If we don't fix this, the two of seven views that are *most* obviously about hierarchy stop working at exactly the workspace size where hierarchy starts to matter.

## Goals

- SC-1: zero label-on-bar / label-on-label overlap in Sankey at 123 artifacts.
- SC-2: Tree fills ≥40% of viewport vertically at 123 artifacts (no 1-stripe collapse).
- SC-3: pan/zoom remains smooth (no perceptible frame drops) at 123 nodes.
- SC-4: zero visual regression on small workspaces (≤30 artifacts).

## Non-Goals

- Bucket-by-status aggregation in Sankey.
- Vertical Tree orientation.
- Reworking Force / Radial / Matrix / Lanes / Sunburst.
- Adding a level-of-detail / virtualisation system.

## Options Considered

### Option A: Adaptive `VIEW_H` + label-collision drop (Sankey) + kind-as-row + intra-row wrap (Tree)

**Sankey**: compute `VIEW_H = max(760, maxColumnNodes * MIN_NODE_HEIGHT_PX)` so every node has at least `MIN_NODE_HEIGHT_PX` (≈14 px) of vertical space. After d3-sankey returns, walk nodes column-by-column and hide labels (`opacity: 0` at idle, full opacity on hover) when their bbox would intersect the previous label's bbox in the same column. fitToView extents widen to `[0.1, 1.5]` so densely-packed Sankey can scale down to fit the viewport.

**Tree**: replace `dfs(incoming)`-based layer assignment with `compactTierMap(kinds)` (the same helper Sankey uses). Layer N corresponds to kind tier N. Within a kind row, if `nodesInRow * (avgNodeW + COL_GAP) > 1.5 * viewportW`, wrap the overflow onto sub-rows of equal width using a `wrapColumns` helper that distributes nodes evenly. Vertical position becomes `MARGIN + tier * (NODE_H + ROW_GAP) + subRow * (NODE_H + SUB_ROW_GAP)`. Edges stay topologically correct because they read `placed.x/y` by id — the wrapping logic only changes coordinates.

- ✅ SC-1 + SC-2 directly addressed.
- ✅ Stays in `dependency-graph/lib`; no new dependencies.
- ✅ Reuses `compactTierMap` already proven in Sankey.
- ⚠ Hidden labels need a hover affordance — covered by existing hover state.

### Option B: Per-kind sub-rows inside a Sankey column

Split each Sankey column visually into `ceil(nodesInColumn / 12)` parallel sub-columns. d3-sankey doesn't support this natively; we'd post-process node positions. Tree gets the same wrap as Option A.

- ✅ Compact visually.
- ✗ d3-sankey computes link paths from node `(x0,x1,y0,y1)` — splitting into sub-columns means link paths bend through dead zones.
- ✗ Adds a "phantom column" per kind — confusing.
- → rejected.

### Option C: Bucket-by-status aggregation (Sankey)

Within each kind, collapse multiple nodes into a single aggregate bar with a count badge; click expands. Tree gets Option A wrap.

- ✅ Best visual compression.
- ✗ Big UX change — a node can suddenly disappear into a bucket; defeats "single source of truth" intuition.
- ✗ Out-of-scope per PRD-020 (Out of Scope).
- → defer to follow-up.

## Proposed Direction

**Option A** — Adaptive `VIEW_H` + label-collision drop (Sankey) + kind-as-row + intra-row wrap (Tree).

Rationale: smallest viable change, no new data shapes, reuses `compactTierMap` already in `lib/type-tier.ts`, edges stay correct, regression risk on small workspaces is contained because `VIEW_H` floor stays 760 and `wrapColumns` is a no-op when row width ≤ viewport.

## Implementation Phases

### Phase 1 — SankeyView (issue #69)

- [ ] **P1.1** — `SankeyView.svelte`: adaptive VIEW_H computation, column-wise label-collision detection, fitToView scale extents widened. File ownership: `template/src/widgets/dependency-graph/ui/SankeyView.svelte`.
- [ ] **P1.2** — extract pure layout helpers (`adaptiveCanvasHeight`, `dropCollidingLabels`) into `lib/sankey-layout.ts` with unit tests. File ownership: `template/src/widgets/dependency-graph/lib/sankey-layout.ts` + `lib/sankey-layout.test.ts`.

### Phase 2 — TreeView (issue #39)

- [ ] **P2.1** — `TreeView.svelte`: layer-by-kind-tier, intra-row wrapping, edge geometry preserved. File ownership: `template/src/widgets/dependency-graph/ui/TreeView.svelte`.
- [ ] **P2.2** — extract pure helpers (`wrapColumns`, `kindTierLayer`) into a new `lib/tree-layout.ts` (or extend existing) with unit tests. File ownership: `template/src/widgets/dependency-graph/lib/tree-layout.ts` + `lib/tree-layout.test.ts`.

## File Ownership

Phase 1 and Phase 2 touch disjoint files: Phase 1 owns `SankeyView.svelte` + `sankey-layout.ts`; Phase 2 owns `TreeView.svelte` + `tree-layout.ts`. Two parallel sub-agents can run safely under `forgeplan_dispatch` + `forgeplan_claim`.

## Risks

- **R-1** — Tree wrapping changes node y-coords; edges could draw outside their kind tier. Mitigation: edges read `placed.{x,y,h}` by id, no edge math depends on layer-id; wrapping is internal to a kind tier.
- **R-2** — Adaptive VIEW_H stretches small workspaces. Mitigation: floor at 760.
- **R-3** — Label-drop hides important labels. Mitigation: hover/aria-label still wired.

## Open Questions

- Should label-collision use AABB intersection or just adjacent-node y-distance? → start with adjacent y-distance (cheaper); upgrade to AABB if SC-1 verification fails.
- Should Tree wrap also apply to small workspaces with one wide kind row? → yes, the wrap threshold is viewport-relative not artifact-count-relative; tested via SC-4.

## Verification

Browser screenshot at `?view=sankey` and `?view=tree` against the playground fixture (123 nodes), captured before + after. EvidencePack with structured fields (`verdict: supports`, `congruence_level: 3`, `evidence_type: test`) referencing the diff and the screenshots.




