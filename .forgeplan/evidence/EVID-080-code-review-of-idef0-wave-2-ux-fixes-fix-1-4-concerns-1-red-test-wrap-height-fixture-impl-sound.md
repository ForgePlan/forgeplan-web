---
depth: standard
id: EVID-080
kind: evidence
last_modified_at: 2026-07-02T13:44:23.812060+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-035
  relation: informs
status: active
title: 'Code review of idef0 wave-2 UX fixes (FIX 1-4): CONCERNS — 1 red test (wrap-height fixture), impl sound'
---

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit

## Verdict

**CONCERNS**

One-line justification: all four fixes are implemented correctly and every frozen invariant holds, but the branch's test suite is red — one new FIX-1 test (`canvas height grows to accommodate multiple rows per band`) uses a fixture that cannot discriminate cols=2 vs cols=3 (4 boxes wrap to 2 rows under both) and fails 320 ≯ 320.

## Scope

- Parent: PRD-035 (idef0 view design-excellence pass)
- Diff range: `6f85604` (HEAD, feat/idef0-composed-map) .. working tree
- Files reviewed: 4 files, ~583 insertions / 16 deletions
- Files: `template/src/widgets/dependency-graph/lib/idef0-layout.ts`, `template/src/widgets/dependency-graph/lib/idef0-layout.test.ts`, `template/src/widgets/dependency-graph/ui/Idef0View.svelte`, `template/src/widgets/dependency-graph/ui/idef0-view.render.test.ts`
- User-reported symptoms addressed: unclickable canvas (FIX-2/4), cards cut off right + no scroll affordance (FIX-1/4), no edges (FIX-3)

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| vitest (2 touched files) | 1 | **1 failed / 84 passed** — `idef0-layout.test.ts:807` AssertionError: expected 320 to be greater than 320 |
| svelte-check (`npm run check`) | 0 | 1136 files, 0 errors, 0 warnings |
| token-fidelity grep (hex/rgb/hsl on added lines) | 0 | NO raw colors — only `var(--line-3)`, `var(--bg-1)`, `var(--fg-4)`, `var(--accent)`, `var(--shadow-mini)` |
| rule-24 grep (new `:global` additions) | 0 | NO new `:global` selectors in the diff |
| core-untouched probe (`git diff --stat -- template/src/shared/lib/idef0`) | 0 | empty — TADD core untouched |
| eslint | n/a | template has no eslint config wired; svelte-check covers |

## Ground-truth verification

- Base..head: `6f85604a981308a7a050251d1e94b1a8438c23ac`..working tree (source: dispatch = uncommitted wave-2 build)
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb diff HEAD --stat -- template/src`
- Diff state: **DELTA=PRESENT** (4 files, 583 insertions, 16 deletions)
- Expected delta tokens (from claim): `classifiedEdges` param on `layoutTierBands`, `buildTierArrow`, `onPanDown`/`canvas-panning`, `col = i % cols` wrap → all **FOUND** in diff hunks read verbatim
- Verdict floor from ground-truth gate: PASS-eligible (delta present + tokens found); floor raised to CONCERNS by the red test

```
feat/idef0-composed-map @ 6f85604
 .../dependency-graph/lib/idef0-layout.test.ts      | 178 ++++++++++++++++++++-
 .../widgets/dependency-graph/lib/idef0-layout.ts   | 106 +++++++++++-
 .../widgets/dependency-graph/ui/Idef0View.svelte   | 156 ++++++++++++++++--
 .../dependency-graph/ui/idef0-view.render.test.ts  | 159 ++++++++++++++++++
 4 files changed, 583 insertions(+), 16 deletions(-)
DELTA=PRESENT

vitest: Test Files 1 failed | 1 passed (2); Tests 1 failed | 84 passed (85)
FAIL idef0-layout.test.ts > FIX-1 > canvas height grows to accommodate multiple rows per band
AssertionError: expected 320 to be greater than 320  (line 807)
```

Note: the dispatch's `--- BUILD ---` report block was empty — the worker transcript carried no test claim to trust; all results above are first-hand.

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| 1 | HIGH | 🧪 Test gap | `template/src/widgets/dependency-graph/lib/idef0-layout.test.ts:807` | Red test on branch: fixture `sparseRaw(4)` yields `ceil(4/3)=2` rows at cols=3 AND `ceil(4/2)=2` rows at cols=2 — heights identical (320=320), so `toBeGreaterThan` fails; CI/merge is blocked | Use `sparseRaw(6)` (2 rows vs 3 rows) or compare `cols: 4` vs `cols: 2` with 4 boxes |
| 2 | MEDIUM | 📚 Docs | `template/src/widgets/dependency-graph/ui/Idef0View.svelte:177` | Stale comment (rule 10): "In tier-stack mode arrows are suppressed; this badge is the only evidence-signal on canvas" — false after FIX-3 renders tier-stack edges | Update comment to reflect FIX-3 visible-pair arrows |
| 3 | LOW | 🐛 Bug | `template/src/widgets/dependency-graph/lib/idef0-layout.ts:451` | Inconsistent cols≤0 guard: `rowsUsed` guards `cols > 0` but `i % cols` (l.455) and `Math.floor(i / cols)` (l.456) don't — `cols: 0` via the exported `Partial<BoxGeom>` yields NaN box coordinates (unreachable from view: adaptiveGeom cols ∈ {2,3,4}) | Clamp once: `const safeCols = Math.max(1, cols)` and drop the half-guard |
| 4 | LOW | 🐛 Bug | `template/src/widgets/dependency-graph/lib/idef0-layout.ts:495` | Fan-out slot key is directed (`from>to`): antiparallel edges A→B and B→A both get slot 0 and render as exactly-overlapping segments with an arrowhead at each end — direction ambiguity for reciprocal pairs (e.g. mutual `contradicts`) | Use an undirected pair key (sorted serials) for the slot counter, or offset by direction sign |

## Verified-correct (per review dimensions)

- **(a) FIX-1 wrap math**: `col = i % cols`, `row = floor(i/cols)`, `rowsUsed = ceil(n/cols)` — exactly `cols` boxes stay in 1 row (no off-by-one); band stride `rowsUsed*(boxH+gapY)+BAND_GAP` degenerates to the previous formula for single row; `BandInfo.y` = first-row top preserved, header still placed at `y − BAND_HEADER_H − 8` (Idef0View.svelte:514); determinism regression test included and passing.
- **(b) FIX-2 honesty**: derived box became `<button type="button">` firing `onSelect` only — no `drillInto` call; `isDrillable` untouched (`provenance === "real"` still required); dashed border + `≈` + "(derived)" aria kept; `role="img"` correctly dropped; rollup branch untouched (inert div, "↑ outline"); render test asserts breadcrumb stays absent on derived click.
- **(c) FIX-3 edges**: arrows emitted only when BOTH endpoints resolve in `boxBySerial` (`if (!fromBox || !toBox) continue` — no fallback anchor, unlike idef0 mode); provenance real→solid `var(--line-3)` / derived→dashed `var(--fg-4)` with distinct markers; slot fan-out per directed pair (see finding #4); O(N+E) via Map — no O(E×N); `layoutTierBands` stays pure (new param defaults `[]`, no mutation); `classifyEdges` maps canonical relations → real (test: informs → real ✓).
- **(d) FIX-4 pan**: `onPanDown` early-returns for `button` / `.band-header` targets — box clicks never stolen; >3px drag suppresses the follow-up click via container-level `stopPropagation` (click retargets to the capture element, so child handlers never fire post-drag); `releasePointerCapture` on pointerup AND pointercancel, guarded by `isPanning`; scrollbar styling token-only.
- **(e) Frozen invariants**: bounded DOM (no new per-artifact boxes; arrows bounded by visible-pair filter), token fidelity (0 raw colors in added lines), rule 24 (0 new `:global`), TADD core untouched (empty diff on `template/src/shared/lib/idef0`).

## Positive observations

- Backward-compatible API evolution: `classifiedEdges` as a defaulted parameter keeps every pre-existing call site and test green without churn (`idef0-layout.ts:408`).
- FIX-4's `target.closest("button")` exclusion at pointerdown is the right non-stealing design — interactive children keep native semantics, pan owns only dead canvas (`Idef0View.svelte:283`).
- Honesty discipline is actively tested, not just preserved: the render test asserts `breadcrumb` absence after derived-box click — a regression tripwire for future drill creep.
- Wave-3 edge-density risk is pre-declared as `TODO(wave3-edge-focus)` with an explicit bound argument (rule-10 compliant cut-corner marker).

## Test coverage delta

- Before: 2 touched files had 0 coverage of wrap, tier-edges, pan, derived-click paths
- After: +13 tests (FIX-1 ×4, FIX-3 ×4, FIX-2 ×3, FIX-4 ×4 — 1 failing per finding #1)
- Branches still uncovered: antiparallel-edge slot overlap (finding #4), cols≤0 NaN path (finding #3), click-suppression >3px threshold behavior (only class toggling is asserted)

## Next steps

- Dispatch coder for finding #1 (one-line fixture fix — unblocks CI), fold in #2 (comment update) in the same commit; #3/#4 are optional hardening for wave 3
- Re-run `npx vitest run` on the two files; expect 85/85 → then PASS-eligible

## References

- Parent: PRD-035 (informs)
- Related: RFC-029 (layout invariants L-1…L-4), SPEC-005 (honest-tier-stack-fallback), EVID-061 (F1 bounded-DOM invariant), EVID-075 (prior review round)
- Reviewer identity: claude-code/2.x/code-reviewer-task-idef0-wave2-ux


