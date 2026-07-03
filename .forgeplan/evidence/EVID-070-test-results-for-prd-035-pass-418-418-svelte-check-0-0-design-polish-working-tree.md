---
depth: standard
id: EVID-070
kind: evidence
last_modified_at: 2026-07-02T11:41:17.907995+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-035
  relation: informs
status: active
title: 'Test results for PRD-035: PASS — 418/418 svelte-check 0/0 design-polish working tree'
---

## Verdict

**PASS**

418/418 tests passed; svelte-check 0 errors / 0 warnings; all 12 SPEC-005 render scenarios confirmed; all PRD-035 delta tokens found; no assertions deleted or weakened.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Ground-truth verification

- Base..head: `54a905c862b542f14a2c5929aa44f450c63ffd21..89e814c271739130ff834f82247765f657a21363` (source: merge-base HEAD develop)
- Diff probe: `git diff HEAD -- template/src/widgets/dependency-graph/ui/Idef0View.svelte | wc -l`
- Diff state: **DELTA=PRESENT** (design-polish changes in working tree, uncommitted; 4 files modified)
- Expected delta token: `kindBorder` (FR-1 kind color system)
- Token probe: `grep -n "kindBorder" template/src/widgets/dependency-graph/ui/Idef0View.svelte` → **FOUND** (lines 18, 398, 466)
- Additional tokens probed:
  - `BandInfo` → FOUND (idef0-layout.ts:74, 133, 369)
  - `hoveredKey` → FOUND (Idef0View.svelte:99, 243–255)
  - `adaptiveGeom` + `containerW` + `bind:clientWidth` → FOUND (Idef0View.svelte:97, 114, 314)
  - `kindIsAccent` / `kindLabelColor` / `kindColor` → FOUND (Idef0View.svelte:19–22, 263, 399)
  - `statusById` / `row-status-dot` → FOUND (Idef0View.svelte:156, 269–277)
- Verdict floor from ground-truth gate: **PASS-eligible**

Literal probe output (abbreviated):

```
kindBorder found at Idef0View.svelte:18, 398, 466
BandInfo found at idef0-layout.ts:74, 133, 369
hoveredKey found at Idef0View.svelte:99
adaptiveGeom + containerW + bind:clientWidth found at Idef0View.svelte:97, 114, 314
statusById + row-status-dot found at Idef0View.svelte:156, 269-277
DELTA=PRESENT (git status shows 4 working-tree modified files)
```

## Runner detected

- Ecosystem: node / TypeScript
- Runner: vitest
- Output format: json
- Config source: `template/package.json scripts.test` (`vitest run`)

## Command run

```bash
cd /Users/explosovebit/Work/ForgePlanWeb/template && npx vitest run --reporter=json --outputFile=<scratchpad>/vitest-results.json
```

Exit code: `0`

svelte-check:

```bash
cd /Users/explosovebit/Work/ForgePlanWeb/template && npx svelte-check --tsconfig ./tsconfig.json --threshold warning
```

Exit code: `0` — `1136 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`

## Summary

| Metric | Value |
|---|---|
| Passed | 418 |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 |
| Total | 418 |
| Test suites | 172 |
| Duration | 5.0 seconds |
| svelte-check errors | 0 |
| svelte-check warnings | 0 |

## AC coverage delta

Parent: PRD-035
AC target: "vitest suite (413+) and svelte-check stay green" (SC-5); no explicit % threshold
Actual: 418 tests (+5 vs pre-design-polish 413 baseline), 0 failures, svelte-check 0/0
Delta: +5 new tests; n/a for coverage %

### SC-by-SC assessment

| SC | Requirement | Evidence |
|---|---|---|
| SC-1 (FR-1) | ≥3 visually distinct kind groups (baseline: 0) | `kindBorder()` / `kindColor()` / `kindIsAccent()` wired to CSS custom props on every box and outline row — token probes FOUND |
| SC-2 (FR-2) | Mode bar: no warn/error tokens; humanized copy | Mode indicator test updated: `"Tier-stack"` → `"Sparse"` (humanized); assertion passes |
| SC-3 (FR-6) | Canvas utilization ≥0.85 | `adaptiveGeom` 2/3/4-col breakpoints + `bind:clientWidth` found; runtime metric only |
| SC-4 (FR-3,4,7,8) | 0 new Critical/Warning findings vs baseline | svelte-check 0/0; all 418 tests green |
| SC-5 (do-no-harm) | Frozen T2 invariants; vitest 413+ green; svelte-check green | 418/418 PASS; SPEC-005 12 render scenarios confirmed; token-fidelity test passes |

## Failing tests

None.

## Slow tests (top 5)

| Test file | Duration |
|---|---|
| nfr002.test.ts | 377ms |
| idef0-view.render.test.ts | 73ms |
| idef0.test.ts | 64ms |
| idef0-layout.test.ts | 56ms |
| endpoint.test.ts | 30ms |

## Flaky candidates

None observed.

## Assertion audit

| File | Change | Assessment |
|---|---|---|
| `idef0-view.render.test.ts` | `"Tier-stack"` → `"Sparse"` in `.mode-indicator` assertion | NOT weakened — updates to match FR-2 humanized copy |
| `idef0-layout.test.ts` | 0 lines deleted; 73 WT-lines added (pagination peek tests) | NOT weakened — net addition only |

No assertions were deleted. No assertion strength was reduced.

## Next steps

- PASS: hand to guardian/orchestrator for PRD-035 activation gate
- Design-polish changes are uncommitted (working tree) — coder should commit before PR
- PRD-035.md is untracked — needs `forgeplan scan-import` post-commit

## Agent identity

claude-code/claude-sonnet-4-6/tester-task-prd035-design-polish

