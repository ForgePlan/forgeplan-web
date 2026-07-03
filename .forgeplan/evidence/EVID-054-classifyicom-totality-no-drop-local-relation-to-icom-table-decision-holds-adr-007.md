---
depth: standard
id: EVID-054
kind: evidence
last_modified_at: 2026-07-01T13:02:14.333107+00:00
last_modified_by: claude-code/2.1.196
links:
- target: ADR-007
  relation: informs
status: active
title: classifyIcom totality/no-drop — local relation-to-ICOM table decision holds (ADR-007)
---

## Verdict

**PASS**

`classifyIcom` is total across all canonical relations: `informs`→mechanism, `refines`→decomposition, `based_on`→input (non-null). Contrasted against `normaliseHierarchyEdge("x","y","based_on")===null` — the shared utility drops `based_on`; the local ICOM table does not. The ADR-007 decision to use a local relation→ICOM table (rather than the shared edge normaliser) is verified correct by test execution.

## Ground-truth verification

- Base..head: `03f6457469b01e33b30d3da76a5186ee4bbc353b..54a905c862b542f14a2c5929aa44f450c63ffd21` (source: merge-base origin/main)
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb diff --stat 03f6457..54a905c`
- Diff state: **DELTA=PRESENT** (96 files changed, 7226 insertions(+), 199 deletions(-))
- Expected delta token: `classifyIcom` in `template/src/shared/lib/idef0/`
- Token probe: `grep -rn "classifyIcom" template/src/shared/lib/idef0/` → **FOUND** (idef0.test.ts lines 9, 57, 229–234)
- Verdict floor from ground-truth gate: **PASS-eligible**

```
BASE=03f6457469b01e33b30d3da76a5186ee4bbc353b
HEAD=54a905c862b542f14a2c5929aa44f450c63ffd21
96 files changed, 7226 insertions(+), 199 deletions(-)
DELTA=PRESENT

grep hit: idef0.test.ts:9  import { classifyIcom }
grep hit: idef0.test.ts:57 expect(classifyIcom("informs")).toBe("mechanism")
grep hit: idef0.test.ts:229 describe("Scenario: classifyIcom case-per-relation incl. based_on (INV-3)")
grep hit: idef0.test.ts:231 expect(classifyIcom("refines")).toBe("decomposition")
grep hit: idef0.test.ts:232 expect(classifyIcom("informs")).toBe("mechanism")
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
| Passed | 29 (total suite) |
| Failed | 0 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 |
| Total | 29 |
| Duration | ~304ms |

## classifyIcom totality evidence (ADR-007 scope)

The covering test is `Scenario: classifyIcom case-per-relation incl. based_on (INV-3)` in `idef0.test.ts`.

**Assertions exercised:**

| Relation | classifyIcom result | ICOM role | Notes |
|---|---|---|---|
| `informs` | `"mechanism"` | mechanism | ✓ non-null |
| `refines` | `"decomposition"` | decomposition | ✓ non-null |
| `based_on` | `"input"` | input | ✓ non-null — the critical no-drop case |
| `supersedes` | defined, non-null | (role per table) | ✓ defined |
| `contradicts` | defined, non-null | (role per table) | ✓ defined |
| unknown relation | defined (derived, non-structural) | default | tested in `E-UNKNOWN-RELATION` |

**Contrast with `normaliseHierarchyEdge`:**

The shared utility `normaliseHierarchyEdge("x","y","based_on")` returns `null` — it intentionally does not treat `based_on` as a structural hierarchy edge. `classifyIcom` maps `based_on`→`"input"` (non-null). This asymmetry is the core rationale for ADR-007's decision: using the shared normaliser from the IDEF0 view would silently drop `based_on` arrows, producing an incomplete ICOM diagram. The local table preserves all arrows with correct semantic roles.

**Verbatim test output for this scenario:**

```
✓ src/shared/lib/idef0/idef0.test.ts > Scenario: classifyIcom case-per-relation incl. based_on (INV-3)
  > every canonical relation gets a defined class; based_on is not dropped 0ms
```

## AC coverage delta

Parent: ADR-007
AC target: n/a — AC silent on explicit coverage %
Actual: classifyIcom totality verified (all canonical relations → non-null ICOM class); based_on no-drop confirmed
Delta: n/a

## Failing tests

None.

## Slow tests (top 5)

| Test | Duration |
|---|---|
| `nfr002.test.ts – NFR-002 frame budget` | 102ms (benchmark, expected) |
| `INV-8 determinism + scale (N=1000)` | 18ms |
| `classifyIcom INV-3 scenario` | 0ms |
| all others | <5ms |

## Flaky candidates

None observed.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Next steps

- PASS: hand back to guardian for activation gate on ADR-007

