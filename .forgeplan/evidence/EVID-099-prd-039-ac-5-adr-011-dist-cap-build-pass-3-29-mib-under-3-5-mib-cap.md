---
depth: standard
id: EVID-099
kind: evidence
last_modified_at: 2026-07-08T01:59:22.502906+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-039
  relation: informs
- target: RFC-036
  relation: informs
- target: ADR-011
  relation: informs
status: draft
title: 'PRD-039 AC-5 + ADR-011 dist-cap: build PASS 3.29 MiB under 3.5 MiB cap'
---

## Verdict

**CONCERNS**

Build passes cleanly under the raised 3.5 MiB cap (3.29 MiB measured, ~220 KiB margin); `svelte-check` reports 0 errors; `vitest` reports 782/782 passing (0 failed, 0 skipped). The `three`/`@threlte` code-split is verified structurally sound (0 markers in the SSR bundle `dist/index.js`, draco/basis loaders absent from the tarball). These measurements **fully support** ADR-011's dist-cap decision and PRD-039 AC-6 (quality gate) and the bundle-size half of AC-5. **CONCERNS, not PASS**, because this EVID's RUN scope did not cover: PRD-039 AC-1/AC-3 (Map-view-only render, depth control/toggle — need Playwright/manual UI verification, not run here); AC-5's governance half (rule-22 spawn/write/network greps — not run here); and AC-2's automated half — RFC-036's own Test Strategy Hooks call for `shared-drill-bus` reducer unit tests (idempotence, descend/ascend, no re-entrant loop, NFR-004) and these **do not exist** in the test suite (0 test files under `widgets/iso-map/`, 0 test file for `shared-drill-bus.svelte.ts`). AC-2 currently rests entirely on one manual, non-repeatable observation (see below).

## Ground-truth verification

- Base..head: `54a905c862b542f14a2c5929aa44f450c63ffd21..HEAD` (source: merge-base with `develop`; HEAD = `9b3636a` on `feat/idef0-3d-iso-view`)
- Diff probe: `git diff --stat 54a905c8..HEAD` (from a clean `bash --noprofile --norc` shell, `set +u`)
- Diff state: **DELTA=PRESENT** — 230 files changed, 57717 insertions(+), 243 deletions(-)
- Expected delta tokens (source: PRD-039/RFC-036/ADR-011 claims): `IsoMapCorner`, `shared-drill-bus`, `IMAGE_DIST_MAX_BYTES` — all three (source: claim/RFC/ADR)
- Token probe: `git diff 54a905c8..HEAD --name-only | grep -iE "iso-map|shared-drill-bus|build.mjs|vite.config"` + `grep -n "IMAGE_DIST_MAX_BYTES" scripts/build.mjs` → **FOUND** (all three)
- Verdict floor from ground-truth gate: **PASS-eligible** (diff present, all expected tokens found)

```
=== git diff --stat base..head (tail) ===
 template/src/widgets/iso-map/IsoScene.svelte                     |  217 +
 template/src/widgets/iso-map/index.ts                            |    1 +
 template/src/widgets/iso-map/lib/iso-materials.ts                |  140 +
 template/src/widgets/iso-map/lib/iso-projection.ts                |  448 +
 template/src/widgets/iso-map/lib/leader-line.ts                  |   39 +
 template/src/widgets/iso-map/lib/motion.ts                       |   16 +
 template/src/widgets/iso-map/model/iso-view-state.svelte.ts      |  641 +
 template/src/widgets/iso-map/ui/IsoA11yProxy.svelte               |   79 +
 template/src/widgets/iso-map/ui/IsoControls.svelte                |   66 +
 template/src/widgets/iso-map/ui/IsoDeeperMarker.svelte            |   55 +
 template/src/widgets/iso-map/ui/IsoFrustum.svelte                 |   46 +
 template/src/widgets/iso-map/ui/IsoIcomArrows.svelte              |   64 +
 template/src/widgets/iso-map/ui/IsoLayerCard.svelte               |  100 +
 template/src/widgets/iso-map/ui/IsoLeaderLine.svelte              |  132 +
 template/src/widgets/iso-map/ui/IsoMinimap.svelte                 |  218 +
 template/src/widgets/iso-map/ui/IsoNodeBox.svelte                 |   63 +
 template/src/widgets/iso-map/ui/IsoNodeCard.svelte                |  141 +
 template/src/widgets/iso-map/ui/IsoPlane.svelte                   |  157 +
 template/src/widgets/iso-map/ui/IsoSliverPlane.svelte             |   29 +
 template/src/widgets/iso-map/ui/IsoZoneFrame.svelte               |   85 +
 template/vite.config.ts                                           |   18 +
 template/vite/stubs/three-loaders.ts                              |   20 +
 230 files changed, 57717 insertions(+), 243 deletions(-)
DELTA=PRESENT

=== token probe ===
scripts/build.mjs
template/src/widgets/composed-map/model/shared-drill-bus.svelte.ts
template/src/widgets/dependency-graph/ui/IsoMapCorner.svelte
template/src/widgets/iso-map/* (20 files)
template/vite.config.ts

scripts/build.mjs:32:const IMAGE_DIST_MAX_BYTES = 3.5 * 1024 * 1024;
scripts/build.mjs:430:  if (totalBytes > IMAGE_DIST_MAX_BYTES) {
scripts/build.mjs:432:    `${targetName}/ is ${(totalBytes/1024/1024).toFixed(2)}M, cap is ${(IMAGE_DIST_MAX_BYTES/1024/1024).toFixed(0)}M ...`
```

## Runner detected

- Ecosystem: node (root build pipeline) + node/svelte (template)
- Runner: `npm run build` (root, wraps `node scripts/build.mjs`); `svelte-check` (template); `vitest` (template)
- Output format: text (build log + svelte-check summary line + vitest text reporter)
- Config source: root `package.json#scripts.build`; `template/package.json` (svelte-check via `npx`); `template/vitest.config.ts`

## Command run

```bash
cd /Users/explosovebit/Work/ForgePlanWeb && npm run build
# -> node scripts/build.mjs

cd /Users/explosovebit/Work/ForgePlanWeb/template && npx svelte-check --threshold error

cd /Users/explosovebit/Work/ForgePlanWeb/template && npx vitest run

# packaged-size measurement (BSD du has no -b; used find+stat for exact bytes)
find dist -type f -exec stat -f%z {} \; | awk '{sum+=$1} END{print sum}'
du -sh dist
find dist-nightly -type f -exec stat -f%z {} \; | awk '{sum+=$1} END{print sum}'
du -sh dist-nightly

# code-split verification
grep -c -iE "BufferGeometry|WebGLRenderer|from ['\"]three" dist/index.js
find dist -iname '*draco*' -o -iname '*basis*'
```

Exit codes: `npm run build` = **0** | `svelte-check --threshold error` = **0** | `vitest run` = **0**

## Summary

| Metric | Value |
|---|---|
| Build (root `npm run build`) | exit 0; both images built: `stable` (dist/ ready, 3.29M) + `nightly` (dist-nightly/ ready, 3.29M) |
| Cap assertion (`scripts/build.mjs` `IMAGE_DIST_MAX_BYTES=3.5*1024*1024`) | **passed** — no `totalBytes > IMAGE_DIST_MAX_BYTES` error thrown for either image |
| **`dist/` measured size** | **3,444,656 bytes** (exact, `find+stat` sum) = **3.29 MiB** / `du -sh` reports **3.4M** |
| **`dist-nightly/` measured size** | **3,444,657 bytes** = **3.29 MiB** / `du -sh` reports **3.4M** |
| Cap (ADR-011) | 3.5 MiB = 3,670,016 bytes |
| Margin under cap | 3,670,016 − 3,444,656 = **225,360 bytes (~220 KiB, ~6.1%)** |
| svelte-check | 2344 files checked, **0 errors**, 8 warnings, 2 files with problems |
| vitest — Test Files | **60 passed (60)**, 0 failed |
| vitest — Tests | **782 passed (782)**, 0 failed |
| vitest — Skipped | 0 (none reported) |
| vitest — Flaky | not measured (single run, no `--retry`/`--reruns` pass performed) |
| vitest — Duration | 4.82s (transform 31.48s, import 39.02s, tests 1.60s) |

## AC coverage delta

Parent: PRD-039 (+ RFC-036 realization, ADR-011 packaging decision)

**AC-5 — governance & bundle-size constraint (NFR-001, NFR-006):**
- Bundle-size half: **MEASURED, PASS.** `du`-equivalent (`find+stat`, BSD `du` has no `-b`) gives exact `dist/` = 3,444,656 bytes (3.29 MiB), `dist-nightly/` = 3,444,657 bytes (3.29 MiB), both under the ADR-011 cap of 3.5 MiB (3,670,016 bytes) by ~220 KiB. This is the authoritative measured delta PRD-039 Q2/NFR-001 left as TBD — recorded here.
- Governance half (rule-22 spawn/write/network greps): **NOT RUN** in this EVID pass — out of the instructed RUN scope. Recommend a follow-up governance check (e.g. `security-expert` or a rule-22 grep pass over `template/src/routes/api/` + `template/src/shared/server/`) before activation claims AC-5 fully closed.

**AC-6 — quality gate:** **MEASURED, PASS.** `svelte-check --threshold error` = 0 errors (2344 files, 8 pre-existing warnings — consistent with PRD-039's "pre-existing warnings OK" note). `vitest run` = 782/782 passing, 0 failures.

**AC-4 — on-demand load + zero regression (FR-005, FR-006), partial:**
- Zero-regression: **supported** — 782/782 tests pass including composed-map render/model tests (`tour.render.test.ts`, `nav-contract.render.test.ts`, `drill-state.test.ts`, `camera-bus.test.ts`, etc.) with no observed failures.
- On-demand load: **structurally supported, not dynamically traced.** `dist/index.js` (the SSR bundle) has **0** matches for `BufferGeometry|WebGLRenderer|from ['"]three` (confirms ADR-011 INV-1: three stays out of SSR). The three/@threlte code lives in a separate lazy client chunk `dist/client/_app/immutable/chunks/CUbqzil1.js` (824,215 bytes ≈ 805 KiB — matches ADR-011's claimed "~808 KiB lazy chunk"), which is NOT part of `index.js`. `find dist -iname '*draco*' -o -iname '*basis*'` returned empty (draco/basis loaders correctly stubbed/absent). This is strong structural evidence for FR-005, but no browser network trace was captured to directly observe "chunk absent on non-Map view, fetched on Map-view open" (NFR-002) — that requires a live Playwright pass, not run in this EVID.

**AC-1, AC-3 — NOT covered by this EVID.** Map-view-only rendering (AC-1) and the depth control/toggle (AC-3) require live UI verification (Playwright or manual) — outside this EVID's instructed RUN scope (build/svelte-check/vitest/grep only).

**AC-2 — bidirectional drill sync, weak coverage:**
- **Manual observation (recorded as manual, NOT an automated test — one-shot, not a regression guard):** the orchestrator live-verified in dev that clicking a zone in the 3D corner descended the 2D map into it, and the 2D "All" breadcrumb reset the 3D to root, with 0 console errors.
- **Automated coverage gap (real finding):** RFC-036's own "Test Strategy Hooks" section explicitly calls for `shared-drill-bus` reducer unit tests (same interaction sequence → same final focus; descend-then-ascend returns to prior focus; `descend(current)` is a no-op; no re-entrant emit loop — NFR-004/INV-E). **These tests do not exist.** `find src/widgets/iso-map -iname '*.test.*'` = empty (0 test files for the entire 20-file, ~2700-line 3D widget). `grep -rl -iE "shared-drill-bus" src --include="*.test.*"` = empty (0 tests reference the bus). The composed-map model test directory has tests for `drill-state.test.ts`, `camera-bus.test.ts`, `tour-state.test.ts`, `level-documents.test.ts`, `node-tabs.test.ts` — but none for `shared-drill-bus.svelte.ts` (53 lines, new in this diff). PRD-039 AC-2 itself requires "verified end-to-end + by focus-chain unit tests" — the unit-test half is unmet.

## Failing tests

None. 0 failures in vitest (782/782 passing); 0 errors in svelte-check.

## Slow tests (top 5)

vitest text reporter did not emit per-test timing in this run (only aggregate phase timing: transform 31.48s, import 39.02s, tests 1.60s). No individual slow-test outliers surfaced.

## Flaky candidates

None measured — a single `vitest run` pass was performed without `--retry`/`--reruns`; flakiness was not probed in this EVID.

## Code-split verification (task-specific checks)

```
$ grep -c -iE "BufferGeometry|WebGLRenderer|from ['\"]three" dist/index.js
0

$ find dist -iname '*draco*' -o -iname '*basis*'
(empty)

$ (supplementary, not requested but load-bearing for the "code-split is real" claim)
$ for f in dist/client/**/*.js: grep -c -iE "BufferGeometry|WebGLRenderer"
dist/client/_app/immutable/chunks/CUbqzil1.js : 7 matches, 824215 bytes
```

Confirms: three/@threlte is fully absent from the SSR server bundle (`dist/index.js`, 0 markers) and from the tarball's draco/basis loaders (stubbed/absent per RFC-036's vite alias), while genuinely present as an isolated ~805 KiB lazy client chunk — matching ADR-011 INV-1/INV-2 and RFC-036 INV-A/INV-B.

## Next steps

- **CONCERNS resolution before PRD-039 activation:** dispatch `coder` (or a follow-up sprint) to add `shared-drill-bus.svelte.ts` reducer unit tests per RFC-036's own Test Strategy Hooks (idempotent descend, ascend-returns-to-prior-focus, no re-entrant loop) — this closes AC-2's automated half and NFR-004/INV-E.
- **CONCERNS resolution:** run rule-22 governance greps (spawn/execFile/fetch/write scans over `template/src/routes/api/` + `template/src/shared/server/`) to close AC-5's governance half — recommend `security-expert` dispatch.
- **CONCERNS resolution:** a live Playwright pass (network/asset trace + Map-view-only render + depth control/toggle) would close AC-1, AC-3, and the NFR-002 half of AC-4.
- **PASS, hand to guardian:** the measured build/cap/quality-gate claims in this EVID (ADR-011 dist-cap decision, PRD-039 AC-5 bundle-size half, AC-6 quality gate) are solid and can support activating **ADR-011** specifically. PRD-039 as a whole should stay `draft` pending the three CONCERNS items above.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: measurement



