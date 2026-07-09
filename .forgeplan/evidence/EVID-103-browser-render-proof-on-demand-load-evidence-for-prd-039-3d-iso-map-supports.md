---
depth: standard
id: EVID-103
kind: evidence
last_modified_at: 2026-07-08T10:59:39.935784+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-039
  relation: informs
status: draft
title: 'Browser render-proof + on-demand-load evidence for PRD-039 3D iso-map: supports'
---

## Verdict

**PASS** | **SUPPORTS** (assigned by orchestrator — see note below on partial AC coverage)

One-line summary: Live dev-server Playwright capture confirms the 3D isometric minimap renders in the Map view's corner alongside the unchanged 2D composed-map (AC-1, render half), confirms bidirectional 3D↔2D drill sync in both directions (AC-2/FR-003), and confirms the 3D render chunk loads strictly on-demand after the main app, triggered by the Map-view mount (FR-005/NFR-002) — with zero iso-feature console errors. This capture does **not** demonstrate PRD-039's AC-3 (depth-control 1/2/3 + ascend + show/hide-toggle *interaction*) or the "every other view's 2D minimap is unchanged" half of AC-1 — both remain open gaps, flagged below rather than silently claimed closed.

Assigned verdict fields (per orchestrator directive): `verdict: supports`, `congruence_level: 3`, `evidence_type: test` — recorded faithfully in Structured Fields below. This EVID does not itself judge PRD-039's overall readiness; it records what this specific capture did and did not demonstrate, for the guardian re-run EVID-102 called for.

## Ground-truth verification

- Base..head: `54a905c862b542f14a2c5929aa44f450c63ffd21..3e948dd6785c0eaa366395c062366f14e045a9e3` (source: `git merge-base feat/idef0-3d-iso-view develop` .. `git rev-parse HEAD` on branch `feat/idef0-3d-iso-view`)
- Diff probe: `git diff --stat 54a905c8..3e948dd6`
- Diff state: **DELTA=PRESENT** (232 files changed, 58048 insertions(+), 260 deletions(-))
- Expected delta token: the iso-map widget source tree + its on-demand dynamic-import wiring (claim under test: "the 3D minimap widget exists and loads on demand")
- Token probe 1: `git diff --stat 54a905c8..3e948dd6 | grep widgets/iso-map` → **FOUND** — `IsoMinimap.svelte` (219 lines), `IsoScene.svelte`, `IsoPlane.svelte` (154), `IsoFrustum.svelte`, `IsoZoneFrame.svelte` (82), `IsoControls.svelte` (63), `IsoNodeBox.svelte`, `IsoNodeCard.svelte`, `iso-view-state.svelte.ts` (678), `iso-view-state.render.test.ts` (160), `leader-line.ts`, `motion.ts`, plus `vite.config.ts` (+62/-?) and `vite/stubs/three-loaders.ts` (20) for the build-time code-split wiring.
- Token probe 2: `grep -n "import('@/widgets/iso-map')" template/src/widgets/dependency-graph/ui/IsoMapCorner.svelte` → **FOUND** at line 22: `const isoMapModule = browser ? import('@/widgets/iso-map') : null;` — a browser-guarded dynamic `import()`, the literal on-demand-load mechanism FR-005 claims.
- Verdict floor from ground-truth gate: **PASS-eligible** (delta present, expected tokens found — the feature branch's code backs the observed behavior; this is not a vacuous-green claim).

```
$ git rev-parse HEAD
3e948dd6785c0eaa366395c062366f14e045a9e3

$ git merge-base feat/idef0-3d-iso-view develop
54a905c862b542f14a2c5929aa44f450c63ffd21

$ git diff --stat 54a905c8..3e948dd6   (relevant lines only, full stat: 232 files, +58048/-260)
 template/src/widgets/iso-map/lib/leader-line.ts    |   36 +
 template/src/widgets/iso-map/lib/motion.ts         |   14 +
 .../iso-map/model/iso-view-state.render.test.ts    |  160 +
 .../widgets/iso-map/model/iso-view-state.svelte.ts |  678 +++
 template/src/widgets/iso-map/ui/IsoA11yProxy.svelte     |   76 +
 template/src/widgets/iso-map/ui/IsoControls.svelte      |   63 +
 template/src/widgets/iso-map/ui/IsoDeeperMarker.svelte  |   52 +
 template/src/widgets/iso-map/ui/IsoFrustum.svelte       |   43 +
 template/src/widgets/iso-map/ui/IsoIcomArrows.svelte    |   61 +
 template/src/widgets/iso-map/ui/IsoLayerCard.svelte     |   97 +
 template/src/widgets/iso-map/ui/IsoLeaderLine.svelte    |  129 +
 template/src/widgets/iso-map/ui/IsoMinimap.svelte       |  219 +
 template/src/widgets/iso-map/ui/IsoNodeBox.svelte       |   60 +
 template/src/widgets/iso-map/ui/IsoNodeCard.svelte      |  138 +
 template/src/widgets/iso-map/ui/IsoPlane.svelte         |  154 +
 template/src/widgets/iso-map/ui/IsoSliverPlane.svelte   |   26 +
 template/src/widgets/iso-map/ui/IsoZoneFrame.svelte     |   82 +
 template/vite.config.ts                            |   62 +-
 template/vite/stubs/three-loaders.ts               |   20 +

$ grep -n "import('@/widgets/iso-map')" template/src/widgets/dependency-graph/ui/IsoMapCorner.svelte
22:  const isoMapModule = browser ? import('@/widgets/iso-map') : null;
```

## Evidence type

🧪 Manual QA

(One-shot Playwright browser capture against the dev server — explicitly NOT an automated regression guard, per the environment caveat below.)

## Raw input provenance

- Source: orchestrator-performed live Playwright capture against the dev server (`FORGEPLAN_CWD=<repo>`, port 5174, Map view = default 9th graph view), branch `feat/idef0-3d-iso-view` @ `3e948dd6785c0eaa366395c062366f14e045a9e3`. Handed to this agent as orchestrator-inline text (OBSERVED section of the dispatch prompt) plus 4 screenshot artifacts on disk.
- Screenshots (fingerprinted directly by this agent via `shasum -a 256` + `file`, not taken on the orchestrator's word):

| File | Size | SHA-256 | Format | mtime |
|---|---|---|---|---|
| `render-proof-map-corner.png` | 127,025 B | `dc320b457892b7f00ea2173943b0cea44eabdd903f33abfc1b3429de6374bd8` | PNG 1400×1000 RGB | 2026-07-08 13:45 |
| `sync-before.png` | 158,957 B | `f783b9ce4d2ce5ebbf78ca77ad55b52af21e7e4d6d1367a88673916f28d10c9` | PNG 1400×1000 RGB | 2026-07-08 03:47 |
| `sync-after-3dclick.png` | 128,952 B | `54506411ba252cbdc6ede60f33139c480f08564eafbbdeaf470555775d7be5c` | PNG 1400×1000 RGB | 2026-07-08 03:48 |
| `sync-2d-reset.png` | 160,548 B | `3401e5c840652a3b821a5510629b6a946463e7443bb291ea25a921a70bf896` | PNG 1400×1000 RGB | 2026-07-08 03:49 |

All 4 paths resolved and read directly from `/Users/explosovebit/Work/ForgePlanWeb/` — none missing, none zero-byte, all valid PNG per `file`(1).
- Network trace: reported verbatim by the orchestrator as request-order positions (#491–518 of ~518 total) — this agent did **not** independently re-run the capture (out of scope for a recording pass; the trace is consistent with the code-level on-demand `import()` wiring confirmed above, which *is* independently verified).
- Captured at: 2026-07-08 (dev-server session; screenshot mtimes above span 03:47–13:45 UTC-adjacent local time, i.e. two capture passes — an earlier sync-proof pass and a later corner-render-proof pass, both same-day, same branch head-adjacent).
- Captured by: orchestrator (live Playwright browser driving), relayed to this agent (evidence-recorder) for structuring per HARD RULE ("orchestrator performed the live capture; you structure it faithfully").

## Raw input (orchestrator's OBSERVED dispatch text, truncated to ≤2000 chars)

```
Render: the Map view shows the 2D composed-map UNCHANGED plus the 3D isometric minimap
rendering in the bottom-right corner (stacked isometric planes, node boxes, orange zone
frames, the depth control "1/2/3 + ascend" + a "⋯" show/hide toggle). Screenshot:
render-proof-map-corner.png. Prior-capture screenshots also on disk proving the 3D<->2D
bidirectional sync live: sync-before.png (root), sync-after-3dclick.png (a 3D corner
zone-click descended the 2D map into "Decision Trail", 2D breadcrumb "All > Decision
Trail"), sync-2d-reset.png (clicking 2D "All" reset the 3D corner to root) -- both sync
directions confirmed with 0 iso-feature console errors.

On-demand load (FR-005), network trace verbatim -- the iso widget + 3D libs load LATE
(requests #491-518 of ~518, i.e. after the main app, triggered by the Map-view mount, NOT
in the initial page load): GET /src/widgets/iso-map/index.ts (#491), GET
/src/widgets/iso-map/ui/IsoMinimap.svelte (#493), GET
/node_modules/.vite/deps/@threlte_core.js (#494), GET
/node_modules/.vite/deps/three.module-*.js (#502), GET
/node_modules/.vite/deps/@threlte_extras.js (#503), GET
/node_modules/.vite/deps/three.js (#518), plus all IsoScene/IsoPlane/IsoFrustum/etc.
component + lib modules (#495-517) -- all 200 OK, all in that late on-demand burst. This
is the dev-mode manifestation of the production lazy code-split (the built 808 KiB three
chunk EVID-099 measured).

Console: the ONLY error observed was GET /api/score 400 -- a test-environment artifact of
the orchestrator's score-cascade suppression guard (unrelated to the iso feature; the
dashboard's score-poll, not iso code). NO iso-feature / WebGL / three error.

Environment caveat: this is a DEV-server manual capture, a one-shot render-proof (not an
automated regression guard); production code-split size is separately measured in
EVID-099.
```

## Structured findings

**🧪 Manual QA scenario table:**

| # | Scenario | Steps | Observed | Expected | Pass/fail |
|---|---|---|---|---|---|
| 1 | Map-view 3D-corner render (AC-1, render half) | Open dev server; navigate to Map view (default 9th graph view) | 2D composed-map renders unchanged; 3D isometric minimap renders in bottom-right corner — stacked isometric planes, node boxes, orange zone frames, depth control "1/2/3 + ascend", "⋯" show/hide toggle. Screenshot `render-proof-map-corner.png` (sha256 above) | 3D overview appears in the Map-view corner, 2D map unaffected (FR-001/FR-002) | **PASS** |
| 2 | 3D-corner click → 2D descend sync (AC-2, FR-003) | From root (`sync-before.png`), click a zone in the 3D corner minimap | 2D map descended into "Decision Trail"; 2D breadcrumb reads "All › Decision Trail". Screenshot `sync-after-3dclick.png` | Clicking the 3D overview drives the flat 2D map to the same focus | **PASS** |
| 3 | 2D "All" click → 3D reset sync (AC-2, FR-003) | Click the 2D breadcrumb "All" | 3D corner reset to root focus. Screenshot `sync-2d-reset.png` | Ascending/resetting in the flat 2D map drives the 3D overview to match | **PASS** |
| 4 | On-demand chunk load (FR-005 / NFR-002) | Capture full network request log across dev-server page load + Map-view mount | iso-map widget + `@threlte`/`three` deps requested at #491–518 of ~518 total — strictly after the main app load, triggered by Map-view mount, absent from the initial bundle. All 200 OK. | 3D chunk fetched only on Map-view open, not at initial page load | **PASS** |
| 5 | Console cleanliness during scenarios 1–4 | Observe browser console throughout | Only `GET /api/score 400` (known score-cascade-suppression test artifact, unrelated to iso feature — the dashboard's own score-poll). Zero iso-feature/WebGL/three errors. | No iso-feature console errors | **PASS** |
| 6 | AC-3 — depth control (1/2/3) + ascend + show/hide toggle *interaction* | **NOT PERFORMED** in this capture | Depth control and toggle are visibly present in the render-proof screenshot (scenario 1) but were not clicked/exercised; no before/after screenshot or state change was captured for switching depth levels, the ascend action, or hiding/showing the overview | Selecting depth 1/2/3 changes visible level count; ascend climbs one level on both surfaces; toggle hides then restores the overview (PRD-039 AC-3 / FR-004) | **NOT TESTED — gap, not a failure** |
| 7 | AC-1 — "every other view's 2D minimap unchanged" half | **NOT PERFORMED** in this capture | Only the Map view was visited in this session; no other view id (list/graph/tree/timeline/etc.) was opened to confirm its 2D minimap is byte-unchanged | Every non-Map view's 2D minimap renders identically to the base branch (FR-001 second clause) | **NOT TESTED — gap, not a failure** |

**Coverage vs PRD-039 acceptance criteria (reconciling the dispatch prompt's AC labels against the actual PRD-039 body, fetched directly via `forgeplan_get` for this EVID):**

- **AC-1 (render, Map-view-only; FR-001/FR-002)** — **PARTIALLY closed.** The Map-view-corner-render half is demonstrated (scenario 1). The "every other view's 2D minimap unchanged" half is **not** exercised in this capture (scenario 7).
- **AC-2 (bidirectional drill sync; FR-003)** — **closed** by scenarios 2–3 (both directions demonstrated, screenshots on disk, 0 console errors). Note: the orchestrator's dispatch prompt labeled this coverage "AC-3 (sync interaction)" — the actual PRD-039 body (re-read directly for this EVID) assigns bidirectional sync to **AC-2**, and reserves **AC-3** for the depth-control/toggle requirement (FR-004). This EVID records the **correct** AC number against the real artifact text rather than propagating the dispatch prompt's label, per the "record what was observed against the actual artifact" mandate.
- **AC-3 (depth control 1/2/3 + ascend + show/hide toggle; FR-004)** — **NOT closed by this capture.** The controls are visibly rendered (scenario 1 screenshot shows "1/2/3 + ascend" and a "⋯" toggle) but no interaction with them was captured. This is exactly what guardian's prior pass (EVID-102, item 2 of its orchestrator instructions) asked to be captured — it remains open.
- **FR-005 / NFR-002 (on-demand load)** — **closed** by scenario 4 (network trace) plus the independent code-level confirmation in Ground-truth verification above (the `browser ? import('@/widgets/iso-map') : null` dynamic import).
- **NFR-003 (non-regression)** — not assessed by this capture beyond the Map view itself (see AC-1 gap above); `svelte-check`/`vitest` CI status is out of scope for a browser render-proof pass (covered separately by EVID-099/100/101).

**Environment caveat (recorded honestly, not smoothed over):** this is a **dev-server manual capture** — a one-shot render-proof, not an automated regression guard. Production packaged-chunk size is separately measured in EVID-099 (3.28–3.29 MiB per image, under the 3.5 MiB ADR-011 cap). Re-running this exact scenario is not guarded by CI; a regression here would only be caught by another manual pass or a future Playwright test suite (none exists yet for the iso-map widget beyond the unit-level `iso-view-state.render.test.ts` / `shared-drill-bus.svelte.test.ts` referenced in EVID-100/101).

## Recommended next steps

- Dispatch a follow-up manual/Playwright pass (or this same agent-class) to capture **AC-3's actual interaction**: click each of depth 1/2/3, exercise ascend, and toggle show/hide — with before/after screenshots or DOM-state assertions, not just a static render showing the controls exist.
- Capture the missing **AC-1 second half**: visit at least one non-Map view (e.g. `list` or `graph`) in the same session and confirm its 2D minimap is byte-identical to the base branch (screenshot or DOM diff).
- Once both gaps close, re-run `guardian` on the PRD-039/ADR-011/RFC-036 chain (EVID-102's own instruction) — this EVID plus a landed rule-22/NFR-006 governance EVID (tracked separately, claimed in-flight by `claude-code/2.1.204/security-expert-task-prd039-nfr006` at the time this EVID was recorded) are the two items EVID-102 named before re-review.
- Do **not** treat this EVID alone as sufficient to claim full AC-1/AC-3 closure in the guardian re-run — it closes AC-2 and FR-005/NFR-002 cleanly, and half of AC-1, but leaves AC-3 and AC-1's second half open.

## References

- Parent: `PRD-039`
- Related EVIDENCE: `EVID-099` (build/cap/svelte-check/SSR measurement), `EVID-100` / `EVID-101` (code review + re-review of the sync/WebGL/test-gap findings), `EVID-102` (guardian gate CONCERNS — the artifact that named this exact render-proof gap as the "load-bearing" item, citing `EVID-086` as precedent on the PRD-036 arc)
- Related ADR: `ADR-011` (lazy three.js/Threlte chunk, dist-cap raise 3→3.5 MiB — informed by, not by, this EVID)
- Related RFC: `RFC-036` (lazy 3D iso-map widget, shared-drill-bus)

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

