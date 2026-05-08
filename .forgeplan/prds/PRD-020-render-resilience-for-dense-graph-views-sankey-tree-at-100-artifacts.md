---
depth: standard
id: PRD-020
kind: prd
status: active
title: Render-resilience for dense graph views (Sankey + Tree) at 100+ artifacts
---

---
id: PRD-020
title: "Render-resilience for dense graph views (Sankey + Tree) at 100+ artifacts"
status: Draft
author: fedorovvvv
created: 2026-05-08
updated: 2026-05-08
priority: P1
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-020: Render-resilience for dense graph views (Sankey + Tree) at 100+ artifacts

## Progress

```
Phase 0  ░░░░░░░░░░░░░░░░░░░░░░░░  0/0  (  0%)
─────────────────────────────────────────────────
TOTAL                               0/0  (  0%)
```

---

## Executive Summary

### Vision

Two of the seven graph views — Sankey and Tree — must remain legible and interactive at workspace sizes ≥100 artifacts so the dependency map stays useful as a project matures past the prototype stage.

### Problem

When a Forgeplan workspace grows past ~100 artifacts (the playground fixture has 123), two of the seven graph views break visually:

- **Sankey** — `d3-sankey` packs all nodes of a kind into a fixed `VIEW_H = 760` canvas. With 26 EVID nodes and 16 PRDs in adjacent columns the per-node height collapses to ≈2 px and the text labels for adjacent nodes overlap each other and the bars themselves. Disconnected components are pushed below the main canvas as scattered sub-clusters with no relation to the kind-tier they belong to.
- **Tree** — `computeLayout` topologically sorts nodes by `incoming.size === 0` into layer 0. In a workspace that is heavy on root-level artifacts (EPIC + standalone EVID/PROBLEM/SOLUTION) layer 0 collects 30+ nodes. `maxRowW` then balloons to ~4000 px and `fitToView` scales the entire diagram so much that every node renders as a 1-px stripe.

**Impact**: at 123 artifacts both views are effectively unusable. Users either ignore them and rely on Force/Radial, or they switch to the Sankey/Tree expecting hierarchy and see a smear.

### Target Users

| Persona | Description | Key pain |
|---|---|---|
| Workspace owner | Engineer / PM exploring their own `.forgeplan/` past the prototype stage | Sankey/Tree become illegible exactly when the workspace gets big enough to need them |
| First-time visitor | Onboarding a new contributor by pointing at the graph | The "broken" first impression of two of seven views damages trust in the tool |

### Differentiators

- All seven views share data + filter + selection state. Fixing rendering at scale must not require new data shapes or per-view feature flags.
- The fix lives behind the same `npx @forgeplan/web` install path — no host-side opt-in, no new commands.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | At ≥120 artifacts, no two Sankey labels overlap each other or sit on top of a bar | label-overlap count via DOM measurement | 30+ overlapping pairs | 0 | This PR | Browser screenshot @ playground (123 nodes) + manual count of overlapping `<text class="label">` |
| SC-2 | At ≥120 artifacts, the Tree view fills ≥40% of the viewport vertically (no single-stripe collapse) | bbox.height / viewport.height of `<g class="placed">` | ≈4% (1 stripe) | ≥40% | This PR | Browser screenshot @ playground; eyeballed against viewport |
| SC-3 | Both views remain interactive (zoom, pan, click-select, hover-highlight) at 123 nodes | per-frame timing during pan | n/a (not measured) | <16ms p95 | This PR | Manual pan/zoom + visual smoothness check |
| SC-4 | No regression on ≤30-artifact workspaces (the live `.forgeplan/` of this repo) | visual diff between branch and develop | identical | identical | This PR | Side-by-side at 62 artifacts |

---

## Product Scope

### MVP (In-Scope)

- SankeyView: adaptive `VIEW_H` based on the densest column; label-collision drop so labels for adjacent nodes hide rather than overdraw.
- TreeView: layer assignment driven by **kind tier** (the same compact-tier order as Sankey), not by incoming-edge depth. Intra-row wrap when a kind has more than ~12 artifacts so a single mega-row never spans the viewport.
- Both views: fitToView extents widened so the resulting layout actually scales to fit the user's viewport instead of clamping at 1.5× zoom.

### Out of Scope

- Bucket-by-status aggregation in Sankey (option C from routing) — defer to a follow-up if SC-1 + SC-3 prove insufficient.
- Vertical Tree orientation (option C from routing) — defer; LanesView already covers that visual.
- Force / Radial / Matrix / Lanes / Sunburst — out of scope for this PRD even if they share related code.

### Growth Vision

- Same density-cap pattern can be reused by Sunburst and Radial if they hit similar ceilings at higher counts.

---

## User Journeys

### Journey 1: Workspace owner inspects a maturing workspace via Sankey

**Goal**: see hierarchy flow from EPIC → PRD → ... → SOLUTION at a glance.

| Step | User action | System response | Notes |
|---|---|---|---|
| 1 | `npx @forgeplan/web start` against own workspace (~120 artifacts) | App boots, defaults to Force view | unchanged |
| 2 | Open view-picker, choose Sankey | Sankey renders with 9 columns; labels are readable | currently broken |
| 3 | Hover on a node | Highlight propagates; label remains legible | currently obscured |
| 4 | Click a node | Selection persists; ArtifactPanel opens | unchanged |

**Result**: User reads the hierarchy without resorting to text-only views.

### Journey 2: Onboarding visitor inspects via Tree

**Goal**: see the dependency tree top-down to grok project structure.

| Step | User action | System response | Notes |
|---|---|---|---|
| 1 | Switch to Tree view | Tree renders top-down by kind; rows wrap when too dense | currently 1-stripe |
| 2 | Pan/zoom to a kind row | Zoom remains smooth; text remains readable at default fit | currently microscopic |
| 3 | Click a node | Selection works | unchanged |

**Result**: Visitor leaves with a clear mental model of what the workspace contains.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | Workspace owner can read every Sankey label without it being occluded by another label or a bar | Journey 1 |
| FR-002 | Core | Must | Workspace owner can see Tree row-per-kind layout with no kind-row exceeding the viewport width | Journey 2 |
| FR-003 | Core | Must | Workspace owner can pan and zoom both views at 123 artifacts without frame drops perceptible to the eye | Journey 1, 2 |
| FR-004 | UX | Should | Onboarding visitor can identify a node by hovering even when its label was hidden by collision | Journey 1 |
| FR-005 | UX | Should | Workspace owner sees the same visual on a 62-artifact workspace as before this PRD (no regression) | Journey 1, 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | View transition shall complete | <250ms | Switching Tree↔Sankey on 123-node workspace | Manual timing in Chrome perf panel |
| NFR-002 | Maintainability | Layout code shall stay in `dependency-graph/lib` | 100% of new layout helpers | Lib/ui split preserved | Grep for layout fns in `ui/` files |
| NFR-003 | Compatibility | Both views shall preserve the same minimap + onViewState contract | unchanged contract | DependencyGraph.svelte parent | Visual minimap test |

---

## Acceptance Criteria

### AC-1: Sankey at 123 artifacts is legible

```gherkin
Given the playground workspace with 123 artifacts is loaded
When the user switches to the Sankey view
Then no two labels (.label text nodes) overlap each other or their bar
And every kind-tier column is visible without scattered sub-clusters below the canvas
```

### AC-2: Tree at 123 artifacts uses kind-as-row + wrap

```gherkin
Given the playground workspace with 123 artifacts is loaded
When the user switches to the Tree view
Then layer 0 contains only EPIC nodes
And layer N corresponds to the Nth kind tier (PRD, SPEC, RFC, ADR, EVIDENCE, NOTE, PROBLEM, SOLUTION)
And no kind-row spans more than 1.5× the viewport width — additional nodes wrap onto a sub-row
And the rendered layout fills ≥40% of the viewport height
```

### AC-3: No regression on the live workspace

```gherkin
Given the live forgeplan-web .forgeplan workspace with 62 artifacts
When the user switches to Sankey or Tree
Then the rendering matches the develop branch (same node count, same edges, same hierarchy)
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| `template/src/widgets/dependency-graph/ui/SankeyView.svelte` | Internal | Ready | this PR |
| `template/src/widgets/dependency-graph/ui/TreeView.svelte` | Internal | Ready | this PR |
| `template/src/widgets/dependency-graph/lib/sankey-layout.ts` | Internal | Ready | this PR |
| `template/src/widgets/dependency-graph/lib/type-tier.ts` (compact tier order) | Internal | Reused | unchanged |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Tree wrapping changes edge geometry — arrows might point at the wrong sub-row | Medium | Medium | edges always emit from node.bottom-center to node.top-center; sub-row uses same id-keyed `placed` map so existing edge pathing reads correct coordinates | this PR |
| R-2 | Sankey adaptive height makes small workspaces look stretched | Medium | Low | clamp `VIEW_H` to `[760, ...]`: only grows past 760 when density requires it | this PR |
| R-3 | Label-collision drop hides important labels | Low | Medium | hidden labels still accessible via hover/aria-label; hover state shows the label even if it was dropped at idle | this PR |

---

## Timeline

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| PRD Approved | 2026-05-08 | Requirements locked |
| RFC Approved | 2026-05-08 | Architecture decided |
| MVP | 2026-05-08 | Both views fixed |
| Activate + PR merged | 2026-05-08 | Develop branch updated |

---

## Affected Files

- `template/src/widgets/dependency-graph/ui/SankeyView.svelte`
- `template/src/widgets/dependency-graph/ui/TreeView.svelte`
- `template/src/widgets/dependency-graph/lib/sankey-layout.ts`

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| RFC-020 | Architecture proposal | draft |
| GitHub issue #69 | Source: "Fix sankey view" | open |
| GitHub issue #39 | Source: "Improve view Tree rendering" | open |




