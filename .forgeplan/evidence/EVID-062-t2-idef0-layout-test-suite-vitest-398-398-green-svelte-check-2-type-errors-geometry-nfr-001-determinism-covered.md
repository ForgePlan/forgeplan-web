---
depth: standard
id: EVID-062
kind: evidence
last_modified_at: 2026-07-01T18:43:22.620654+00:00
last_modified_by: claude-code/2.1.196
status: draft
title: 'T2 idef0-layout test suite: vitest 398/398 green, svelte-check 2 type errors, geometry + NFR-001 + determinism covered'
---

## Verdict

**CONCERNS**

vitest 398/398 passed (all test files green, including new idef0-layout.test.ts). svelte-check returns **2 TypeScript errors** in `Idef0View.svelte` line 28 (exit code 1) — `noUncheckedIndexedAccess` strictness violation on `matches[0].id` and `matches[0].title` after a `matches.length === 1` guard. CI would fail at the svelte-check gate. SPEC-005 geometry scenarios, N≥1000 bounded-box in both modes, and determinism are all assertively covered by new tests. Render-surface scenarios (no-regression of 7 views, keyboard nav, reduced-motion, dual-theme, read-only, permanent legend) have no dedicated conformance tests yet.

## Ground-truth verification

- Base..head: `54a905c862b542f14a2c5929aa44f450c63ffd21..2abf473be072ce7f447f2af5aedbef28bd4a516c` (source: merge-base origin/develop)
- Diff probe: `git diff --stat 54a905c..2abf473`
- Diff state: **DELTA=PRESENT** (42 files changed, 6505 insertions, 49 deletions)
- Expected delta token: `layoutIdef0Diagram` (idef0-view renderer function)
- Token probe: `grep -rn "layoutIdef0Diagram" template/src/widgets/dependency-graph/lib/` → **FOUND** at `idef0-layout.ts:207` and `idef0-layout.test.ts:28`
- Verdict floor from ground-truth gate: **PASS-eligible** (delta present, token found)

Key files introduced by this branch:
- `template/src/widgets/dependency-graph/lib/idef0-layout.ts` — geometry engine
- `template/src/widgets/dependency-graph/lib/idef0-layout.test.ts` — SPEC-005 conformance harness
- `template/src/widgets/dependency-graph/ui/Idef0View.svelte` — host renderer
- `template/src/shared/lib/idef0/nfr002.test.ts` — frame-budget test

## Runner detected

- Ecosystem: node / TypeScript
- Runner: vitest 4.1.5
- Output format: text (default reporter) + verbose
- Config source: `template/package.json` scripts + `vitest.config.ts` (pool: 'threads')
- Second gate: `npx svelte-check --tsconfig ./tsconfig.json --threshold error`

## Command run

```bash
# Gate 1 — type-check
cd /Users/explosovebit/Work/ForgePlanWeb/template && \
  npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1; echo "EXIT=$?"

# Gate 2 — unit tests
cd /Users/explosovebit/Work/ForgePlanWeb/template && \
  npx vitest run 2>&1 | grep -v "_encode\|_decode"; echo "VITEST_EXIT=$?"
```

Exit code (svelte-check): `1` — FAIL
Exit code (vitest): `0` — PASS

## Summary

| Metric | Value |
|---|---|
| Passed | 398 |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 |
| Total | 398 |
| Duration | 2.99 s (472 ms tests) |
| svelte-check errors | **2** |
| svelte-check warnings | 1 |
| Files with problems | 1 (`Idef0View.svelte`) |

## svelte-check errors (gate 1 failure)

| File:line | Code | Error |
|---|---|---|
| `src/widgets/dependency-graph/ui/Idef0View.svelte:28:20` | TS2532 | Object is possibly 'undefined'. (`matches[0].id`) |
| `src/widgets/dependency-graph/ui/Idef0View.svelte:28:42` | TS2532 | Object is possibly 'undefined'. (`matches[0].title`) |

Root cause: `noUncheckedIndexedAccess` strict mode. After `if (matches.length === 1)`, TypeScript 5.x does not narrow `matches[0]` to non-undefined because the control-flow analysis does not model array-length checks against index access. Fix: use `matches[0]!` non-null assertion, or refactor to `const m = matches[0]; if (m) return { id: m.id, title: m.title };`.

## AC coverage delta

Parent: RFC-029 (informs)
Related spec: SPEC-005 — idef0 view rendering scenarios (12 frozen scenarios)

### SPEC-005 geometry scenarios (unit-testable, all green)

| SPEC-005 Scenario | Test suite | Status |
|---|---|---|
| §honest-tier-stack-fallback — all diagram boxes derived, no real ICOM arrows | `idef0-layout.test.ts > tier-stack layout` | PASS |
| §honest-tier-stack-fallback — layoutTierBands 0 arrows, all boxes derived | `idef0-layout.test.ts > honest mode switch RC-1` | PASS |
| §dense-idef0-render — ≤6 children + rollup, arrows on correct sides (I/C/O/M) | `idef0-layout.test.ts > dense idef0 render` | PASS |
| §dense-idef0-render — box numbers/sides/provenance read from core (RC-3) | `idef0-layout.test.ts > RC-3 no-recompute` | PASS |
| §honesty-encoding — derived boxes have provenance===derived | `idef0-layout.test.ts > all placed boxes derived` | PASS |
| §roll-up-beyond-per-page-bound — rollup box present, key=__rollup__ | `idef0-layout.test.ts > rollup-terminal section` | PASS |
| §reuse-not-fork (geometry) — numbers/sides match core Idef0Diagram verbatim | `idef0-layout.test.ts > RC-3` | PASS |
| NFR-001 bounded box count — idef0 mode N≥1000: ≤7 boxes | `idef0-layout.test.ts > bounded box-count at N≥1000` | PASS |
| NFR-001 bounded box count — tier-stack mode N≥1000: ≤6 boxes | `idef0-layout.test.ts > bounded box-count at N≥1000` | PASS |
| NFR-001 multi-tier: ≤6 boxes per band | `idef0-layout.test.ts > bounded box-count at N≥1000` | PASS |
| Determinism — layoutIdef0Diagram identical on repeat calls | `idef0-layout.test.ts > determinism under input reorder L-2` | PASS |
| Determinism — layoutTierBands identical on repeat calls | `idef0-layout.test.ts > determinism under input reorder L-2` | PASS |
| Determinism — arrow slot assignment stable under array reorder | `idef0-layout.test.ts > determinism under input reorder L-2` | PASS |
| resolveFocusKey V-COLLISION deterministic (RFC-029 F3) | `idef0-layout.test.ts > resolveFocusKey V-COLLISION / F3` | PASS |
| NFR-002 frame budget — deriveIdef0 N=1000 < 50ms | `nfr002.test.ts` (avg **10.09ms** over 20 runs) | PASS |

### SPEC-005 render-surface scenarios (component-level, not yet covered)

| SPEC-005 Scenario | Gap |
|---|---|
| §no-regression of 7 existing views — all render unchanged | No component/e2e test exists |
| §permanent-legend-in-every-state — legend visible in all 3 states | No component render test |
| §keyboard-navigation — keyboard-only focus change | No DOM test |
| §reduced-motion — transitions suppressed | No DOM test |
| §dual-theme-token-correctness — legible light+dark | No DOM test |
| §read-only-conformance — no mutation call sites | Static review only (no automated test) |

AC-4 threshold: 0 scenarios lacking a test → currently **6 scenarios lack dedicated tests**; these are all render-surface/a11y/e2e scenarios that require a Svelte test harness or browser driver.

## NFR-002 measurement

```
NFR-002 measured: 10.09ms avg over 20 runs at N=1000
```

Result: 10.09ms, budget 50ms, headroom +39.91ms (4.9x under budget). PASS.

## Failing tests

None — vitest 398/398 green.

## Slow tests (top relevant)

| Test | Duration |
|---|---|
| `nfr002.test.ts > NFR-002 frame budget > deriveIdef0 at N=1000` | 234ms (20 timed runs + warmup; per-run avg 10ms) |
| `idef0.test.ts > INV-8: determinism + scale (N=1000)` | 67ms |

## Flaky candidates

None observed.

## Next steps

- **CONCERNS → coder**: fix svelte-check TS2532 in `template/src/widgets/dependency-graph/ui/Idef0View.svelte:28`. Change `matches[0].id` / `matches[0].title` to use `matches[0]!.id` / `matches[0]!.title` (or refactor to non-index form). One-line fix; then re-run `npx svelte-check --tsconfig ./tsconfig.json --threshold error` to confirm exit 0.
- **CONCERNS (AC-4 gap)**: SPEC-005 has 6 render-surface scenarios without dedicated tests (no-regression, legend, keyboard, a11y, theme, read-only). These require a Svelte component test harness or Playwright. GATE-A activation requires AC-4 threshold=0. Recommend coder add at least a snapshot/component-level test for the 3 PRD-034-mandated scenarios (AC-1…AC-3) before guardian activation.
- Once svelte-check is clean and the coder confirms coverage intention for the 6 render scenarios, **hand back to guardian for activation gate**.

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: test

