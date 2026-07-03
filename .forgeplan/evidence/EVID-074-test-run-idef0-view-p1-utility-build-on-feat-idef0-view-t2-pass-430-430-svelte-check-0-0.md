---
depth: standard
id: EVID-074
kind: evidence
last_modified_at: 2026-07-02T12:28:20.833839+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-035
  relation: informs
status: active
title: 'Test run: idef0-view P1 utility build on feat/idef0-view-t2 — PASS (430/430, svelte-check 0/0)'
---

## Verdict

**PASS**

430/430 tests passed (0 failed, 0 skipped, 0 flaky). svelte-check 0 errors / 0 warnings across 1136 files. All 24 tests in `idef0-view.render.test.ts` green including all prior SPEC-005 invariant tests and all 12 new P1 scenario tests. The select-vs-drill semantics are tested non-vacuously (see below). Git diff confirms DELTA=PRESENT with all expected P1 tokens in both source and test files.

## Ground-truth verification

- Base..head: `54a905c862b542f14a2c5929aa44f450c63ffd21..e2538c49124f78d650c3dc901569c0283d30ca49` (source: merge-base origin/develop)
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb diff --stat 54a905c..e2538c4`
- Diff state: **DELTA=PRESENT** (66 files changed, 10958 insertions, 81 deletions)
- Expected delta tokens: `reffTone`, `onSelect`, `drillInto`, `bandAggregates`, `mechanismCount` (source: build claim / P1 spec)
- Token probe: `grep -c "reffTone|onSelect|drillInto|bandAggregates|mechanismCount"` → **FOUND** (17 hits in `Idef0View.svelte`, 14 hits in `idef0-view.render.test.ts`)
- Verdict floor from ground-truth gate: **PASS-eligible**

```
REPO_ROOT=/Users/explosovebit/Work/ForgePlanWeb
CURRENT_BRANCH=feat/idef0-view-t2
BASE_SHA=54a905c862b542f14a2c5929aa44f450c63ffd21
HEAD_SHA=e2538c49124f78d650c3dc901569c0283d30ca49
 template/src/shared/lib/idef0/keys.ts              |   45 +
 template/src/shared/lib/idef0/nfr002.test.ts       |   39 +
 template/src/shared/lib/idef0/numbering.ts         |   37 +
 template/src/shared/lib/idef0/outline.ts           |   52 +
 template/src/shared/lib/idef0/port.ts              |  140 +++
 template/src/shared/lib/idef0/relation.ts          |   65 +
 template/src/shared/lib/idef0/signature.ts         |   29 +
 template/src/shared/lib/idef0/types.ts             |  177 +++
 template/src/shared/lib/tier/index.ts              |   54 +
 template/src/shared/lib/tier/tier.test.ts          |  129 ++
 .../widgets/dependency-graph/lib/cluster.svelte.ts |   16 +-
 .../dependency-graph/lib/idef0-layout.test.ts      |  753 ++++++++++++
 .../widgets/dependency-graph/lib/idef0-layout.ts   |  445 +++++++
 .../src/widgets/dependency-graph/lib/type-tier.ts  |   42 +-
 .../dependency-graph/ui/DependencyGraph.svelte     |   14 +
 .../widgets/dependency-graph/ui/Idef0View.svelte   | 1255 ++++++++++++++++++++
 .../dependency-graph/ui/idef0-view.render.test.ts  |  242 ++++
 ...
 66 files changed, 10958 insertions(+), 81 deletions(-)
DELTA=PRESENT
```

Token grep output:
```
Idef0View.svelte:   17 hits for reffTone|onSelect|drillInto|bandAggregates|mechanismCount
idef0-view.render.test.ts: 14 hits for same tokens
DELTA_TOKEN_FOUND=YES
```

## Runner detected

- Ecosystem: node / TypeScript
- Runner: vitest 4.1.5
- Output format: verbose text (terminal)
- Config source: `template/vitest.config.ts`
- svelte-check: `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --threshold warning`

## Command run (svelte-check)

```bash
npx svelte-check --tsconfig ./tsconfig.json --threshold warning
```

Exit code: `0`
Output: `1136 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`

## Command run (vitest)

```bash
npx vitest run --reporter=verbose
```

Exit code: `0`

## Summary

| Metric | Value |
|---|---|
| Passed | 430 |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 |
| Total | 430 |
| Test files | 35 |
| Duration | 4.32s |
| svelte-check errors | 0 |
| svelte-check warnings | 0 |
| svelte-check files | 1136 |

## AC coverage delta

Parent: PRD-035
AC target (SC-5): "vitest suite (413+) and svelte-check stay green" (no % threshold specified)
Actual: 430 passed (+17 vs 413 baseline), 0 errors on svelte-check
Delta: +17 tests vs AC minimum of 413 (delta `n/a` for %)

SC-1..SC-4 (kind discriminability, mode bar tone, canvas utilization, UX re-audit) are UX-observable metrics outside the automated test surface; those require a laws-of-ux audit pass, not vitest. SC-5 (do-no-harm) is the automated gate — it is met.

## Failing tests

None.

## Slow tests (top 5 from idef0-view.render.test.ts)

| Test | Duration |
|---|---|
| SPEC-005: permanent ICOM legend (RC-4) > legend renders in tier-stack fallback mode with all 4 roles + honesty key | 28ms |
| SPEC-005: dual-theme token fidelity (RC-7) > rendered inline styles carry geometry only — never colors | 11ms |
| P1-B > band header no-evidence warning appears when scores prop has low R_eff | 9ms |
| SPEC-005: keyboard operability (RC-8) > Enter on an outline row drills in | 6ms |
| P1-D > drill affordance click drills into the box (breadcrumb appears) | 4ms |

All within normal happy-dom mount budget.

## Flaky candidates

None observed. Single run, all 430 deterministic.

## Select-vs-drill semantic verification (non-vacuity check)

Three P1-D tests confirm the split is tested with real behavioral assertions, not just "component renders":

1. **Box click → `onSelect` without drill** (`3ms`): mounts with `vi.fn()` spy; calls `box.click()`; asserts `onSelect` called once with `{ id: string }` payload; asserts `.breadcrumb` remains absent (no focus change). Non-vacuous: distinguishes "selection fired but no navigation" from "both" or "neither".

2. **Drill affordance click → breadcrumb appears** (`4ms`): queries `.drill-affordance` (would fail if absent); dispatches `MouseEvent({ bubbles: true })`; asserts `.breadcrumb` not null. Non-vacuous: separate affordance element triggers drill, confirming the two-target split in the DOM.

3. **Enter key on box → breadcrumb appears** (`3ms`): dispatches `KeyboardEvent("keydown", { key: "Enter" })`; asserts `.breadcrumb` not null. Non-vacuous: regression guard that keyboard path was not broken by the click refactor.

SPEC-005 prior tests remain meaningful: legend renders in 3 modes (RC-4), outline rows and diagram boxes are `<button>` elements (RC-8), Escape clears the breadcrumb (RC-8), no raw colors in `<style>` block (RC-7), inline styles contain only geometry (RC-7), 8-view registry in correct order (RC-6), full prop surface mounts without errors (RC-6). All 12 prior tests assert concrete DOM/structural invariants.

## Next steps

- PASS: hand back to guardian/orchestrator for activation gate and code-review verdict reconciliation
- SC-1..SC-4 require a laws-of-ux UX re-audit pass (separate evidence) before PRD-035 can be considered fully proven

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

