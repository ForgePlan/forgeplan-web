---
depth: standard
id: EVID-079
kind: evidence
last_modified_at: 2026-07-02T13:44:23.247138+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-035
  relation: informs
status: active
title: 'Test verification idef0 wave-2 UX: BLOCKER — vitest 446/447 (FIX-1 band-height fixture red), svelte-check 0/0'
---

# EVID-079: Independent test verification — idef0 wave-2 UX build

Independent post-build TEST verification of the idef0 wave-2 UX changes on
`feat/idef0-composed-map`, dispatched after the coder reported the wave done.
Verifier: `claude-code/2.0/tester-task-idef0-w2` (Profile B — runs and
reports, does not author or fix tests).

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: test

Rationale: CL3 — measurement against the actual surface (real vitest suite +
svelte-check on the exact worktree under review). `weakens` because PRD-035
SC-5 requires "vitest suite (413+) and svelte-check stay green" and the suite
is NOT green (1 failed test in the new wave-2 code).

## Verdict

**BLOCKER**

1/447 vitest tests failed; svelte-check 0 errors / 0 warnings (1136 files).
The failing test is the new FIX-1 band-height-growth assertion itself —
`idef0-layout.test.ts:807` — and it fails because its fixture is
mathematically incapable of producing the asserted inequality (see analysis).
SC-5 ("suite stays green") is violated; merge/activation must wait for a
coder fix of the test fixture.

## Ground-truth verification

- Base..head: `6f85604a981308a7a050251d1e94b1a8438c23ac..worktree` (source:
  changes are uncommitted worktree modifications on `feat/idef0-composed-map`;
  the dispatch's BUILD report block was empty, so base was resolved by the
  verifier from git directly)
- Diff probe: `git diff --stat HEAD -- template/` + `git diff --cached --stat`
  in a clean `bash --noprofile --norc` shell
- Diff state: **DELTA=PRESENT**
- Expected delta tokens: `cols`/wrap (band-WRAP geometry), visible-edge
  arrows (source: dispatch claim) — probe:
  `grep -niE "wrap|cols" idef0-layout.test.ts` → **FOUND**
  (FIX-1 describe block, lines 757–825);
  `grep -niE "visible|edge|arrow" idef0-layout.test.ts / idef0-view.render.test.ts`
  → **FOUND** (FIX-3 describe block)
- Verdict floor from ground-truth gate: precondition satisfied (real work
  landed; verdict driven by test results, not by delta absence)

Literal diff-probe output:

```
 .../dependency-graph/lib/idef0-layout.test.ts      | 178 ++++++++++++++++++++-
 .../widgets/dependency-graph/lib/idef0-layout.ts   | 106 +++++++++++-
 .../widgets/dependency-graph/ui/Idef0View.svelte   | 156 ++++++++++++++++--
 .../dependency-graph/ui/idef0-view.render.test.ts  | 159 ++++++++++++++++++
 4 files changed, 583 insertions(+), 16 deletions(-)
DELTA=PRESENT
```

## Runner detected

- Ecosystem: node (SvelteKit template app)
- Runner: vitest 4.1.5 (`template/package.json#scripts.test = "vitest run"`) +
  svelte-check (`scripts.check`)
- Output format: json (`--reporter=json`) + default text
- Config source: `template/package.json` scripts, `template/vitest.config.ts`
  (pool:'threads' — known macOS fork-limit mitigation)

## Commands run

```bash
cd /Users/explosovebit/Work/ForgePlanWeb/template
npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json --threshold warning
# → COMPLETED 1136 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS ; EXIT=0

npx vitest run --reporter=default --reporter=json --outputFile=<scratch>/vitest-results.json
# → Test Files 1 failed | 34 passed (35) ; Tests 1 failed | 446 passed (447) ; success:false

npx vitest run src/widgets/dependency-graph/lib/idef0-layout.test.ts
# → 1 failed | 51 passed (52) ; EXIT=1  (isolated re-run, failure deterministic)
```

Exit codes: svelte-check `0`; vitest full run `success:false` in JSON report
(shell exit masked by a tail pipe); vitest isolated re-run `1` (authoritative).

## Summary

| Metric | Value |
|---|---|
| Passed | 446 |
| Failed | 1 |
| Skipped | 0 |
| Flaky (passed on retry) | 0 (failure reproduced identically on re-run) |
| Total | 447 |
| Duration | 4.03 s (full suite) |
| svelte-check | 0 errors / 0 warnings / 1136 files |

## AC coverage delta

Parent: PRD-035
AC target: SC-5 — "vitest suite (413+) and svelte-check stay green"; no
coverage-% target stated.
Actual: 447 tests present (≥413 ✓ count grew), but suite RED (1 failure) ✗;
svelte-check green ✓.
Coverage %: n/a — AC silent on statement coverage; not gated.

## Failing tests

| File:line | Test name | Error (first line) |
|---|---|---|
| `template/src/widgets/dependency-graph/lib/idef0-layout.test.ts:807` | FIX-1: tier-stack band wrapping (cols parameter) › canvas height grows to accommodate multiple rows per band | `AssertionError: expected 320 to be greater than 320` |

Root-cause analysis (for the coder — verifier does not fix tests): the
fixture uses `sparseRaw(4)` (4 boxes). At `cols=3` → `ceil(4/3) = 2` rows; at
`cols=2` → `ceil(4/2) = 2` rows. Both configurations wrap to exactly 2 rows,
so both canvases are 320 px tall and `toBeGreaterThan` can never hold with
this fixture. The wrap machinery itself appears correct — the sibling FIX-1
test (4 boxes, cols=2 → 2×2 grid with row-1 y > row-0 y) passes. Fix is a
fixture change, e.g. 3 boxes (cols=3 → 1 row vs cols=2 → 2 rows) or 5–6 boxes
(2 vs 3 rows).

## Dispatched review points (test-content checks)

1. **Band-WRAP geometry asserted** — YES: FIX-1 block asserts cols-wrapping
   (same-y rows, same-x cols, monotone x/y growth) and band/canvas height
   growth. The height-growth assertion is the one RED test (defective
   fixture, above).
2. **Visible-edge tests non-vacuous** — PARTIAL:
   - "edge between two visible boxes emits exactly 1 arrow" — non-vacuous
     (`toHaveLength(1)`, provenance `real`, `headAtBox` true). PASSES.
   - "edge to a hidden (rolled-up) node emits 0 arrows" — name/body
     mismatch: body does NOT assert 0 arrows; comment admits "may be 0 or 1"
     and only asserts no arrow anchored at `__rollup__`. Weaker than the
     dispatched intent (edge to hidden node → 0). Non-blocking; should be
     tightened or renamed.
   - "arrow geometry (headAtBox)" — carries an
     `if (layout.arrows.length === 0) return;` escape; mitigated by the
     sibling length-1 test on the same fixture. Minor.
   - FIX-4 pointermove test asserts `scrollLeft >= 0` (always true) — vacuous
     by design with an explicit `TODO(pointer-capture-happydom)` marker
     deferring to Playwright E2E; acceptable under the comments policy, noted
     for the record.
3. **Determinism / bounded assertions NOT weakened** — CONFIRMED: diff is
   additive (+583/−16); the only two modified existing tests kept identical
   assertions (signature adaptation for the new `classifiedEdges` param:
   "emits 0 arrows" renamed to "…when no classifiedEdges passed", same
   `toHaveLength(0)` + mode check; `fakeStack` call gained explicit `[]`).
   INV-8 determinism @N=1000 and bounded ≤7-boxes (SPEC-005 NFR-001) tests
   remain present and green. A NEW wrapped-layout determinism test (L-2) was
   added.

## Slow tests (top 5)

| Test | Duration |
|---|---|
| NFR-002 frame budget deriveIdef0 at N=1000 | 310 ms |
| INV-8 determinism + scale (N=1000) | 55 ms |
| SPEC-005 permanent ICOM legend (RC-4) tier-stack fallback | 30 ms |
| bounded box-count at N≥1000 (NFR-001, ≤7 boxes) | 23 ms |
| /api/snapshot forwards error_code and stderr_excerpt | 19 ms |

## Flaky candidates

None — the single failure is a deterministic assertion (320 vs 320),
reproduced byte-identically on isolated re-run.

## Audit trail

- Verifier identity: `claude-code/2.0/tester-task-idef0-w2`
- PRD-035 claim at run time was held by
  `claude-code/2.x/code-reviewer-task-idef0-wave2-ux` (parallel reviewer);
  per rule 12 this verifier did NOT contest the claim — verification is
  read-only against source, and this EVID is a new artifact linked
  `informs`, the standard concurrent-evidence pattern.

## Next steps

- BLOCKER: hand to coder to fix the FIX-1 fixture at
  `template/src/widgets/dependency-graph/lib/idef0-layout.test.ts:777-808`
  (use a box count where cols=2 and cols=3 yield different row counts).
- CONCERNS (same coder pass): tighten or rename the FIX-3 "edge to a hidden
  node emits 0 arrows" test so the name matches the assertion.
- After fix: re-run `npx vitest run` (expect 447/447) → re-verify → then
  guardian activation gate for PRD-035 wave-2.

