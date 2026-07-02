---
depth: standard
id: PRD-035
kind: prd
last_modified_at: 2026-07-02T11:41:39.169136+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-034
  relation: refines
status: active
title: IDEF0 view design-excellence pass (kind colors, honest-info mode bar, band identity, adaptive canvas)
---

# PRD-035: IDEF0 view design-excellence pass

## Problem / Context

The shipped T2 `idef0` view (PRD-034 / RFC-029, GATE-A PASS) is functionally
correct but visually poor and under-informative. The user reviewed the live
view (dark theme, 141 artifacts) and mandated it be "идеален". An independent
UX baseline audit (laws-of-ux, 30 laws) confirmed 10 issues at HEAD — 3
Critical: (A) the honest-fallback mode bar uses warn-toned tokens + raw
engineering copy, reading as an ERROR; (B) zero kind color vocabulary — an
Epic is visually identical to an RFC, while every sibling view applies the
shared `kindBorder()` palette; (C) inverted attention hierarchy — the rollup
"+N more" chip outshines the content boxes it summarises. Plus: contextless
tier band labels, dead canvas space (utilization ≈0.31–0.55), no status
indication in the outline, sub-AA 9px box numbers, no cross-pane hover bridge.

## Target Audience

Developers and leads viewing large forgeplan workspaces in forgeplan-web who
need fast artifact identification by kind/status ("where does X live, what is
it, is it active?") — the same audience as the 7 sibling views, with the same
learned color vocabulary (Jakob's Law).

## Goals / Success Criteria

The A/B evidence pack measures exactly these (baseline metrics recorded by
the laws-of-ux audit):

- SC-1 (FR-1, FR-5) Kind discriminability: ≥3 visually distinct kind groups
  rendered in the diagram and outline (baseline: 0), matching the shared
  vocabulary.
- SC-2 (FR-2) Alarm-tone misread: mode bar uses NO warn/error-semantic tokens
  (baseline: yes → target: no); copy contains no raw threshold numbers.
- SC-3 (FR-6) Canvas utilization ≥0.85 (baseline ≈0.31–0.55) on the
  141-artifact reference render.
- SC-4 (FR-3, FR-4, FR-7, FR-8) UX re-audit: 0 new Critical/Warning findings
  vs the baseline table; band headers, attention hierarchy, cross-pane
  bridge, and edge states each verified by the re-audit.
- SC-5 (do-no-harm, all FRs) Frozen T2 invariants hold — honesty (real solid
  / derived dashed ≈, outline rows never dashed), bounded DOM (≤6+rollup,
  windowed outline), permanent ICOM legend, token-only theming (committed
  no-raw-colors test), WCAG-AA contrast, ≥28px targets, reduced-motion,
  rule 24. vitest suite (413+) and svelte-check stay green.

## Functional requirements (capability language)

- FR-1 Kind identity: every diagram box and outline row visually encodes the
  artifact kind using the SAME shared kind-color vocabulary as the sibling
  views (no new palette).
- FR-2 Honest-informational mode bar: the fallback indicator reads as neutral
  information (never warning/error tone); human copy; the engineering reason
  remains reachable (hover detail).
- FR-3 Band identity: each tier band carries a full-width header naming the
  tier, its kind, and its member count.
- FR-4 Attention hierarchy: content boxes dominate; the rollup indicator is a
  quiet, smaller terminal chip; the focus box is clearly emphasised.
- FR-5 Outline information scent: per-row kind color mark + status dot
  (active/draft/stale/terminal) sourced from the host snapshot.
- FR-6 Adaptive canvas: box columns/width derive from the available pane
  width; narrow content is centred; utilization ≥0.85 on the reference
  workspace.
- FR-7 Cross-pane bridge: hovering an outline row highlights its diagram box
  and vice versa.
- FR-8 Edge-state polish: empty state carries a glyph + actionable hint;
  pagination controls are full-width with ≥36px targets and page context.

## Non-Goals

- No changes to the headless core (`shared/lib/idef0`) contracts.
- No T3 graph authoring, no T4 composed-map work, no new endpoints (rule 22).
- No new runtime dependencies; no shared/ui primitive re-skin (rule 24).

## Kill criterion (hard stop)

STOP at the first of: (a) SC-1..SC-5 all met; or (b) 2 refinement waves
elapsed. Residual polish → a NOTE backlog line, not an open loop.

## Risks / Reversibility

Purely additive visual layer inside one widget + its layout lib; fully
reversible pre-merge via git revert; PRD supersede post-activation. Design
spec + baseline: workflow wf_6c4a8afc (ui-designer proposal, laws-of-ux
baseline with 3 metrics) recorded in the session transcript; the A/B
evidence pack will embed both.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-034  | refines (the shipped T2 view this pass perfects) |
| RFC-029  | context (host-renderer design the polish stays within) |
| SPEC-005 | context (frozen render invariants — SC-5 do-no-harm bar) |
| EPIC-001 | parent program (T2 track, GATE-A) |







