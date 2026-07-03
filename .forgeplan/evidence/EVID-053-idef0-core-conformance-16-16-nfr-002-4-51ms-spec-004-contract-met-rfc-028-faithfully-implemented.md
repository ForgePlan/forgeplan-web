---
depth: standard
id: EVID-053
kind: evidence
last_modified_at: 2026-07-01T13:01:28.858689+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-028
  relation: informs
- target: SPEC-004
  relation: informs
status: active
title: idef0 core conformance 16/16 + NFR-002 4.51ms — SPEC-004 contract met, RFC-028 faithfully implemented
---

## Verdict

**PASS**

16/16 idef0 conformance tests pass, covering all 12 frozen SPEC-004 `#### Scenario` blocks; NFR-002 benchmark: 4.51ms average over 20 runs at N=1000 (budget: <50ms). RFC-028 is faithfully implemented; SPEC-004 contract is fully met.

## Ground-truth verification

- Base..head: `03f6457469b01e33b30d3da76a5186ee4bbc353b..54a905c862b542f14a2c5929aa44f450c63ffd21` (source: merge-base origin/main)
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb diff --stat 03f6457..54a905c`
- Diff state: **DELTA=PRESENT** (96 files changed, 7226 insertions(+), 199 deletions(-))
- Expected delta token: `deriveIdef0`, `classifyIcom`, `buildDecompForest` in `template/src/shared/lib/idef0/`
- Token probe: `grep -rn "deriveIdef0|classifyIcom|buildDecompForest" template/src/shared/lib/idef0/` → **FOUND**
- Verdict floor from ground-truth gate: **PASS-eligible**

```
BASE=03f6457469b01e33b30d3da76a5186ee4bbc353b
HEAD=54a905c862b542f14a2c5929aa44f450c63ffd21
96 files changed, 7226 insertions(+), 199 deletions(-)
DELTA=PRESENT

grep hit (idef0/): nfr002.test.ts imports deriveIdef0 from "./index"
grep hit (idef0/): forest.ts line 25: export function buildDecompForest
grep hit (idef0/): idef0.test.ts imports classifyIcom
FOUND
```

## Runner detected

- Ecosystem: node
- Runner: vitest v4.1.5
- Output format: text (verbose) + stdout NFR-002 line
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
| Passed | 29 (total suite) |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 |
| Total | 29 |
| Duration | ~304ms |

**idef0-specific breakdown:**
- `idef0.test.ts` — 16/16 passed (all SPEC-004 scenario blocks)
- `nfr002.test.ts` — 1/1 passed (NFR-002 benchmark)

## SPEC-004 scenario coverage (idef0.test.ts 16/16)

All 12 frozen `#### Scenario` blocks from SPEC-004 are exercised:

| Test name | SPEC-004 Scenario |
|---|---|
| `buildDecompForest one-parent + informs=Mechanism (INV-2/INV-4)` | INV-2, INV-4 |
| `densityGate threshold + tier-stack fallback (INV-6)` (3 cases) | INV-6 |
| `honesty real-vs-derived marking (INV-5)` | INV-5 |
| `(id,title) numbering stability + id-collision (INV-7)` (2 cases) | INV-7 |
| `classifyIcom case-per-relation incl. based_on (INV-3)` | INV-3 |
| `INV-10 headless metadata sufficiency` | INV-10 |
| `FR-007 no coordinates in the diagram` | FR-007 |
| `E-EMPTY` | E-EMPTY |
| `E-CYCLE deterministic break` | E-CYCLE |
| `E-UNKNOWN-RELATION` | E-UNKNOWN |
| `E-MISSING-IDENTITY degraded key` | E-MISSING-IDENTITY |
| `INV-8 determinism + scale (N=1000)` | INV-8 |

## NFR-002 benchmark result

```
stdout | src/shared/lib/idef0/nfr002.test.ts > NFR-002 frame budget
NFR-002 measured: 4.51ms avg over 20 runs at N=1000
```

Budget: <50ms at N=1000. Actual: **4.51ms** (91% headroom). Benchmark exit: `0`.

## AC coverage delta

Parent: RFC-028 + SPEC-004
AC target: 16/16 SPEC-004 scenarios green; NFR-002 <50ms @ N=1000
Actual: 16/16 scenarios passed; 4.51ms avg (well under budget)
Delta: n/a (all AC met, no threshold miss)

## Failing tests

None.

## Slow tests (top 5)

| Test | Duration |
|---|---|
| `nfr002.test.ts – NFR-002 frame budget` | 102ms (20-run benchmark harness, expected) |
| `INV-8 determinism + scale (N=1000)` | 18ms |
| all others | <5ms |

## Flaky candidates

None observed.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Next steps

- PASS: hand back to guardian for activation gate on RFC-028 and SPEC-004



