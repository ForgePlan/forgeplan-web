---
depth: tactical
id: EVID-025
kind: evidence
links:
- target: PRD-020
  relation: informs
- target: RFC-017
  relation: informs
- target: SPEC-001
  relation: informs
- target: SPEC-002
  relation: informs
status: active
title: Sankey + Tree views legible at 123 artifacts (PRD-020 SC-1 + SC-2 verified)
---

# EVID-025: Sankey + Tree views legible at 123 artifacts (PRD-020 SC-1 + SC-2 verified)

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-08 |
| Valid Until | 2026-08-08 |
| Target | PRD-020, RFC-017, SPEC-001, SPEC-002 |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Measurement

Manual browser verification of `npm run dev:playground` (123 artifacts in `../playground/.forgeplan/`) at:

- `template/src/widgets/dependency-graph/ui/SankeyView.svelte` after Phase 1 (issue #69) — adaptive `VIEW_H = max(760, n * (28 + 14) + 64)`, label-collision drop with 16 px line height, width-driven fitToView so `MIN_NODE_HEIGHT_PX = 28` bars stay chunky regardless of column density.
- `template/src/widgets/dependency-graph/ui/TreeView.svelte` after Phase 2 (issue #39) — kind-as-row layer assignment via `compactTierMap`, intra-row wrap when natural row width > `1.5 * viewportW`.

Concurrently in the same viewport (1524 × 806 viewport, MacBook Air screenshot dimensions):

- baseline screenshots before fix (saved by ChromeMCP): broken Sankey with overlapping labels + scattered orphan sub-clusters; broken Tree collapsed into a 30-px stripe.
- after-fix screenshots (saved by ChromeMCP): Sankey with chunky 28-px bars, alternating-label-drop in dense columns (SPEC-001/003/005/007/011/013/015/017 visible — half dropped at idle, hover/select reveals); Tree with each kind on its own row (EPIC × 6, PRD × 16 split into 8+8, SPEC × 17 split into 9+8, RFC × 19 split into 10+9, ADR × 13, EVID × 26 split into 13+13, NOTE × 4, PROBLEM × 13, SOLUTION × 9).

`cd template && npm run check` → 1041 files, 0 errors, 0 warnings.

`cd template && npm run test` → 15 files passed, 146 tests passed (incl. 9 new in `sankey-layout.test.ts`, 9 new in `tree-layout.test.ts`).

## Result

- **SC-1**: zero pairs of overlapping labels at 123 artifacts in Sankey. The `dropCollidingLabels` helper hides every label whose center is within `LABEL_LINE_HEIGHT_PX = 16` of the previous visible label's center within its column. Hover/selection reveals the dropped label.
- **SC-2**: Tree fills ≥ 60 % of viewport height at 123 artifacts (eyeballed from screenshot — 9 kind rows × ≈ 60 px each ≈ 540 px in an 806-px viewport, well above the 40 % SC threshold).
- **SC-3**: pan and zoom remain interactive; no perceptible frame drops during manual pan/zoom on either view.
- **SC-4**: at 62 artifacts (the live `forgeplan-web/.forgeplan` workspace) Sankey `VIEW_H` floor of 760 still wins (≤ 16 nodes per kind), Tree `wrapColumns` is a no-op when natural row width ≤ `1.5 * viewportW` — verified visually.

## Interpretation

Option A from RFC-017 — adaptive `VIEW_H` + label-collision drop for Sankey, kind-as-row + intra-row wrap for Tree — directly addresses the failure modes documented in PRD-020. Both views remain legible at 123 artifacts and unchanged at ≤ 30 artifacts. The MIN_NODE_HEIGHT bump from 14 px → 28 px (mid-fix adjustment per user feedback) keeps bars chunky at any density; the width-driven fitToView lets the canvas overflow vertically rather than shrinking to fit, which is what made the 14-px bars look thin in the first cut.

## Congruence Level Justification

CL3 (same context). The verification is a direct browser-rendering test of the exact files modified by this change, against the exact data shape (`123 artifacts in compact-tier order with sparse cross-tier edges`) the PRD targets. Tests are unit-level (Vitest) on the pure helpers extracted into `lib/sankey-layout.ts` + `lib/tree-layout.ts`; visual is manual.

## Limitations

- No automated DOM-overlap measurement — manual eyeballing on a single viewport size. Any future pixel-perfect regression test would need `playwright` or similar; out of scope for this PR.
- Pan/zoom smoothness (SC-3) measured by feel, not perf instrumentation. No perceptible frame drops on the test machine (M-series MBA, Chrome dev build).

## Related

- PRD-020, RFC-017, SPEC-001, SPEC-002 — drives this evidence.
- GitHub issue #69 (Sankey), #39 (Tree) — closed by the PR carrying this evidence.






