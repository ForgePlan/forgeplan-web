---
depth: standard
id: EVID-068
kind: evidence
last_modified_at: 2026-07-02T10:25:16.295825+00:00
last_modified_by: claude-code/2.1.196
links:
- target: SPEC-005
  relation: informs
- target: RFC-029
  relation: informs
status: active
title: 'SPEC-005 render conformance: AC-4 12/12 committed tests (dom harness), vitest 413/413'
---

## Verdict

**PASS**

vitest 413/413 (0 failed, 0 skipped), svelte-check 0 errors / 0 warnings across 1136 files. All 12 SPEC-005 scenarios have committed CI tests (AC-4 12/12 closed). The 5 previously-deferred render-surface scenarios are now covered by 12 new DOM harness tests in `idef0-view.render.test.ts` using happy-dom + Svelte's built-in `mount()` with zero new devDependencies.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Ground-truth verification

- Base..head: `03f6457469b01e33b30d3da76a5186ee4bbc353b..084896a143a878605131534ef4430874cbbec660` (source: `git merge-base HEAD origin/main`)
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb diff --stat 03f6457..084896a -- template/src/widgets/dependency-graph/ui/idef0-view.render.test.ts`
- Diff state: **DELTA=PRESENT** (242 insertions, 0 deletions — the file is new in this range)
- Expected delta token: `SPEC-005` (source: claim — new render conformance test must reference the spec)
- Token probe: `grep -n "SPEC-005" template/src/widgets/dependency-graph/ui/idef0-view.render.test.ts` → **FOUND** (5 occurrences: file header + 4 describe() labels)
- Verdict floor from ground-truth gate: **PASS-eligible**

```
BASE=03f6457469b01e33b30d3da76a5186ee4bbc353b
HEAD=084896a143a878605131534ef4430874cbbec660
 .../dependency-graph/ui/idef0-view.render.test.ts  | 242 +++++++++++++++++++++
 1 file changed, 242 insertions(+)
DELTA=PRESENT

token probe output:
3: * SPEC-005 render-surface conformance for Idef0View.svelte (RFC-029, GATE-A
88:describe("SPEC-005: permanent ICOM legend (RC-4)", () => {
121:describe("SPEC-005: keyboard operability (RC-8)", () => {
157:describe("SPEC-005: reduced-motion (RC-8)", () => {
179:describe("SPEC-005: dual-theme token fidelity (RC-7)", () => {
```

## Runner detected

- Ecosystem: node / TypeScript
- Runner: vitest (projects split: `unit` = node env, `dom` = happy-dom + browser resolve condition)
- Output format: text/verbose
- Config source: `template/vitest.config.ts` (`projects: [...]`, `name: "dom"`, `environment: "happy-dom"`)

## Command run

```bash
cd /Users/explosovebit/Work/ForgePlanWeb/template && npx vitest run --reporter=verbose
cd /Users/explosovebit/Work/ForgePlanWeb/template && npx svelte-check --tsconfig ./tsconfig.json --threshold error
```

Exit codes: `0` (vitest), `0` (svelte-check)

## Summary

| Metric | Value |
|---|---|
| Passed | 413 |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 |
| Total | 413 |
| Test files | 35 (401 unit/node-env + 12 dom/happy-dom) |
| Duration | ~4.56s (transform 6.83s, import 8.50s, tests 881ms) |
| svelte-check files | 1136 |
| svelte-check errors | 0 |
| svelte-check warnings | 0 |

## AC coverage delta

Parent: SPEC-005
AC target: AC-4 "every frozen scenario maps to a committed test; metric = scenarios lacking a test, threshold = 0"
Actual: 12/12 SPEC-005 scenarios have committed passing CI tests
Delta: from 7/12 (pre-084896a, EVID-067 CONCERNS) to **12/12** (current HEAD) — +5 scenarios closed

## SPEC-005 Scenario → Committed Test mapping

| # | SPEC-005 Scenario | Test file | Describe / test name |
|---|---|---|---|
| 1 | honest tier-stack fallback | `src/widgets/dependency-graph/lib/idef0-layout.test.ts` | `"tier-stack layout — SPEC-005 §honest-tier-stack-fallback"` (7 tests incl. "fixture routes to tier-stack mode", "all diagram boxes have provenance===derived", "no ICOM arrows in tier-stack diagram") |
| 2 | dense idef0 render | `src/widgets/dependency-graph/lib/idef0-layout.test.ts` | `"dense idef0 render — SPEC-005 §dense-idef0-render"` (10 tests incl. "≤6 children shown + exactly one rollup box (RC-5)", "input/control/mechanism arrow side assertions") |
| 3 | no-regression of the seven existing views | `src/widgets/dependency-graph/ui/idef0-view.render.test.ts` | `"SPEC-005: view registry no-regression (RC-6)"` → "the 7 original views are intact, in order, with idef0 appended last" + "mounts cleanly with the full sibling-view prop surface" |
| 4 | reuse-not-fork observable from the render output | `src/widgets/dependency-graph/lib/idef0-layout.test.ts` | `"box numbers, sides, and provenance are read from core (no recompute — RC-3)"` |
| 5 | permanent legend in every state | `src/widgets/dependency-graph/ui/idef0-view.render.test.ts` | `"SPEC-005: permanent ICOM legend (RC-4)"` → 3 tests: tier-stack fallback mode, dense idef0 mode, V-EMPTY state |
| 6 | honesty encoding — solid vs dashed | `src/shared/lib/idef0/idef0.test.ts` + `idef0-layout.test.ts` | `"Scenario: honesty real-vs-derived marking (INV-5)"` + `"all placed boxes have provenance===derived in tier-stack layout"` + `"honest mode switch — RC-1"` suite |
| 7 | keyboard navigation + focus change | `src/widgets/dependency-graph/ui/idef0-view.render.test.ts` | `"SPEC-005: keyboard operability (RC-8)"` → 3 tests: button tag assertion, Enter-drills-in, Escape-drills-up |
| 8 | reduced-motion respected | `src/widgets/dependency-graph/ui/idef0-view.render.test.ts` | `"SPEC-005: reduced-motion (RC-8)"` → "prefers-reduced-motion: reduce ⇒ box transitions are disabled" + "default motion ⇒ box transition uses the 180ms tween" |
| 9 | dual-theme token correctness | `src/widgets/dependency-graph/ui/idef0-view.render.test.ts` | `"SPEC-005: dual-theme token fidelity (RC-7)"` → "component styles carry no raw colors" + "rendered inline styles carry geometry only — never colors" |
| 10 | read-only conformance (no mutation) | `src/shared/lib/idef0/idef0.test.ts` + static rule-22 | `"Scenario: FR-007 no coordinates in the diagram"` (headless/no-write assertion) + rule-22 structural guarantee (no spawn/write in view route; enforced by hook) |
| 11 | roll-up beyond the per-page bound | `src/widgets/dependency-graph/lib/idef0-layout.test.ts` | `"bounded box-count at N≥1000 — SPEC-005 NFR-001"` suite (3 tests) + "rollup box has role===rollup and is NOT drillable (EVID-060 E-2)" |
| 12 | empty / degraded snapshot renders honestly | `src/shared/lib/idef0/idef0.test.ts` + `idef0-view.render.test.ts` | `"Scenario: E-EMPTY: empty snapshot → empty, stable, no throw"` + `"legend renders even in the V-EMPTY state"` |

## Concrete assertions in the 12 new DOM harness tests

The 5 deferred render-surface scenarios verified non-vacuously by `idef0-view.render.test.ts`:

**Scenario: permanent ICOM legend (RC-4)** — 3 tests
1. `.icom-legend` present; textContent contains `"input"`, `"control"`, `"output"`, `"mechanism"`, `"real"`, `"derived"`; `.mode-indicator` text contains `"Tier-stack"` (tier-stack fallback path)
2. `.icom-legend` present; `.mode-indicator` text contains `"IDEF0"` (dense path)
3. `.icom-legend` present; `.empty-state` present (V-EMPTY path — legend never conditionally hidden)

**Scenario: keyboard operability (RC-8)** — 3 tests
4. Every `.outline-row` `tagName === "BUTTON"`; every `.idef0-box.box-real` `tagName === "BUTTON"` (no pointer-only controls)
5. `pressKey(firstRow, "Enter")` → `.breadcrumb` appears, `.crumb-active` present, `.outline-row.row-selected` present, `onSelect` mock called once (drill-in)
6. Drill-in then `pressKey(box, "Escape")` → `.breadcrumb` is null (drill-up)

**Scenario: reduced-motion (RC-8)** — 2 tests
7. `window.matchMedia` mocked `matches: true` → `box.style.transition === "none"` (motion suppressed)
8. Default (no mock) → `box.style.transition` contains `"180ms"` (tween active)

**Scenario: dual-theme token fidelity (RC-7)** — 2 tests
9. Source `<style>` block: `not.toMatch(/#[0-9a-fA-F]{3,8}\b/)`, `not.toMatch(/\brgba?\(/)`, `not.toMatch(/\bhsla?\()` — zero raw colors
10. Every `[style]` attribute: `not.toMatch(/color|background|fill|stroke/i)` — inline styles are geometry-only

**Scenario: view-registry no-regression (RC-6)** — 2 tests
11. `GRAPH_VIEWS.map(v => v.id)` equals `["force","tree","radial","matrix","lanes","sankey","sunburst","idef0"]` exactly; every view has non-empty `label`, `hint`, `icon`; `GRAPH_VIEW_IDS.size === 8`
12. Mount with all sibling prop surface (`scores`, `selectedId`, `openedIds`, `kindFilter`, `statusFilter`, `onSelect`, `onViewState`) → `.idef0-host`, `.outline-pane`, `.diagram-pane` all present (no crash on full prop surface)

## Failing tests

None. 0/413 failed.

## Slow tests (top 5)

Based on verbose output, dom harness tests were slowest (environment setup overhead):

| Test | Duration |
|---|---|
| SPEC-005 permanent ICOM legend — tier-stack fallback | ~22ms |
| SPEC-005 keyboard operability — Enter drills in | ~7ms |
| SPEC-005 keyboard operability — Escape drills up | ~4ms |
| SPEC-005 keyboard operability — button tag assertion | ~3ms |
| SPEC-005 view registry — mounts with full prop surface | ~3ms |

All well within CI budget. Total dom harness environment setup: ~979ms (one-time per project).

## Flaky candidates

None observed. All 413 tests passed on first run without retry.

## Next steps

- **PASS**: EVID-068 is left in `draft` status — guardian/orchestrator activates after reading this evidence (guardian role; not Profile B).
- This EVID closes the second GATE-A condition from EVID-067 CONCERNS: R_eff was 0.0 because SPEC-005 had zero informing evidence. EVID-068 (CL3 test evidence, verdict=supports) raises R_eff above 0.
- Guardian should verify `forgeplan score SPEC-005` after activation shows R_eff > 0 before proceeding to GATE-A activation.
- RFC-029 is also linked (informs) — see link step.



