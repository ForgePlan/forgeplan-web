---
depth: standard
id: EVID-095
kind: evidence
last_modified_at: 2026-07-06T12:50:15.411300+00:00
last_modified_by: claude-code/2.1.201
links:
- target: RFC-033
  relation: informs
status: active
title: 'Onboarding tour (Pillar B) build checkpoint: 186 tests + svelte-check 0 + 4-surface review PASS'
---

## Status

draft

## Summary

Prove-phase checkpoint for **RFC-033** (Onboarding tour, PRD-038 Pillar B). The deterministic,
model-free, zone-walk camera tour is implemented and green. The tour steps the camera through the
composed-map's zones in reading order, narrating each from its `description_ru`; Next/Prev/Exit +
keyboard drive it; Esc exits to free control. Built via a workflow whose adversarial VERIFY phase
died on a StructuredOutput cap — the verification below was therefore performed **directly by the
orchestrator** (ground-truth: ran the suite + svelte-check, read every changed surface).

## What was built

- **`widgets/composed-map/model/tour-state.ts`** (NEW, pure/rune-free) — `buildTourStops(doc)`
  (placement row-major order, `zones[]` fallback), `TourStop`/`TourState`, reducers
  `startTour`/`nextStop`(exits past last)/`prevStop`/`goToStop`/`exitTour`, `currentStop`. Honest
  narration: `narrationRu = zone.description_ru` (undefined when absent, never fabricated).
- **`widgets/composed-map/ui/OnboardTour.svelte`** (NEW) — narration overlay: project title +
  progress badge (n/N) + zone label + RU narration (only when present) + "what's inside"
  (`labels + N more`) + Exit/Prev/Next(Done). Composes `shared/ui` `Card`/`Badge`/`Button` (rule 24
  — no primitive re-skin), `role="dialog"` + focus-on-new-stop, keyboard delegated to the view's
  single window handler (no double-fire), reduced-motion, token-only dual-theme.
- **`widgets/composed-map/ui/ComposedMapView.svelte`** (CHANGED) — `fitToRect(rect, animated)`
  reusing the SAME `computeFitTransform` clamp as `fitToView` (no second zoom controller); a
  `$state` tour controller; stops derived from `okDoc` (level 0 — tour pins to root); an effect that
  centres the camera on the current stop (and re-centres on a layout/version reflow);
  `prefers-reduced-motion` respected; Esc routed to `exitTour` before the Phase-1 reset; live-only
  (exits on non-live, RFC-031 Invariant 8).
- **`routes/onboard/+page.svelte`** (NEW) — thin route mounting the SAME `ComposedMapView` widget
  directly (one widget, two hosts — HomePage/DependencyGraph untouched, zero regression). Route
  auto-start deferred with `TODO(onboard-route-autostart)` per RFC-033 SCOPE (the newcomer clicks
  "Start tour"); the route never blocks the tour.

## Observations (measured, 2026-07-06)

- `npx vitest run src/widgets/composed-map src/entities/map` -> **14 files / 186 tests PASS**
  (+31 vs the pre-tour 155: `tour-state.test.ts` + `OnboardTour.render.test.ts` +
  `tour.render.test.ts`).
- `npx svelte-check` -> **0 errors**, 2 warnings (both pre-existing a11y warnings on the map `<svg>`
  click handler at `ComposedMapView.svelte:972`, unrelated to the tour).
- **Orchestrator 4-surface review (adversarial substitute):** (1) `tour-state.ts` pure/deterministic,
  placement-ordered, honest narration; (2) `fitToRect` reuses the fit-scale math (no fork); (3)
  `OnboardTour` rule-24 clean (grep: no `:global()` reaching a primitive class); (4) `/onboard` route
  mounts the widget directly (no HomePage/DependencyGraph edit -> 8 legacy views + drill-down
  unchanged). Reduced-motion + live-only + Esc-before-reset confirmed in the diff.

## Known scope boundary

- `/onboard` route **auto-start** is deferred (`TODO(onboard-route-autostart)`) — the in-view
  "Start tour" affordance ships regardless (RFC-033 SCOPE).
- The tour narrates ZONE-level `description_ru`; richer per-node narration + a project-level intro
  (`meta.title`/`description_ru`) + an explicit reading-order field are **source-side** improvements
  tracked in the marketplace findings brief (CM-08/CM-09/CM-16). The tour degrades gracefully now and
  will light up richer without web changes once the emitter emits them.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Related Artifacts

- **RFC-033** (`informs`) — the tour architecture this proves; activation gated on this checkpoint.
- **PRD-038** — parent PRD (Pillar B, FR-005..FR-009).
- **RFC-030/031** — the composed-map render + drill-down this tour rides on without regression.
- **`docs/MAP-PACK-FINDINGS-FOR-MARKETPLACE.md`** — source-side items (CM-08/09/16) that enrich the
  tour narration next map-pack run.


