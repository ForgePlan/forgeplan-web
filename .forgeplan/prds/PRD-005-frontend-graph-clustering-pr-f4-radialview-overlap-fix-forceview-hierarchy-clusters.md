---
created: 2026-05-05
depth: standard
id: PRD-005
kind: prd
priority: P2
status: active
title: 'Frontend graph clustering (PR F4): RadialView overlap fix + ForceView hierarchy clusters'
updated: 2026-05-05
---

# PRD-005: Frontend graph clustering

## Problem

User feedback after F2 live walkthrough:

- **UX-1 — RadialView nodes overlap** at moderate N. Each orbital ring
  has a fixed angular slot count; once N children exceed slots, nodes
  literally render on top of each other. Unreadable.

- **UX-2 — ForceView lacks structure**. With 17–270 artifacts the
  default force-directed simulation distributes nodes uniformly across
  the canvas. There's no visual cue for «these belong together» — the
  user can't see at a glance that PRD-001 has 3 supporting EVIDs vs
  PRD-002 has 1. Hierarchy (`epic > prd > spec > rfc > adr > evidence`)
  is invisible.

The user wants Radial-style clustering inside ForceView: each top-type
artifact (Epic if any, else next available type) becomes a centroid;
its children orbit on type-specific radii; anti-collision keeps
neighbours from overlapping; multi-cluster layout when several Epics
exist.

## Target Users

| Persona | Description | Pain |
|---|---|---|
| End-user developer | Browses workspace graph at `localhost:5174` | Force layout is uniform soup; Radial overlaps |
| Repo contributor | Surveys decision tree at PR review | Wants «what hangs off this Epic» visible without click-and-read |

## Goals

| ID | Criterion | Metric | Target | How to measure |
|----|-----------|--------|--------|----------------|
| SC-1 | RadialView nodes never overlap (any N up to 200) | DOM bbox intersection check across all rings | 0 overlapping pairs | Playwright eval at 1600×900 |
| SC-2 | ForceView groups artifacts by hierarchy (top-type centroid) | Identify cluster centroids in DOM via class or position-cluster | ≥1 centroid per Epic (or top-type fallback) | Playwright eval |
| SC-3 | Anti-collision in ForceView clusters | After simulation settles, no two `<rect>` bboxes intersect | 0 overlap pairs | Playwright eval |
| SC-4 | Smoke matrix 3/3 OS × Node 22 green | `gh pr checks` | 3/3 pass | CI |
| SC-5 | `svelte-check` 0/0 | `npx svelte-check` | 0/0 | shell |
| SC-6 | Force simulation stable within 5s on 270 artifacts | Performance.now() before/after settle | settle time < 5000 ms | dev probe |
| SC-7 | No new runtime deps | `git diff template/package.json` | 0 dep added | grep |

## Non-Goals

- Do **not** add dedicated 6th view (`ClusteredView`) — fold cluster logic into ForceView.
- Do **not** rewrite `forceSimulation` from scratch — extend with new forces only.
- Do **not** add edge-bundling (curve aggregation) — separate F-future.
- Do **not** add live cluster collapse/expand (zoom-aware aggregation) — out of scope.

## Functional Requirements

| ID | Category | Priority | Requirement | Acceptance |
|----|----------|----------|-------------|------------|
| FR-001 | Radial fix | Must | RadialView orbital math computes angular step from N children of each ring; if angular step < min gap (e.g. 12°), spill children to the next outer ring | bbox intersection test = 0 |
| FR-002 | Cluster lib | Must | New `lib/cluster.svelte.ts` exports `detectClusters(nodes, edges)` returning `{ clusters: { id, centroid: {x,y}, members: id[] }[] }` based on type hierarchy + link structure | unit-style assert on a fixture |
| FR-003 | ForceView clusters | Must | ForceView reads `detectClusters` result; uses `forceX(d => clusterCentroidX[d.cluster])` + `forceY(d => clusterCentroidY[d.cluster])` with strength 0.3 | DOM measurement: members of same cluster geographically grouped |
| FR-004 | Orbital ring per type | Must | Within a cluster, child of type T orbits parent at radius `BASE_RADIUS + typeOrder(T) * RING_GAP` (forceRadial) | Tree → close orbit, EVID → outer orbit |
| FR-005 | Inter-cluster repel | Must | Custom force pushes cluster centroids apart (negative gravity between cluster centers) | DOM: clusters visually separated, not overlapping |
| FR-006 | Anti-collision | Must | `forceCollide(d => Math.max(d.w, d.h)/2 + 6)` ensures no two node bboxes intersect | bbox pairwise check = 0 overlaps |
| FR-007 | Fallback when no top-type | Should | If filter strips all Epic nodes, next-available type (PRD) becomes centroid; if all types stripped, fall back to single-cluster (current behaviour) | Playwright filter test |
| FR-008 | Documentation | Should | CHANGELOG `[Unreleased]` describes both UX changes | grep |

## Non-Functional Requirements

| ID | Category | Requirement | Metric |
|----|----------|-------------|--------|
| NFR-001 | Perf | 60 fps during simulation tick on 270-node graph | Performance.now() probe |
| NFR-002 | Compatibility | All fixes work on ubuntu/macos/windows × Node 22 | smoke matrix 3/3 |
| NFR-003 | Reversibility | Each FR independently revertable | per-FR commits |
| NFR-004 | Bundle drift | No measurable bundle size delta | `du -sh dist/` before/after |

## Affected Files

- `template/src/widgets/dependency-graph/lib/cluster.svelte.ts` (new) — FR-002
- `template/src/widgets/dependency-graph/ui/RadialView.svelte` — FR-001
- `template/src/widgets/dependency-graph/ui/ForceView.svelte` — FR-003..FR-007
- `CHANGELOG.md` — FR-008

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-004 | F2-graph (selection + hover) — same UX feedback session | active |
| EVID-011 | F2-graph evidence pattern | active |
| RFC-FORCE | Force parameter design (next artifact, fixes strengths/radii/decays) | planned |

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-1 | Force parameters cause oscillation / instability | Medium | High | RFC fixes parameters; tune via `alphaDecay` if observed |
| R-2 | Cluster detection wrong for mixed-link workspaces | Medium | Medium | Fallback to type-priority when graph link structure ambiguous |
| R-3 | Inter-cluster repel pushes clusters off-canvas | Medium | Medium | Cap repel force; bound centroids to viewport with `forceX/Y` to canvas center |
| R-4 | Anti-collision slows simulation on large N | Low | Medium | `iterations(2)` — d3 default — measure perf; fall back to 1 if needed |
| R-5 | RadialView overflow ring breaks if hierarchy depth > available rings | Low | Low | Cap rings at 8; remaining nodes go to outermost ring with denser packing |

