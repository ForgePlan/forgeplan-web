---
depth: standard
id: EVID-052
kind: evidence
last_modified_at: 2026-07-01T13:00:48.923476+00:00
last_modified_by: claude-code/2.1.196
links:
- target: ADR-006
  relation: informs
status: active
title: Tier-vocab byte-identical regression + svelte-check 0 errors — ADR-006 behaviour-preserving lift holds
---

## Verdict

**PASS**

12/12 tier regression tests pass; 12/12 idef0 (tier portion via shim) green; SankeyView TYPE_ORDER shim resolves correctly; svelte-check reports 0 ERRORS 0 WARNINGS across 1131 files — the behaviour-preserving lift claimed by ADR-006 holds.

## Ground-truth verification

- Base..head: `03f6457469b01e33b30d3da76a5186ee4bbc353b..54a905c862b542f14a2c5929aa44f450c63ffd21` (source: merge-base origin/main)
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb diff --stat 03f6457..54a905c`
- Diff state: **DELTA=PRESENT** (96 files changed, 7226 insertions(+), 199 deletions(-))
- Expected delta token: `typeTier`, `compactTierMap`, `TYPE_ORDER` in `template/src/shared/lib/tier/`
- Token probe: `grep -rn "typeTier|compactTierMap|TYPE_ORDER" template/src/shared/lib/tier/` → **FOUND** (tier.test.ts lines 5–6, 13–15+)
- Verdict floor from ground-truth gate: **PASS-eligible**

```
BASE=03f6457469b01e33b30d3da76a5186ee4bbc353b
HEAD=54a905c862b542f14a2c5929aa44f450c63ffd21
96 files changed, 7226 insertions(+), 199 deletions(-)
DELTA=PRESENT

grep hit (tier/): tier.test.ts imports { TYPE_ORDER, typeTier, compactTierMap }
grep hit (tier/): TYPE_ORDER_VIA_SHIM import from cluster.svelte
FOUND
```

## Runner detected

- Ecosystem: node
- Runner: vitest v4.1.5
- Output format: text (verbose)
- Config source: package.json (template)

## Command run

```bash
cd /Users/explosovebit/Work/ForgePlanWeb/template
npx vitest run src/shared/lib/tier/ src/shared/lib/idef0/ --reporter=verbose
```

Exit code: `0`

## Summary

| Metric | Value |
|---|---|
| Passed | 29 |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 |
| Total | 29 |
| Duration | ~304ms |

**File breakdown:**
- `tier.test.ts` — 12/12 passed
- `idef0.test.ts` — 16/16 passed
- `nfr002.test.ts` — 1/1 passed

## Tier-specific evidence (ADR-006 scope)

The tier suite (`tier.test.ts`) directly validates the behaviour-preserving lift of TYPE_ORDER and tier-vocab from `SankeyView` into `shared/lib/tier/`. The shim test `SankeyView TYPE_ORDER resolution via the cluster.svelte shim` proves that `cluster.svelte` re-exports the same reference — byte-identical to the canonical.

Passing tests:
- `typeTier returns the canonical index for all 9 TYPE_ORDER kinds`
- `typeTier returns TYPE_ORDER.length (9) for unknown / empty kinds`
- `typeTier is case-insensitive`
- `compactTierMap over the full TYPE_ORDER list yields canonical order`
- `compactTierMap gap subset [prd, rfc, evidence] collapses to {prd:0, rfc:1, evidence:2}`
- `compactTierMap appends unknowns after known tiers in encounter order`
- `compactTierMap is case-insensitive on input kinds`
- `compactTierMap empty input returns an empty Map`
- `TYPE_ORDER has exactly 9 members in canonical order`
- `TYPE_ORDER via the cluster.svelte shim is the same reference as canonical`
- `TYPE_ORDER via the cluster.svelte shim has all 9 canonical members`
- `no non-test source file in tier/ imports from widgets/`

## svelte-check result (0-regression on 7 graph views)

```bash
cd /Users/explosovebit/Work/ForgePlanWeb/template
npm run check
```

Exit code: `0`

```
1782910778905 START "/Users/explosovebit/Work/ForgePlanWeb/template"
1782910778909 COMPLETED 1131 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
```

All 7 existing graph views (ForceView, LanesView, MatrixView, RadialView, SankeyView, SunburstView, TreeView) type-check clean. No regression introduced by the lift.

## AC coverage delta

Parent: ADR-006
AC target: n/a — AC silent on explicit coverage %
Actual: 12/12 tier tests + 0 svelte-check errors
Delta: n/a

## Failing tests

None.

## Slow tests (top 5)

| Test | Duration |
|---|---|
| `nfr002.test.ts – NFR-002 frame budget` | 102ms (benchmark harness, expected) |
| `idef0.test.ts – INV-8 determinism + scale` | 18ms |
| all others | <5ms |

## Flaky candidates

None observed.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Next steps

- PASS: hand back to guardian for activation gate on ADR-006

