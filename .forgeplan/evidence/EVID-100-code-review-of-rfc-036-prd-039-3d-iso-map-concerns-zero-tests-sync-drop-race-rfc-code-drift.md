---
depth: standard
id: EVID-100
kind: evidence
last_modified_at: 2026-07-08T02:05:10.526109+00:00
last_modified_by: claude-code/2.1.202
links:
- target: RFC-036
  relation: informs
- target: PRD-039
  relation: informs
status: draft
title: 'Code review of RFC-036/PRD-039 (3D iso-map): CONCERNS — zero tests, sync-drop race, RFC/code drift'
---

## Verdict

CONCERNS

One-line justification: the feature is architecturally sound and its two hardest invariants (SSR-three-exclusion, no `shared/ui` re-skinning) verify clean under a real build — but it ships with **zero unit tests** for the single most load-bearing new contract (the shared-drill-bus sync loop), a genuine desync race in that same sync path, and a companion RFC that documents an API/mechanism the shipped code doesn't actually have.

## Scope

- Parent: RFC-036 (`based_on` PRD-039), companion ADR-011
- Diff range: `f0ffeb7..9b3636a` (`HEAD~14..HEAD` on `feat/idef0-3d-iso-view`) — the 14 iso-specific commits, isolated from the `develop` merge-base which pulls in ~100 unrelated commits (chat/composed-map history already shipped)
- Files reviewed: 29 files, 3236 insertions / 12 deletions
- Files: `template/src/widgets/iso-map/**` (20 files, new widget), `template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts` (new), `template/src/widgets/composed-map/ui/ComposedMapView.svelte` (+65 lines, sync wiring), `template/src/widgets/dependency-graph/ui/{IsoMapCorner.svelte (new), DependencyGraph.svelte (+23/-7)}`, `template/vite.config.ts` + `template/vite/stubs/three-loaders.ts` (draco/basis stub), `scripts/build.mjs` (cap 3→3.5 MiB), `template/package.json` (+three, +@threlte/core, +@threlte/extras, +@types/three)

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| svelte-check --threshold error | 0 | 2344 files, 0 errors, 8 warnings in 2 files unrelated to this diff (no iso-map/threlte/three matches in the warning set) |
| rule-24 grep (`:global()` reaching primitive classes) | 0 | ran over `widgets/iso-map`, `widgets/composed-map`, `widgets/dependency-graph` — no upper-layer reach into `shared/ui` primitive internals |
| rule-21 grep (three/@threlte dependency placement) | manual | confirmed `three`, `@threlte/core`, `@threlte/extras` under `template/package.json#dependencies` (not devDependencies); `@types/three` correctly under `devDependencies` |
| real build (`npm run build` product already present) | n/a | inspected the already-built `dist/` (stable image) as ground truth for the SSR/lazy-load claims — see below |
| vitest | n/a | no test files exist in the diff to run (see Finding #2) |

## Ground-truth verification

- Base..head: `f0ffeb795a0092a4f1cfb609264460e64b58db7b..9b3636a` (source: derived — `develop` merge-base pulls in unrelated history, so the 14-commit range matching "iso-spike" (`2bfac1c`) through "resolve TODO(iso-adr)" (`9b3636a`) is used instead, matching the task's own `HEAD~14` fallback)
- Diff probe: `git diff f0ffeb7..HEAD --stat -- template/ scripts/ package.json` → **DELTA=PRESENT** (29 files, 3236 insertions)
- Expected delta token: `shared-drill-bus` (the RFC's own load-bearing contract name) → **FOUND**: `template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts` exists, is imported by both `ComposedMapView.svelte:80` and `IsoMinimap.svelte:41-45`
- Additional ground truth (SSR-exclusion invariant, INV-A/ADR-011 INV-1): `grep -c -iE "BufferGeometry|WebGLRenderer|Object3D|from ['\"]three" dist/index.js` → **0** (confirms three.js is genuinely absent from the SSR bundle; an earlier broad `grep -c three` returned 2 hits that were investigated and are confirmed false positives — HTML-entity names `leftthreetimes`/`rightthreetimes`/`lthree`/`rthree` in a markdown-entity table, and one unrelated `<option value="three">` in a dropdown — not the `three.js` package)
- Additional ground truth (lazy-chunk claim, FR-005/NFR-002): `find dist/client/_app/immutable -name "*.js" -exec du -h {} \;` → an 808 KiB chunk (`CUbqzil1.js`) exists; `grep -l "OrbitControls\|THREE\.\|WebGLRenderer" dist/client/.../CUbqzil1.js` confirms it is the three/Threlte chunk; `grep -c CUbqzil1 dist/client/.../entry/start.*.js dist/client/.../entry/app.*.js` → **0** in both eager entry chunks, referenced only via a genuine `import(...)` inside the map-view's own route chunk — confirms the chunk is not eagerly loaded on non-Map views
- Verdict floor from ground-truth gate: PASS-eligible (diff present, expected token found, invariants hold under real build) — findings below are quality/robustness gaps found on top of a genuine, working change, not evidence the change didn't land

```
$ git diff f0ffeb795a0092a4f1cfb609264460e64b58db7b..HEAD --stat -- template/ scripts/ package.json | tail -5
 template/vite.config.ts                            |  18 +
 template/vite/stubs/three-loaders.ts               |  20 +
 29 files changed, 3236 insertions(+), 12 deletions(-)

$ grep -c -iE "BufferGeometry|WebGLRenderer|Object3D|from ['\"]three" dist/index.js
0

$ find dist/client/_app/immutable -name "*.js" -exec du -h {} \; | sort -rh | head -3
808K	dist/client/_app/immutable/chunks/CUbqzil1.js
420K	dist/client/_app/immutable/chunks/BqNcAaJ-.js
336K	dist/client/_app/immutable/chunks/BMsIFlOI.js

$ grep -c CUbqzil1 dist/client/_app/immutable/entry/start.Bbib7K2x.js dist/client/_app/immutable/entry/app.BitgxMJP.js
dist/client/_app/immutable/entry/start.Bbib7K2x.js:0
dist/client/_app/immutable/entry/app.BitgxMJP.js:0
```

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| 1 | HIGH | 🐛 Bug | `template/src/widgets/iso-map/model/iso-view-state.svelte.ts:413-438` (`applyExternalFocusChain`) + `template/src/widgets/iso-map/ui/IsoMinimap.svelte:124-136` (INBOUND `$effect`) | `applyExternalFocusChain` bails out completely (`if (animationKind !== null) return;`) when an externally-driven chain (e.g. a 2D-map drill) arrives while the 3D view is mid-animation — no queuing, no scheduled retry. The consuming `$effect` only re-fires when `sharedFocusChain()` changes *again*; if no further chain change happens, the 3D view is left permanently desynced from the 2D map, contradicting the RFC's own claimed NFR-004/INV-E "no drift, no divergent foci" guarantee (comment even admits "best-effort... the caller's own effect will see the still-unreconciled chain and retry on the next change" — but there is no "next change" if the user stops interacting). | On the animation settling (`animationKind` transitioning back to `null`), re-check `sharedFocusChain()` against the local chain and apply any pending mismatch instead of relying on an unrelated future chain change. |
| 2 | HIGH | 🧪 Test gap | `template/src/widgets/iso-map/**`, `template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts` | Zero test files ship with this diff (confirmed via `git diff --stat f0ffeb7..HEAD` — 29 changed files, none `*.test.ts`). RFC-036's own "Test Strategy Hooks" section explicitly demands "bus reducer unit tests (idempotence, descend/ascend, no re-entrant loop — NFR-004)", a "bidirectional-sync contract test", and an "honest-fallback failure injection" test — none exist. The one genuinely load-bearing new mechanism in this PR (the content-guarded sync loop, Finding #1's exact failure mode) has no coverage at all. | Add unit tests for `shared-drill-bus.svelte.ts` (idempotent `setSharedFocusChain`, `chainsEqual`) and a reducer test for `iso-view-state.svelte.ts`'s `applyExternalFocusChain` covering the mid-animation-arrival case from Finding #1. |
| 3 | MEDIUM | 🐛 Bug | `template/src/widgets/dependency-graph/ui/IsoMapCorner.svelte:26-36` | FR-007's "honest fallback" is only half-implemented: the `{#await}...{:catch}` block only catches a **rejected dynamic-import promise**. A runtime failure during `<mod.IsoMinimap>`'s render/mount (e.g. WebGL context creation failing inside `@threlte/core`'s `<Canvas>`) is not caught by anything in this diff — no `<svelte:boundary>`, no try/catch around the mount call. The RFC explicitly claims "IsoScene's WebGL/Threlte init failure throws. IsoMapCorner catches it" (§Data Flow, Named failure path) — that mechanism as coded cannot intercept a post-import render/init error, only an import-time one. | Wrap `<mod.IsoMinimap />` in a Svelte 5 `<svelte:boundary onerror={...}>` so a WebGL-init failure inside the mounted component also falls back to the 2D-unavailable state, not just an import failure. |
| 4 | LOW-MEDIUM | 📚 Docs | `template/src/widgets/iso-map/IsoScene.svelte:37-40` | Stale comment: `// TODO(spike): de-risking prototype... Throwaway route, not linked from any nav — proves Threlte renders our real composed-map data...` is now false — commits `0950859` (graduate routes/iso-spike → widgets/iso-map), `12a7194` (mount as Map-view corner minimap), and `5b946bd` (drop the throwaway /iso-spike route) mean this component **is now** linked from nav and **is** the production surface. Violates rule 10 ("stale comments referencing removed code"). | Delete or rewrite the stale `TODO(spike)` block; the file is no longer a throwaway spike. |
| 5 | LOW | 📚 Docs | `template/src/widgets/iso-map/ui/IsoFrustum.svelte:2`, `IsoPlane.svelte:2`, `IsoControls.svelte:2`, and ~11 other `ui/*.svelte` + `lib/*.ts` files under `widgets/iso-map/` | The generic `// TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to entities on graduation` comment, copy-pasted verbatim across ~14 files, is half-stale: the "promote to widgets/iso-map" clause is already done (that IS these files' current location, per commit `0950859`). Only the "move shared drill logic to entities" half is still pending work. Confusing for a future reader trying to scope what remains. | Reword the recurring TODO to state only the remaining work ("move shared-drill-bus to entities on graduation") — drop the already-completed "promote to widgets/iso-map" clause. |
| 6 | LOW-MEDIUM | 📚 Docs | RFC-036 body, §Risks R-4 and §Proposed Direction ("Lazy-chunk boundary") vs. `template/vite.config.ts:37-51` and `template/vite/stubs/three-loaders.ts` | RFC-036 asserts twice that `// TODO(iso-draco-basis)` guards the load-bearing draco/basis vite alias ("This alias is load-bearing (Risk R-4)... `// TODO(iso-draco-basis)` guards it"). `grep -rn "iso-draco\|draco-basis" template/vite.config.ts template/vite/stubs/three-loaders.ts` returns nothing — no such marker exists in the actual code. Per rule 10, a load-bearing workaround that can "silently break" future usage (the RFC's own words) requires a TODO — it's missing, and the RFC overstates what was implemented. | Add the missing `// TODO(iso-draco-basis)` marker to `vite.config.ts` at the alias definition, matching what the RFC already claims exists. |
| 7 | LOW | 📚 Docs | RFC-036 §"Function Signatures / Component Contracts" vs. `template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts:19-53` | The RFC documents a `shared-drill-bus` API with `descend()`, `ascend()`, `focusTo()`, `visibleDepth`/`setDepth()`, `hidden`/`toggleVisible()`. The shipped module exposes only `sharedFocusChain()`, `setSharedFocusChain()`, `chainsEqual()` — depth-window and visibility are local-only state inside `iso-view-state.svelte.ts`, never shared via the bus. RFC-036 states it "documents the design as built" — this section doesn't match what was built. | Update RFC-036's Function Signatures section to reflect the actual thin 3-function bus contract, or note explicitly that depth/visibility are intentionally NOT part of the shared surface. |

## Positive observations

- The sync-loop guard mechanism itself is well designed: `setSharedFocusChain`'s content-guarded write (`chainsEqual` no-op, `shared-drill-bus.svelte.ts:49-53`), combined with the `untrack`-wrapped INBOUND effect and a `sharedChainPrimed` skip-first-run flag (wired symmetrically in `ComposedMapView.svelte:552-575` and `IsoMinimap.svelte:106-136`), was traced by hand through a click→propagate→settle cycle and terminates correctly in the common (non-animating) case — a legitimately careful piece of reactive-state design, undermined only by the animation-in-flight edge case in Finding #1.
- Rule 21 (template purity / dependency placement) is fully respected: `three`, `@threlte/core`, `@threlte/extras` land under `template/package.json#dependencies` (not `devDependencies`); `@types/three` correctly under `devDependencies`.
- The lazy-load boundary is real, not just claimed: verified against an actual build artifact (not the RFC's prose) that the three/Threlte chunk is absent from both eager entry chunks and is fetched only via `IsoMapCorner`'s `browser`-guarded dynamic `import()`.
- `IsoA11yProxy.svelte` is a solid accessibility pattern: correct visually-hidden CSS (clip-rect, not `display:none`, so it stays in the tab order and the a11y tree), one focusable proxy button per currently-dwellable target, and immediate (no artificial dwell-delay) open on keyboard focus since a Tab lands on a committed target unlike a passing-through mouse hover.

## Test coverage delta

- Before: n/a (new widget)
- After: 0% — no test files in this diff (Finding #2)
- Branches gained: none covered
- Branches still uncovered: shared-drill-bus idempotence/loop-guard, bidirectional sync end-to-end, depth-window control, honest-fallback path, the exact race in Finding #1

## Next steps

- Dispatch a coder agent for Finding #1 (the animation-in-flight sync-drop) — this is the one finding that undermines a stated invariant (NFR-004/INV-E) under a plausible interaction sequence, not just a hygiene gap.
- Dispatch a coder/tester agent for Finding #2 (test suite) before this ships past draft — RFC-036 itself gates Phase 1/2 on exactly these tests existing.
- Findings #4-7 (docs/comments) are cheap fix-forward items; batch them into the same PR or a fast follow-up.
- Finding #3 (fallback boundary) is a `should`-priority FR-007 gap — worth fixing but not release-blocking on its own.
- Re-review after Findings #1/#2 land; the remaining findings (#3-7) do not need a second full pass, just a diff spot-check.

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

## References

- Parent: RFC-036 (based_on PRD-039), companion ADR-011
- Related EVIDENCE: EVID-099 (PRD-039 AC-5 dist-cap build-pass claim — noted but not relied upon as ground truth; this review independently re-derived the same dist-cap/SSR-exclusion facts from the actual build artifact rather than trusting that EVID's title)
- Related ADR: ADR-011 (ship three.js+Threlte lazy chunk; cap 3→3.5 MiB) — this review's Ground-truth verification section independently confirms ADR-011 INV-1 (SSR three-free) and INV-2 (lazy-only) hold under a real build


