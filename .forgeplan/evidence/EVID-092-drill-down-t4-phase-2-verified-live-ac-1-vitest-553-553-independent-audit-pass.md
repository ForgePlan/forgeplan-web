---
depth: standard
id: EVID-092
kind: evidence
last_modified_at: 2026-07-05T19:28:50.045390+00:00
last_modified_by: claude-code/2.1.201
links:
- target: RFC-031
  relation: informs
- target: PRD-037
  relation: informs
- target: ADR-009
  relation: informs
status: active
title: Drill-down T4 Phase-2 verified — live AC-1 + vitest 553/553 + independent audit PASS
---

# EVID-092 — Recursive composed-map drill-down (RFC-031 / T4 Phase-2) verified

## Summary

Live acceptance + full test suite + an independent fresh-context audit confirm
RFC-031's recursive drill-down (derive-subdocument + reused pure
`computeComposedLayout` + fit-relative zoom-to-descend thresholds) works on the
**real** `forgeplan-map-pack` v0.6.0 map of this repo (4 zones / 214 nodes,
where `z.decisions` = 170 artifacts collapsed into one mega-node). This closes
the "0/8 visible cards have an artifact_id" dead-end: the 170 hidden artifacts
are now reachable and openable.

## Measurement — live AC-1 on the real 214-node map (:5179)

- **Flat level-0 render unchanged** — 8 cards / 4 zones; `activeDoc === rootDoc`
  (byte-identical Phase-1 map; flow chips restored at level 0).
- **Descend into `z.decisions`** via BOTH entry points — a drag-free click on the
  zone's empty area AND a direct click on the "170 collapsed nodes" mega card —
  reveals **170 real artifact cards + 195 edges** as a zoned sub-map; breadcrumb
  shows `All › …`.
- **Select** a card carrying an `artifact_id` (ADR-001, ADR-005) → opens in the
  right artifact tab with full body / R_eff; select does NOT descend (D2
  click-card-vs-empty-zone disambiguation holds).
- **Climb** via the breadcrumb `All` crumb → back to the flat 8-card map;
  breadcrumb hidden; flows restored (level-0 identity).
- **Drillable affordance** — mega/collapsed cards carry `cursor: pointer` + a
  chevron glyph + a "mega · N nodes" tooltip; contentless code-module cards do
  not (honest: no forgeplan artifact behind them).

## Test / static gates (this diff, `d9a2ab8..112fc47`)

- `vitest run` → **553 / 553 pass** (490 pre-existing + 63 new drill-down tests:
  determinism, no-x/y, no-minted-ids, recursive append-stability at ≥2 altitudes,
  pinned-cols, leaf-honesty, hit-test-under-transform, threshold cross-once +
  cooldown + clamp).
- `svelte-check --tsconfig ./tsconfig.json` → **0 errors** (2 pre-existing
  ComposedMapView a11y warnings predate this diff).
- `computeComposedLayout` (the load-bearing Phase-1 layout) is **untouched** →
  zero regression to the flat map and the other 8 graph views.

## Independent audit — code-reviewer, fresh context, `d9a2ab8..112fc47`

**Verdict: PASS.** The load-bearing design flagged by the implementer is
confirmed **correct and necessary**: `deriveSubDocument` retains the full node
universe (never prunes `nodes[]`) and clears `collapsed` on a dissolved mega —
required so a nested mega's grandchildren survive 2+ levels of descent (traced
by hand + confirmed by the 2-altitude append-stability test; pruning would make
them vanish). No x/y, no minted ids, pinned cols, rule 22 (no `/api/*` diff),
rule 24 (`LevelBreadcrumb` composes `shared/ui` `Button` only, no `:global()`
re-skin) all verified via direct grep + trace; gates corroborated independently
(svelte-check 0, vitest 553/553). No CRITICAL/HIGH findings.

Non-blocking follow-ups (LOW/INFO):
1. RFC-031 §D2(a) addendum recording the mega-card-click-descends refinement
   (Q8) — **addressed in the same activation**.
2. No isolated automated test for the wheel cross-once + cooldown hysteresis
   (currently manual-live-only) — follow-up component test.
3. `collectDirectChildren` dedup is per-call, not a cross-level cycle guard; no
   real fixture (the 214-node map) triggers it.
4. `handleNodeClick` checks drillable before `artifact_id`; a hypothetical node
   that is BOTH `is_mega` and carries `artifact_id` would descend, never open —
   the emitter produces no such node.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test



