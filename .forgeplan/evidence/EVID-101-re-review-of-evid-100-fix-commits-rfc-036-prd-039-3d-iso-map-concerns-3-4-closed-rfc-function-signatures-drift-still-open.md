---
depth: standard
id: EVID-101
kind: evidence
last_modified_at: 2026-07-08T10:17:43.378163+00:00
last_modified_by: claude-code/2.1.202
links:
- target: RFC-036
  relation: informs
- target: PRD-039
  relation: informs
status: draft
title: 'Re-review of EVID-100 fix commits (RFC-036/PRD-039 3D iso-map): CONCERNS — 3/4 closed, RFC Function-Signatures drift still open'
---

## Verdict

CONCERNS

One-line justification: the two HIGH findings (the sync-drop race and the zero-test-coverage gap) are genuinely, non-vacuously closed — a real `pendingExternal` retry mechanism plus 16 passing tests that exercise the exact mid-animation race — and the MEDIUM WebGL-boundary gap is closed with a real `<svelte:boundary>`; but the fourth EVID-100 finding (RFC-036/code drift) is only 3/4 closed — RFC-036's own "Function Signatures / Component Contracts" section still documents `descend()`, `ascend()`, `setDepth()`, `toggleVisible()`, `hidden` as `shared-drill-bus` methods that do not exist in the shipped module, and the fix's own new source comment explicitly defers correcting the RFC document itself ("that is Profile A/B territory... not this coder change").

## Scope

- Parent: RFC-036 (`based_on` PRD-039), companion ADR-011; re-reviewing EVID-100's CONCERNS verdict
- Diff range: `0f1ffed..HEAD` (`3bd0a4d` fix commit + `3e948dd` test commit, on `feat/idef0-3d-iso-view`) — the two fix commits landed after EVID-100
- Files reviewed: 26 files, 418 insertions / 104 deletions (per `git diff --stat`), plus a fresh `forgeplan_get RFC-036` read of the artifact body itself
- Files: `template/src/widgets/iso-map/model/iso-view-state.svelte.ts`, `template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts` (+ new `.test.ts`), `template/src/widgets/iso-map/model/iso-view-state.render.test.ts` (new), `template/src/widgets/composed-map/ui/ComposedMapView.svelte`, `template/src/widgets/iso-map/ui/IsoMinimap.svelte`, `template/src/widgets/dependency-graph/ui/IsoMapCorner.svelte`, `template/src/widgets/iso-map/IsoScene.svelte`, 13× `widgets/iso-map/{ui,lib}/*` (TODO dedup), `template/src/widgets/iso-map/index.ts`, `template/vite.config.ts`

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| `npx vitest run shared-drill-bus iso-view-state.render` | 0 | 2 test files, 16/16 passed |
| `npx vitest run` (full suite) | 0 | 62 test files, 798/798 passed — no regression from the fix |
| `npx svelte-check --threshold error` | 0 | 2346 files, 0 errors, 8 warnings (same 2 pre-existing files as EVID-100, unrelated to this diff) |
| `npm run build` | 0 | `dist/` 3.29M, `dist-nightly/` 3.29M — both under the 3.5 MiB cap |
| `grep setSharedFocusChain template/src/` | 1 (no matches) | confirms the rename to `focusTo` left no orphan references |
| `grep -c -iE "BufferGeometry\|WebGLRenderer\|Object3D\|from ['\"]three" dist/index.js` | — | 0 — SSR three-exclusion invariant (INV-A/ADR-011 INV-1) still holds after the fix |

## Ground-truth verification

- Base..head: `0f1ffed..HEAD` (source: task-provided — `0f1ffed` is the pre-fix sync commit, `HEAD` = `3e948dd`)
- Diff probe: `git diff 0f1ffed..HEAD --stat -- template/` → **DELTA=PRESENT** (26 files, 418 insertions(+), 104 deletions(-))
- Expected delta tokens (derived from EVID-100's own recommended fixes): `pendingExternal` (Finding #1 fix), `svelte:boundary` (Finding #3 fix), `shared-drill-bus.svelte.test.ts` + `iso-view-state.render.test.ts` (Finding #2 fix) → all **FOUND** in the diff
- Verdict floor from ground-truth gate: PASS-eligible (diff present, all expected tokens found, invariants hold under a real build) — the CONCERNS verdict below is about one specific finding remaining open, not about whether the fix commits landed

```
$ git diff 0f1ffed..HEAD --stat -- template/ | tail -3
 template/vite.config.ts                            |  56 +++++---
 26 files changed, 418 insertions(+), 104 deletions(-)

$ cd template && npx vitest run shared-drill-bus iso-view-state.render
 Test Files  2 passed (2)
      Tests  16 passed (16)

$ npx vitest run   # full suite
 Test Files  62 passed (62)
      Tests  798 passed (798)

$ npx svelte-check --threshold error
1783505732569 COMPLETED 2346 FILES 0 ERRORS 8 WARNINGS 2 FILES_WITH_PROBLEMS

$ npm run build
[build] dist/ ready (3.29M, image=stable, features=0)
[build] dist-nightly/ ready (3.29M, image=nightly, features=0)

$ grep -c -iE "BufferGeometry|WebGLRenderer|Object3D|from ['\"]three" dist/index.js
0

$ grep -rn "setSharedFocusChain" template/src/ ; echo "exit: $?"
exit: 1
```

## Per-finding closed/open status (against EVID-100)

| EVID-100 # | Severity | Category | Status | Evidence |
|---|---|---|---|---|
| #1 sync-drop race | HIGH | 🐛 Bug | **CLOSED** | `iso-view-state.svelte.ts:112-140` adds a module-level `pendingExternal` slot + an `$effect.root` watcher that fires when `animationKind` settles to `null` and a pending target exists; `applyExternalFocusChain` (lines ~434-465) now records into `pendingExternal` instead of silently returning when `animationKind !== null`, and clears it before re-invoking itself (idempotent, no re-entrant loop). `iso-view-state.render.test.ts` exercises exactly the race: an update arrives mid-animation ("must NOT yet show ext-b"), then asserts convergence to the LATEST chain (`["ext-a","ext-b"]`) once `currentAnimationKind()` returns to `null` — this is a real assertion of the fix's actual behavior, not a tautology. |
| #2 test-gap | HIGH | 🧪 Test gap | **CLOSED** | 16 new tests across `shared-drill-bus.svelte.test.ts` (11 tests: `chainsEqual`, reducer idempotence incl. array-identity-vs-content, bidirectional-sync contract, echo-does-not-refire loop guard) and `iso-view-state.render.test.ts` (3 tests: root-ascend no-op, mid-animation convergence, post-convergence idempotence). Ran via `npx vitest run` — 16/16 pass, non-vacuous (real ordering assertions, real reference-identity checks, not `expect(true).toBe(true)`-style padding). The `.render.test.ts` split (dom/happy-dom project) vs `.test.ts` (node/unit project) is deliberate and documented — `$effect` is a no-op under the node transform, so the retry mechanism genuinely needs the browser-conditioned project to execute for real. |
| #3 WebGL boundary | MEDIUM | 🐛 Bug | **CLOSED** | `IsoMapCorner.svelte:34-40` wraps `<mod.IsoMinimap />` in `<svelte:boundary>` with a `failed` snippet rendering `"3D minimap unavailable"` — now catches a post-import render/mount failure (e.g. WebGL context creation failing inside `<Canvas>`), complementing the existing `{:catch}` for import-rejection. Degrades to the same UI state as the import-failure path; the flat 2D map stays unaffected either way. |
| #4 doc/RFC drift (bucket of 4 sub-findings in EVID-100: #4 stale spike comment, #5 TODO(iso-promote) dedup, #6 phantom TODO(iso-draco-basis), #7 RFC Function-Signatures mismatch) | LOW–LOW/MED | 📚 Docs | **PARTIALLY CLOSED (3/4)** | Stale "throwaway spike" comment: **removed** (`IsoScene.svelte`). `TODO(iso-promote)` dedup: **done** — single canonical copy at `widgets/iso-map/index.ts:1-6`, all ~13 other files' copies stripped, `lib/motion.ts` now points at the canonical copy instead of repeating it. `TODO(iso-draco-basis)` marker: **added** at `template/vite.config.ts`'s alias definition, matching what RFC-036 already claimed existed. **RFC-036 Function-Signatures mismatch: NOT CLOSED.** `forgeplan_get RFC-036` shows the body unchanged since before the fix — the "Function Signatures / Component Contracts" section still documents `descend(zoneId)`, `ascend()`, `visibleDepth`/`setDepth(levels)`, `hidden`/`toggleVisible()` as `shared-drill-bus` methods. The shipped module (`shared-drill-bus.svelte.ts`) exports only `sharedFocusChain()`, `focusTo()` (renamed from `setSharedFocusChain` to match the RFC's name for that one function), and `chainsEqual()` — depth/visibility remain local-only state inside `iso-view-state.svelte.ts`, never on the bus, exactly as EVID-100 found. The fix adds a substantial new code comment (`shared-drill-bus.svelte.ts:16-38`) explaining the gap and stating "RFC-036's Function Signatures section still needs a follow-up edit to reflect this; that is Profile A/B territory (ADR/RFC ownership), not this coder change" — i.e. the drift is now *documented in code* but the actual forgeplan artifact other engineers/agents will read (RFC-036 itself) still overstates the implemented contract. |

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| 1 | LOW | 📚 Docs | `.forgeplan/rfcs/RFC-036-*.md` §"Function Signatures / Component Contracts" vs. `template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts:41-90` | Carried forward from EVID-100 Finding #7, only partially addressed: the RFC still documents `descend()`, `ascend()`, `visibleDepth`/`setDepth()`, `hidden`/`toggleVisible()` as bus methods; only `focusTo`/`sharedFocusChain` exist. The code now explains the gap in a comment but the RFC document itself was never edited, so the artifact remains an inaccurate contract reference for any future reader (including another agent scoping graduation work off the RFC). | Dispatch a Profile A/D agent (`adr-architect` or `artifact-maintainer`) to update RFC-036's Function Signatures section via `forgeplan_update` to reflect the actual 3-function bus contract, noting depth/visibility are intentionally local-only — the shared-drill-bus.svelte.ts comment already states the correct content, it just needs to land in the RFC body. |

## Positive observations

- The `pendingExternal` retry mechanism is a clean, minimal fix for a genuinely subtle race: it reuses the existing `animationKind` state as the single trigger condition, stores at most one pending target (not a queue — correctly modeling "always converge to latest," not "replay every intermediate step"), and is proven idempotent by test (`is idempotent once converged` — no animation, no state churn on a no-op reconciliation).
- The test split between `.test.ts` (node/unit) and `.render.test.ts` (dom/happy-dom) is a well-reasoned, explicitly-documented engineering call — the comment block in both files states *why* `$effect` needs the browser-conditioned project, backed by an empirical claim ("verified empirically: a minimal `$effect.root` repro in 'unit' never ran its effect body"). This is exactly the kind of test-infrastructure judgment that prevents a future contributor from "fixing" the split by merging the files and silently losing coverage of the real mechanism.
- The `shared-drill-bus.svelte.ts` comment explaining the RFC/code naming and scope mismatch (lines 16-38) is honest and precise about what it does NOT do ("that is Profile A/B territory... not this coder change") — this is the right instinct (a Profile C-coder correctly declining to touch a forgeplan artifact), it just means the loop isn't closed yet and needs an explicit follow-up dispatch rather than being silently treated as done.

## Test coverage delta

- Before (EVID-100): 0% — zero test files for `shared-drill-bus.svelte.ts` or `iso-view-state.svelte.ts`'s external-sync path
- After: 16 new tests across 2 files — reducer idempotence, bidirectional-sync contract, echo-loop-guard (11 tests), mid-animation convergence + post-convergence idempotence (3 tests) + root-ascend no-op (1 test) in the render suite
- Branches gained: sync-drop-race retry path (Finding #1's exact failure mode), bus reducer idempotence, cross-reader single-source-of-truth
- Branches still uncovered: `IsoMapCorner`'s new `<svelte:boundary>` `failed` path (no test forces a render-time WebGL failure to confirm the boundary actually degrades — Finding #3's fix is verified by code-reading, not by an automated failure-injection test, matching RFC-036's own "Honest-fallback failure injection" Test Strategy Hook which remains unautomated)

## Next steps

- Dispatch a Profile A/D agent to close the one remaining item: update RFC-036's Function Signatures section (via `forgeplan_update`, not direct file edit) to match the shipped 3-function `shared-drill-bus` contract.
- Optional, not blocking: an automated failure-injection test for `IsoMapCorner`'s new `<svelte:boundary>` (force a WebGL init throw and assert the `failed` snippet renders) would close RFC-036's own "Honest-fallback failure injection" Test Strategy Hook, currently verified only by code inspection.
- Once the RFC update lands, this is ready for the `guardian` pre-activation gate — no functional blockers remain; full test suite (798/798) and build (3.29M/3.5M cap) are green.

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

## References

- Parent: RFC-036 (`based_on` PRD-039), companion ADR-011
- Supersedes-in-spirit: EVID-100 (this re-review confirms 3 of its 4 findings closed; the 4th — RFC/code drift on Function Signatures — remains open under a narrower scope than EVID-100 originally found, since 3 of its 4 sub-items are now closed)
- Related ADR: ADR-011 (ship three.js+Threlte lazy chunk; cap 3→3.5 MiB) — this review's build check reconfirms the cap holds (3.29M/3.5M) and the SSR three-exclusion invariant still holds after the fix commits



