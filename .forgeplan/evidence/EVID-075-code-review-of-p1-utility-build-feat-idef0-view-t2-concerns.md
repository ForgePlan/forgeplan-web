---
depth: standard
id: EVID-075
kind: evidence
last_modified_at: 2026-07-02T12:28:33.323882+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-035
  relation: informs
status: active
title: 'Code review of P1 utility build (feat/idef0-view-t2): CONCERNS'
---

## Verdict

CONCERNS

One-line justification: implementation is brief-faithful and mechanically sound, but two medium findings (false-bad initial render state when scores not yet loaded; rollup-coverage invariant claimed but not exercised by tests) require resolution before the PR merges.

## Scope

- Parent: PRD-035
- Reviewer identity: claude-code/sonnet-4-6/code-reviewer-task-idef0-p1-util
- Diff range: working-tree HEAD at e2538c4 (unstaged working-tree modifications)
- Files reviewed: 3 files (build report cited 2; score/+server.ts also modified)
- Files:
  - `template/src/widgets/dependency-graph/ui/Idef0View.svelte` (+238/-29)
  - `template/src/widgets/dependency-graph/ui/idef0-view.render.test.ts` (+163)
  - `template/src/routes/api/score/+server.ts` (+63/-29)

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| svelte-check | 0 | reported by build agent (0/0 PASS) |
| vitest | 0 | 430 passed across 35 files (build agent); 24 new P1 tests included |
| tsc --noEmit | n/a | not run directly; svelte-check covers .svelte TS; .ts server files not explicitly re-run |
| eslint | skipped | not installed in review env |
| hex/rgb grep | 0 | no raw color literals in CSS additions — all via CSS tokens |
| rule-24 :global grep | 0 | no :global() selectors in diff |
| rule-22 subcommand grep | 0 | score/+server.ts still only calls `["score", "--all", "--json"]` |
| rule-23 bin-deps grep | n/a | no bin/ files changed |

## Ground-truth verification

- Base..head: `54a905c..e2538c4` (source: `git merge-base HEAD origin/develop`)
- Branch: `feat/idef0-view-t2`
- Diff probe: `git diff HEAD --stat -- template/src`
- Diff state: **DELTA=PRESENT** (3 files, 435 insertions, 29 deletions)
- Expected delta tokens:
  - `scoreById` → `grep -n "scoreById" Idef0View.svelte` → FOUND (lines 160, 201, 470, 472)
  - `mechanismCount` → FOUND (lines 165, 471, 569)
  - `bandAggregates` → FOUND (lines 189, 433)
  - `reff-warn` class → FOUND (lines 478, 1367)
  - `drill-affordance` → FOUND (lines 537, 1434)
- Verdict floor from ground-truth gate: PASS-eligible (DELTA=PRESENT, all tokens FOUND)

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| 1 | MEDIUM | Bug | `Idef0View.svelte:470-479` | `reffTone(undefined)` returns `'bad'`, so when `scores = []` (default before first poll), ALL real boxes render with `reff-bad` (red border) — a false signal on initial load before any score data arrives | Guard the tone: apply `reff-bad` only when `scoreById.has(box.key.id) && tone === "bad"`, so unscored boxes carry no tone class |
| 2 | MEDIUM | Test gap | `idef0-view.render.test.ts:335-345` | P1-B brief guarantees bandAggregates covers ALL tier members including rollup-hidden ones; SPARSE_NODES has 1 node per tier so no rollup fires — the `tier.members` vs `nodes.filter(kind)` distinction is never exercised | Add fixture with 7+ nodes in one tier, verify aggregate `total` exceeds 6 and equals full member count including rollup items |
| 3 | LOW | Bug | `Idef0View.svelte:244-251` | Space key on the outer box `<button>` drills (via `handleBoxKey` Enter+Space arm) rather than inspecting — inconsistent with mouse click which now only fires `onSelect`; aria-label says "Click to inspect. Press Enter to drill in." but Space is not mentioned | Exclude Space from the drill arm in `handleBoxKey` (let the synthetic click fire `onSelect` instead), or amend aria-label to include Space under "inspect" |
| 4 | LOW | Test gap | `idef0-view.render.test.ts:221-234` | Drill-affordance click test checks breadcrumb presence but does not assert `onSelect` was called exactly once (it is called once via `drillInto`, not via the parent button), nor that the `id` in the payload is correct | Add `expect(onSelect).toHaveBeenCalledOnce()` and assert `.toMatchObject({ id: expect.any(String) })` in the drill affordance test |
| 5 | LOW | Architecture | `Idef0View.svelte:531-549` | `<span role="button" tabindex="0">` nested inside `<button>` — real-browser tab order inside `<button>` is undefined per HTML spec; screen readers may double-announce role; JSDOM tests pass but cross-browser behavior is not verified; code comment acknowledges this | Consider positioning the drill affordance as a sibling `<button>` overlay (z-index, same container) rather than a child of the box button; or carry in backlog with the existing code comment |

## Positive observations

1. **Reactive chain correctness**: `$derived` / `$derived.by` chain for `scoreById → mechanismCount → bandAggregates` is clean. No stale closures; dependencies (nodes, edges, scores) tracked correctly by the Svelte 5 runes system — these maps recompute on every poll cycle.
2. **Token-only CSS discipline**: verified zero hex/rgb/hsl literals in all new style additions. Every color reads from CSS tokens (`--accent`, `--bad`, `--fg-2`, `--fg-4`, `--bg-3`, `--line-2`). Rule 24 clean. Dual-theme (data-theme) compliance maintained.
3. **tierStack.tiers approach rationale**: code comment precisely names the invariant ("canonical tier partition covers ALL members including rollup") and explains why `nodes.filter(kind)` would break for future multi-kind bands. Sound design, well-documented.
4. **stopPropagation isolation**: drill affordance correctly calls `e.stopPropagation()` before `drillInto`, preventing the parent button's `onSelect`-only handler from also firing. Event routing between the two interactive surfaces is correct.
5. **prefers-reduced-motion coverage**: `transition: none` applied to `.drill-affordance` inside the reduced-motion media query, consistent with the rest of the component.

## Brief fidelity check (P1-A..D)

| Item | Fidelity | Notes |
|---|---|---|
| P1-A: R_eff signal on boxes | Partial | `reffTone` + CSS tone classes correctly wired; MEDIUM finding #1 re: undefined-to-bad initial state |
| P1-B: per-band aggregate strip | Implemented | `tierStack.tiers` membership approach correct; MEDIUM finding #2 re: rollup coverage not tested |
| P1-C: mechanism badge | Implemented | `informs`-edge count per artifact; M:N / dim-dot rendering; both real and derived boxes |
| P1-D: select-vs-drill split | Implemented | `onclick` = `onSelect`; Enter = `handleBoxKey` → `drillInto`; drill affordance with `stopPropagation`; LOW findings #3 (Space) and #4 (test assertions) |

## Frozen invariants (SC-5 do-no-harm gate)

- Honesty layers (real solid / derived dashed): no changes to outline or diagram structural logic — INTACT
- Bounded DOM (<=6+rollup): box rendering loop is unchanged — INTACT
- Token-only theming: no raw colors in new CSS — INTACT
- WCAG-AA contrast: new `.mech-badge` (8px monospace) is decorative/supplementary; `.drill-affordance` (24x24px, focus-visible ring) meets target size — INTACT
- Rule 22 (read-only proxy): score/+server.ts still only calls `score --all --json` — INTACT
- Rule 24 (shared/ui ownership): no :global() selectors, no primitive re-skin — INTACT

## Test coverage delta

- Before: 318 tests (per build agent session context)
- After: 430 tests (build agent, 35 files)
- New P1 tests: 12 (P1-A: 4, P1-B: 3, P1-C: 2, P1-D: 3)
- Branches gained: reff-warn tone, reff-bad tone, good-tone (no class), band active/draft/stale/no-evidence aggregates, mechanism badge M:N / empty, drill affordance click, Enter drill, click inspect
- Branches still uncovered: rollup-member-in-aggregate (finding #2); drill affordance onSelect payload (finding #4); Space key behavior (finding #3)

## Next steps

- Dispatch coder for findings #1 (false-bad initial state guard) and #2 (rollup coverage fixture) — pre-merge requirements
- Findings #3, #4, #5 may be deferred to a follow-up note if ship velocity warrants
- Re-review the patched diff once #1 and #2 are resolved (fast re-review: only the guard logic and new fixture need checking)

## References

- Parent: PRD-035
- Reviewed branch: `feat/idef0-view-t2` @ `e2538c4`
- Related EVIDENCE: EVID-061 (design pass proof, informs PRD-035)
- Related SPEC: SPEC-005 (frozen render invariants, do-no-harm bar)

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

