---
depth: standard
id: EVID-064
kind: evidence
last_modified_at: 2026-07-01T19:08:25.027528+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-029
  relation: informs
status: active
title: 'Wave T2 idef0 view: test-suite verification (vitest 398/398, svelte-check 0 errors, SPEC-005 AC-4 coverage split)'
---

## Verdict

**CONCERNS**

398/398 tests pass (36 new `idef0-layout.test.ts` all green), svelte-check 0 errors / 0 warnings (1135 files), git delta present and all expected tokens found. CONCERNS because AC-4 (SPEC-005) is partially satisfied: 7 of 12 `#### Scenario` blocks have node-env unit-test coverage at the layout / geometry / data-flow boundary; 5 render-surface scenarios (no-regression, legend, keyboard, reduced-motion, dual-theme) require the DOM component-test harness (`@testing-library/svelte` + `@vitest-environment happy-dom`) documented as RFC-029 Phase-3/4 prerequisite — new work not yet built. No test failures, no wrong implementations, no code regressions.

## Ground-truth verification

- Base..head: `54a905c862b542f14a2c5929aa44f450c63ffd21..080d6d9c32062c289d34c410f13d327fcbc8a4dc` (source: `git merge-base HEAD develop`)
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb diff --stat 54a905c..080d6d9 -- template/`
- Diff state: **DELTA=PRESENT** (22 files changed, 3711 insertions, 50 deletions)
- Expected delta tokens: `resolveFocusKey`/`layoutIdef0Diagram` in `idef0-layout.ts` FOUND; `Idef0View`/`deriveIdef0` in `Idef0View.svelte` FOUND; `idef0` in `ui-prefs.ts` FOUND; `idef0`/`Idef0View` in `DependencyGraph.svelte` FOUND
- Verdict floor: **PASS-eligible** (delta present, all tokens found)

## Runner detected

- Ecosystem: node / TypeScript (SvelteKit)
- Runner: vitest v4.1.5
- Output format: text (verbose)
- Config source: `template/vitest.config.ts`

## Command run

```bash
cd /Users/explosovebit/Work/ForgePlanWeb/template && npx svelte-check --tsconfig ./tsconfig.json --threshold error
# Exit: 0  (0 errors / 0 warnings / 1135 files)

cd /Users/explosovebit/Work/ForgePlanWeb/template && npx vitest run --reporter=verbose
# Exit: 0
```

Exit code (svelte-check): `0`
Exit code (vitest): `0`

## Summary

| Metric | Value |
|---|---|
| Passed | 398 |
| Failed | 0 |
| Skipped | 0 |
| Flaky | 0 |
| Total | 398 |
| Test files | 34 passed |
| Duration | 887 ms |
| svelte-check | 0 errors / 0 warnings / 1135 files |

New idef0-layout.test.ts (36 tests):

| Group | Count |
|---|---|
| dense idef0 render §dense-idef0-render | 9 |
| output right side arrow synthetic | 3 |
| tier-stack layout §honest-tier-stack-fallback | 7 |
| bounded box-count N>=1000 NFR-001 | 3 |
| determinism under input reorder L-2 | 3 |
| honest mode switch RC-1 | 2 |
| resolveFocusKey V-COLLISION F3 | 5 |
| rollup terminal count F2/C-1 | 2 |
| Total | 36 |

## AC coverage delta

Parent: RFC-029; SPEC-005 scenario contract
AC target: AC-4 — threshold = 0 scenarios lacking a test
Actual: 7 of 12 node-env covered; 5 deferred to DOM harness
Delta: AC-4 partially met

## SPEC-005 AC-4 Scenario Coverage Split

Node-env unit-tested (7 of 12):

1. honest tier-stack fallback — idef0-layout.test.ts §honest-tier-stack-fallback (7 tests) + §honest mode switch RC-1 (2 tests). All-derived boxes, 0 ICOM arrows, T<n> banding from diagram.boxes, tierStack for labels only, rollup >6. Layout boundary.

2. dense idef0 render — §dense-idef0-render (9 tests) + §output right side arrow (3 tests). Focus-by-key L-4, ≤6+rollup RC-5, I/C/M anchor-box geometry (E-1 child anchor, not focus anchor), no-recompute RC-3. Layout boundary.

4. reuse-not-fork observable — §dense box numbers/sides/provenance from core (RC-3); idef0.test.ts INV-10. Import-scan deferred to static review.

6. honesty encoding solid vs dashed — provenance assertions in §dense, §tier-stack, §honest mode switch. Layout-object boundary. DOM CSS class deferred.

10. read-only conformance — static/structural: rule-22 gate; no spawn/write in diff. No executable test; static diff review.

11. roll-up beyond per-page bound — §dense rollup role, bounded count, NOT drillable E-2; §bounded N>=1000 (3 tests); §rollup terminal count (2 tests). Full node-env.

12. empty / degraded snapshot — idef0.test.ts E-EMPTY (empty stable no throw) + E-MISSING-IDENTITY. DOM legend render deferred.

DOM-harness deferred (5 of 12) per RFC-029 Phase-3/4 prerequisite (new @testing-library/svelte + @vitest-environment happy-dom; zero component-render tests exist today per Risk T-1/T-2):

3. no-regression of seven existing views — component harness + baseline snapshots + Playwright
5. permanent legend in every state — DOM render assertion (visibility in 3 states)
7. keyboard navigation + focus change — DOM event simulation + tab-order assertion
8. reduced-motion respected — matchMedia mock in DOM env
9. dual-theme token correctness — DOM computed-style / token inspection

NFR coverage (node-env, outside 12-scenario count):
- NFR-001 bounded DOM N>=1000: §bounded box-count (3 tests, both modes) COVERED
- NFR-002 frame budget <50ms: nfr002.test.ts COVERED at core level; view-render budget TBD (RFC-028 Q4)

## Failing tests

None.

## Slow tests (top 5)

| Test | Duration |
|---|---|
| nfr002.test.ts > NFR-002 > deriveIdef0 N=1000 under 50ms | 256 ms (runner overhead; core passes) |
| idef0.test.ts > INV-8 determinism N=1000 | 37 ms |
| idef0-layout.test.ts > bounded N>=1000 > idef0 mode ≤7 boxes | 18 ms |
| idef0-layout.test.ts > bounded N>=1000 > tier-stack ≤6/tier | 10 ms |
| idef0-layout.test.ts > dense render > fixture routes to idef0 mode | 2 ms |

## Flaky candidates

None.

## Structured Fields

verdict: concerns
congruence_level: 3
evidence_type: test

## Next steps

- CONCERNS: dispatch coder for Phase-3/4 DOM harness bootstrap (@testing-library/svelte + @vitest-environment happy-dom) to cover 5 deferred render-surface SPEC-005 scenarios before GATE-A full activation.
- Geometry/layout is PASS-eligible: 36 idef0-layout tests green, covering ICOM anchor-box geometry, F1 bounded tier-stack, F2 terminal rollup, F3 V-COLLISION resolver, L-2 determinism, RC-1, RC-3, RC-5, NFR-001.
- Read-only conformance (RC-7/rule-22): no mutation/spawn in diff; static gate satisfied.
- After DOM harness lands: re-run tester for PASS on 12/12 AC-4, then guardian gates GATE-A activation of RFC-029.

