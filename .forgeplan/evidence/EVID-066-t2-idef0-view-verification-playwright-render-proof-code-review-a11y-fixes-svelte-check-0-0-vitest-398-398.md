---
depth: standard
id: EVID-066
kind: evidence
last_modified_at: 2026-07-01T19:15:58.251957+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-029
  relation: informs
status: active
title: 'T2 idef0 view verification: Playwright render proof + code review + a11y fixes (svelte-check 0/0, vitest 398/398)'
---

Consolidated verification of the T2 "idef0" view (Wave T2 of EPIC-001, branch
feat/idef0-view-t2) after BUILD + a11y fixes. Combines an empirical Playwright
render proof, an orchestrator code review (the independent code-reviewer agent
failed to produce output twice; EVID-063 was a hollow stub, soft-deleted), and
the laws-of-ux a11y fixes.

## Playwright render proof (against the running dev server, 138 real artifacts)

Selected the new "IDEF0 — Altitude decomposition + ICOM reading" entry from the
view switcher (registration confirmed: it is the 8th view alongside
Force/Tree/Radial/Matrix/Lanes/Sankey/Sunburst). The view rendered correctly:
- Two-pane layout: OUTLINE (A-numbering A1 EPIC-001, A1.1 PRD-034, A1.2 SPEC,
  A1.3 RFC…; windowed "row 1-50" + Prev/Next → bounded DOM) + ICOM DIAGRAM.
- Honest tier-stack fallback with an explicit mode indicator: "density 0.088 <
  threshold 0.3 (real_edges=12…)" — the correct default on today's sparse graph
  (Outcome 6), NOT a defect.
- Honesty invariant holds AND is not inverted: OUTLINE rows render REAL/solid
  (never dashed); tier-stack DIAGRAM boxes render DERIVED/dashed with the ≈
  marker. This is exactly the two-pane split the SHAPE CONCERNS (EVID-058/059)
  required.
- Bounded fallback (EVID-061 F1 HIGH resolved): the diagram shows banded ≤6/tier
  boxes (T0.1, T1.1, T1.2, T2.1, T2.2), NOT one box per artifact.
- Permanent ICOM legend ("I=input C=control O=output M=mechanism · — real ---- ≈
  derived"). No error boundary; the view is clean.
- No T2-specific console errors. (A pre-existing state_unsafe_mutation surfaced
  in entities/graph/lib/highlight.svelte.ts#clearHovered during the OUTGOING
  view's hover teardown on switch — shared infra, NOT in the T2 diff, flagged
  for a separate tactical fix.)
- No-regression: the switcher lists all 8 views; Force rendered before the
  switch; the branch is purely additive before the final {:else}.

## Code review (orchestrator)

- idef0-layout.ts: pure, deterministic, side-effect-free (invariants L-1…L-4
  enforced). Fallback laid out from the core's BOUNDED diagram.boxes, banded by
  the T<n> number prefix (F1); arrows anchored to each arrow's own incident box
  (E-1); resolveFocusKey deterministic under V-COLLISION (F3). Reads only
  number/key/kind/provenance/side/edge/focus from core output — no
  re-classification/numbering/density (reuse-not-fork, Outcome 5).
- Idef0View.svelte: $derived values are pure reads; the focus-seeding $effect is
  idiomatic; composes the Badge primitive for the legend; the only :global()
  selectors target the widget's OWN svg arrows/.band-label (the allowed rule-24
  pattern, not a primitive re-skin); read-only (rule 22, no mutation); the
  host-forwarded accepted-and-ignored props carry a TODO(reason).
- Registration: ui-prefs.ts (GraphView union + GRAPH_VIEWS) + DependencyGraph.svelte
  branch — additive, compiles clean, empirically live in the switcher.

## a11y (laws-of-ux CONCERNS → fixed)

Independent laws-of-ux review returned CONCERNS: 2 CRITICAL (Fitts — outline-row/
nav-btn/crumb ~15px hit targets; WCAG-AA contrast — 9px fg-4 text ≈1.7:1 in
light) + warnings. FIXED: 28px hit floor on all three controls; row-kind/
rollup-hint/band-label stepped fg-4→fg-2/fg-3 + 9px→10px; mode-reason gains a
title for the clipped reason; box-rollup opacity removed (Von Restorff). The
keyboard-focus-after-drill-up warning + UX suggestions (pagination total, legend
expansion, cross-pane bridge) are tracked as follow-ups.

## Deferred (budgeted, per RFC-029)

5 of 12 SPEC-005 render-surface scenarios (no-regression, legend, keyboard,
reduced-motion, dual-theme) are deferred to a @testing-library/svelte + happy-dom
component harness (RFC-029 Phase-3/4 new work) — they are covered here empirically
by Playwright + the laws-of-ux pass. The 7 geometry/NFR scenarios are node-env
unit-tested (36 idef0-layout tests).

## Verification numbers

- svelte-check: 0 errors / 0 warnings, 1135 files (after a11y fixes).
- vitest: 398/398 (34 files; +36 idef0-layout geometry/NFR/determinism tests).
- NFR-002: deriveIdef0 ~10ms @ N=1000 (budget 50).

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

