---
created: 2026-05-05
depth: tactical
id: EVID-012
kind: evidence
links:
  - target: PRD-005
    relation: informs
  - target: RFC-004
    relation: informs
status: active
title: "PRD-005 F4 acceptance: RadialView geometry-first layout — 21/22 cards exact-on-orbit, 0 bbox overlap, uniform inter-cluster gap"
updated: 2026-05-05
---

# EVID-012: PRD-005 F4 acceptance — RadialView geometry-first layout

| Field       | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| Status      | Active                                                           |
| Created     | 2026-05-05                                                       |
| Valid Until | 2026-08-05 (3 months — re-verify if RadialView geometry changes) |
| Target      | PRD-005, RFC-004                                                 |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: measurement

## Measurement

PR #26 (`feature/graph-clustering-f4 -> develop`) shipped the F4
clustering feature. This evidence pack captures the FINAL geometry
acceptance — after the chord-based radius rewrite and the
radial-around-largest cluster placement.

Three assertion layers:

- **Geometric proof** — chord rule `2r·sin(π/N) ≥ MIN_CHORD` and
  radial-gap rule `Δr ≥ RING_GAP` make non-overlap a property of the
  placement formula, not an empirical post-condition.
- **DOM verification** — Playwright reads `<g.node>` `transform`
  matrices and `<rect.box>` widths to compute each card's centre,
  then compares against rendered `<circle.ring>` `cx, cy, r`.
- **CI matrix** — PR #26 ubuntu/macos/windows × Node 22 smoke green;
  svelte-check 0/0 across all six F4 commits.

### Layer A — geometric invariants (the spec)

| ID    | Invariant                                                   | Source                                  |
| ----- | ----------------------------------------------------------- | --------------------------------------- |
| INV-1 | Same-ring chord ≥ `√(W² + H²) + SAFE_GAP`                   | `computeRingRadius` chord rule          |
| INV-2 | Adjacent-ring radial gap ≥ `max(W, H) + SAFE_GAP`           | `computeRingRadius` `prev + RING_GAP`   |
| INV-3 | Card centre lies exactly on the orbit ring                  | renderer `(cx + cos θ·r, cy + sin θ·r)` |
| INV-4 | Cluster centroid distance ≥ `R_a + R_b + INTER_CLUSTER_GAP` | radial-around-largest placement         |

### Layer B — DOM verification (live, http://127.0.0.1:5175)

Test workspace: 22 artifacts, 12 hierarchy edges, 4 PRD root clusters
(PRD-001 = centre, PRD-002/003/004 = orbiting outer clusters). Live
dev server, Playwright `browser_evaluate` reading rendered SVG.

| Assertion                                                                    | Measured                              | Verdict |
| ---------------------------------------------------------------------------- | ------------------------------------- | ------- |
| Number of bbox overlaps across all 22 cards                                  | **0**                                 | ✅ pass |
| Cards whose centre is EXACTLY on their orbit ring (error ≤ 0.5 px)           | **21 / 22** (only PRD-005 orphan)     | ✅ pass |
| Outer-cluster centroid distance to centre cluster (PRD-001)                  | **567 px each, all 3 outer clusters** | ✅ pass |
| Edge-gap between centre cluster outer ring and each outer cluster outer ring | **63 px each, all 3 pairs**           | ✅ pass |
| Centre cluster is the largest (R_centre ≥ R_other for all)                   | R_centre = 378, R_outer = 126         | ✅ pass |

INV-3 holds for 21 of 22 nodes; the one outlier (PRD-005, an orphan
with no hierarchy parent) sits at its own cluster centroid where ring
0 = 0 — so "distance to ring" is the cluster's own centre, not a
violation.

### Layer C — CI matrix + type-check

| Check                    | Result                              |
| ------------------------ | ----------------------------------- |
| smoke ubuntu × Node 22   | ✅ green (run 25384694572, 1m08s)   |
| smoke macos × Node 22    | ✅ green                            |
| smoke windows × Node 22  | ✅ green                            |
| svelte-check (template/) | ✅ 0 errors, 0 warnings (360 files) |

## Result

| ID   | Target                                                            | Measured                                        | Verdict |
| ---- | ----------------------------------------------------------------- | ----------------------------------------------- | ------- |
| SC-1 | RadialView card centres lie exactly on orbit rings                | 21/22 cards error = 0; outlier is orphan        | ✅ pass |
| SC-2 | No two cards have overlapping bounding boxes                      | 0 overlaps                                      | ✅ pass |
| SC-3 | Inter-cluster outer-ring edge-gap is uniform                      | 63 px to all 3 outer clusters                   | ✅ pass |
| SC-4 | Largest cluster occupies canvas centre, smaller clusters orbit it | R = 378 at centre, R = 126 on regular polygon   | ✅ pass |
| SC-5 | Smoke matrix 3/3 OS × Node 22 green                               | Run 25384694572                                 | ✅ pass |
| SC-6 | svelte-check 0/0                                                  | 360 files, 0 errors / 0 warnings                | ✅ pass |
| SC-7 | Ring radii follow chord-based formula (provable, not empirical)   | r = max(prev + RING_GAP, MIN_CHORD/(2 sin π/N)) | ✅ pass |

## Interpretation

PRD-005 acceptance is fully met. The geometric rewrite means
non-overlap is a consequence of `computeRingRadius`, not of a
post-layout sweep — so future regressions can be caught by unit-
testing the formula, not by waiting for visual breakage.

The radial-around-largest cluster placement matches the user's
intent ("smaller clusters orbit the largest"): centre = max-R
cluster, others on a regular polygon, edge-gap held uniform via
the combined radial+chord `outerRadius` bound.

ForceView retains physics-driven layout but uses the same lib
(`detectClusters`, `computeOrbitRing`, `computeRingRadius`) as soft
pulls — keeping its visual story consistent with RadialView without
imposing the exact-on-orbit invariant on a force simulation.

## Congruence Level Justification

**CL3 (same-context, penalty 0.0)**:

- DOM measurement runs against the **same** SvelteKit dev server
  users see in their browser. No proxy, no mock — `npm run dev`
  reads the same source files as the published `dist/` build.
- The geometric invariants (INV-1..INV-4) are **derivable from
  Euclidean geometry**, not project-specific heuristics. Anyone
  with a calculator can reproduce them.
- `evidence_type: measurement` — every pass/fail is a numeric
  comparison against a closed-form bound (chord, radial gap,
  centroid distance), not a binary "looks right".

## Related Artifacts

| Artifact | Relation  | Notes                                                    |
| -------- | --------- | -------------------------------------------------------- |
| PRD-005  | informs   | Closes acceptance — activates PRD-005 (R_eff > 0).       |
| RFC-004  | informs   | Pins the geometry; this evidence verifies it.            |
| EVID-011 | builds-on | F2-graph 5-view acceptance pattern.                      |
| PRD-001  | informs   | Methodology baseline (audit→PRD→evidence→activate flow). |
