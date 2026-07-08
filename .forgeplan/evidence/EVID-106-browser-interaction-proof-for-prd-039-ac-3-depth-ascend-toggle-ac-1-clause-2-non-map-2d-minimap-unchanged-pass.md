---
depth: standard
id: EVID-106
kind: evidence
last_modified_at: 2026-07-08T15:20:05.693991+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-039
  relation: informs
status: draft
title: 'Browser interaction-proof for PRD-039 AC-3 (depth/ascend/toggle) + AC-1 clause-2 (non-Map 2D minimap unchanged): PASS'
---

## Verdict

**PASS** / **SUPPORTS**

Live Playwright browser-interaction capture against the running dev server (branch `feat/idef0-3d-iso-view` @ `3e948dd6785c0eaa366395c062366f14e045a9e3`, same head EVID-103 recorded) closes the two gaps guardian's prior pass (EVID-102, echoed by EVID-103's own "Recommended next steps") explicitly left open on PRD-039: **AC-3** (depth-control 1/2/3 + ascend + show/hide-toggle *interaction*, FR-004) and **AC-1's second clause** ("every other view's 2D minimap unchanged", FR-001 clause 2). EVID-103 already closed AC-2 (bidirectional sync) + FR-005/NFR-002 (on-demand load) + AC-1's render half (Map-view 3D corner appears). Together, EVID-103 + this EVID close **AC-1 (both clauses), AC-2, AC-3, FR-001..FR-005, NFR-002** for PRD-039.

Assigned verdict fields (per orchestrator directive, recorded faithfully, not re-judged by this agent): `verdict: supports`, `congruence_level: 3`, `evidence_type: test`.

## Ground-truth verification

- Base..head: `54a905c862b542f14a2c5929aa44f450c63ffd21..3e948dd6785c0eaa366395c062366f14e045a9e3` (source: same merge-base/HEAD pair independently re-derived by this agent via `git merge-base feat/idef0-3d-iso-view develop` and `git rev-parse HEAD` — matches the pair EVID-103 recorded, confirming this capture is against the identical code state, not a moved target).
- Diff probe: `git diff --stat 54a905c8..3e948dd6` → DELTA=PRESENT (232 files changed, +58048/-260 — same as EVID-103; no new commits landed between the two captures).
- Expected delta tokens for the two claims THIS EVID closes, independently probed by this agent (not taken on the dispatch prompt's word):
  1. **AC-3 depth/ascend/toggle control exists in source** — `git ls-files template/src/widgets/iso-map | grep -iE "control|toggle"` → **FOUND**: `template/src/widgets/iso-map/ui/IsoControls.svelte`.
  2. **AC-1 clause-2 view-conditional exists in source** — `grep -n "IsoMapCorner\|Minimap" template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` → **FOUND** at lines 219-226:
     ```
     {#if view === 'map'}
       <!-- Map-view-only corner: a 3D IsoMinimap replaces the 2D <Minimap> in
            this one slot (same bottom-right position). ComposedMapView itself
            (the main 2D map above) is untouched — see IsoMapCorner's header
            comment for the lazy-load rationale. -->
       <IsoMapCorner />
     {:else}
       <Minimap ... />
     {/if}
     ```
  3. **iso-spike throwaway route (source of the unrelated console errors) is deleted and the deletion is committed** — `git ls-files template/src/routes/iso-spike | wc -l` → **0** (confirmed absent from the tracked tree at HEAD).
- Verdict floor from ground-truth gate: **PASS-eligible** — the observed interaction behaviour traces to real, committed source (`IsoControls.svelte` backs AC-3's controls; the `{#if view==='map'}` conditional backs AC-1 clause-2; the deleted spike route explains the unrelated console noise). This is not a vacuous-green claim — code and observed DOM/console behaviour agree.
- `.forgeplan/.lock` checked before every MCP write in this task: present but 0 bytes (unlocked marker file), never removed by this agent.

## Evidence type

🧪 Manual QA

(A live Playwright browser-interaction session against the running dev server — DOM/aria-state snapshots + `browser_evaluate` + screenshots per step. Same capture category as EVID-103; this EVID records the continuation of that same session exercising the two previously-untested controls.)

## Raw input provenance

- Source: orchestrator-performed live Playwright interaction capture against the dev server (`http://127.0.0.1:5174/`, Map view = the 9th "Map" graph view), branch `feat/idef0-3d-iso-view` @ `3e948dd6785c0eaa366395c062366f14e045a9e3`. Handed to this agent as orchestrator-inline text (the "Observed facts to record" section of the dispatch prompt) plus 7 screenshot artifacts on disk. This agent did **not** re-run the browser session — per explicit instruction, the capture was already performed; this agent's job was to independently fingerprint the artifacts and structure the observations faithfully.
- Screenshots (fingerprinted directly by this agent via `shasum -a 256` + `wc -c` + `file`, not taken on the orchestrator's word — every value below was independently reproduced and matches the orchestrator's stated sha256 prefixes and byte sizes exactly):

| File | Size (B) | SHA-256 | Format |
|---|---|---|---|
| `ac3-01-baseline-depth2.png` | 126568 | `23ab3500938d0b37a2e23f0a5a762c32691376267d8ea2984f6f5f5e5c093e1f` | PNG 1400×1000 RGB |
| `ac3-02-depth3.png` | 107045 | `f09064a7e6c118f847fd6c37ab1e318cc9d3eeb453af5e05dfbc3b5bc8997da5` | PNG 1400×1000 RGB |
| `ac3-03-depth1.png` | 97552 | `4cad2adbdadb6224e820490f75eea69d752acfd5e3dc754851e7f953689c9a11` | PNG 1400×1000 RGB |
| `ac3-04-controls-hidden.png` | 96316 | `dbbec985e20afe34e8ccc1fc56cb39717018df49b30689087a1974bd70860aef` | PNG 1400×1000 RGB |
| `ac3-05-descended-3dclick.png` | 90427 | `d9342011dfe5457605316f3c052ac0da10470466d525e671797c0b325da2022c` | PNG 1400×1000 RGB |
| `ac3-06-ascended-back-to-root.png` | 108917 | `0f9c1391cb2a18ac150e29b66de9a4f518dabf60e98eafdb0c492de610f9c866` | PNG 1400×1000 RGB |
| `ac1-clause2-force-view-2d-minimap.png` | 228797 | `0951f1893aad8ffb7ff8c97a36528d9ce88b2ce66851539b6c06c5d3664a8453` | PNG 1400×1000 RGB |

All 7 paths resolved and read directly from `/Users/explosovebit/Work/ForgePlanWeb/` — none missing, none zero-byte, all valid PNG per `file`(1).
- Captured at: 2026-07-08 (same-day continuation of the EVID-103 capture session, same branch head).
- Captured by: orchestrator (live Playwright browser driving), relayed to this agent (evidence-recorder) for structuring.

## Raw input (orchestrator's observed-facts dispatch text, condensed to ≤2000 chars)

```
AC-3 depth control (1/2/3): baseline depth "2" pressed, ascend DISABLED at root (ac3-01). Clicked "3" (ac3-02). Clicked "1" -> DOM: button "1" became [active][pressed], "2"/"3" un-pressed -- pressed state moved 2->1 (ac3-03). Depth buttons are interactive; each toggles the visible-layer window.

AC-3 show/hide toggle: clicked "Hide 3D controls" -> DOM: depth-control group (1/2/3+ascend) DISAPPEARED, toggle relabeled "Show 3D controls" [active] (ac3-04). Clicked "Show 3D controls" -> DOM: group RESTORED with depth state preserved, toggle relabeled "Hide 3D controls" [expanded]. Round-trip verified.

AC-3 ascend: at root, ascend DISABLED. Descended via 3D-corner canvas click (.iso-map-corner canvas, 1226,831) -> DOM: depth auto-reset to "2", ascend ENABLED, 2D map followed into sub-map (breadcrumb: 4 root zones -> sub-zone labels) (ac3-05; re-confirms AC-2 sync). Clicked ascend -> DOM: 2D trail returned to root chips, ascend DISABLED again (ac3-06).

AC-1 clause 2: switched view Map -> "Force". browser_evaluate: iso3dCornerPresent:false, canvasCount:0 (no WebGL canvas), minimap present (minimapClasses:["minimap svelte-15cdyrc"]) (ac1-clause2). The {#if view==='map'} IsoMapCorner {:else} Minimap {/if} conditional holds -- non-Map views keep 2D minimap unchanged, three.js never mounts there.

Console: zero errors referencing widgets/iso-map, IsoMinimap, IsoMapCorner, shared-drill-bus. Errors mentioning ZONE_HIT_OPACITY/IsoScene all trace to the DELETED iso-spike route (confirmed absent on disk, deletion committed). Remaining noise: transient dev-server ERR_CONNECTION_REFUSED + 2x api/score 400 (score-suppression artifact, unrelated).
```

## Structured findings

**🧪 Manual QA scenario table:**

| # | Scenario | Steps | Observed | Expected | AC/FR closed | Pass/fail |
|---|---|---|---|---|---|---|
| 1 | Depth control — baseline | Load Map view at root | Depth button "2" pressed (default); ascend ⬆ disabled (nothing to climb at root). Screenshot `ac3-01-baseline-depth2.png` | Default depth state renders with ascend correctly disabled at root | AC-3 / FR-004 | **PASS** |
| 2 | Depth control — select "3" | Click depth button "3" | View updates to 3-level visible window. Screenshot `ac3-02-depth3.png` | Selecting depth 3 shows 3 levels of the stack | AC-3 / FR-004 | **PASS** |
| 3 | Depth control — select "1" | Click depth button "1" | DOM snapshot: button "1" became `[active][pressed]`, "2"/"3" un-pressed — pressed state moved 2→1. Screenshot `ac3-03-depth1.png` | Selecting depth 1 shows exactly 1 level; state moves correctly between buttons | AC-3 / FR-004 | **PASS** |
| 4 | Show/hide toggle — hide | Click "Hide 3D controls" (⋯) | DOM: the depth-control group (1/2/3 + ascend) disappeared from the panel; toggle relabeled "Show 3D controls" `[active]`. Screenshot `ac3-04-controls-hidden.png` | Toggling off hides the whole control panel | AC-3 / FR-004 | **PASS** |
| 5 | Show/hide toggle — show (round-trip) | Click "Show 3D controls" | DOM: depth-control group restored (buttons 1/2/3 + ascend back, depth state preserved), toggle relabeled "Hide 3D controls" `[expanded]` | Toggling on restores the panel without disturbing depth state — round-trip verified | AC-3 / FR-004 | **PASS** |
| 6 | Ascend — descend first (setup) | At root (ascend disabled), click a zone in the 3D corner canvas (`.iso-map-corner canvas`, 1226,831) | DOM: depth auto-reset to "2" (auto-grows to focusChain.length+1); ascend ⬆ became enabled; 2D composed-map followed into the zone's sub-map (breadcrumb changed from 4 root zones to sub-zone labels). Screenshot `ac3-05-descended-3dclick.png` | Descend enables ascend and re-syncs both surfaces (also re-confirms AC-2, already closed by EVID-103) | AC-3 / FR-004 (+ re-confirms AC-2 / FR-003) | **PASS** |
| 7 | Ascend — climb back to root | Click ascend ⬆ | DOM: 2D trail returned to the root flow chips ("All / Request path / Render / Entry points / Decision trail / Init / Start / Map API"); ascend ⬆ became disabled again. Screenshot `ac3-06-ascended-back-to-root.png` | Ascend climbs exactly one focus level on both surfaces and correctly re-disables at root | AC-3 / FR-004 | **PASS** |
| 8 | AC-1 clause 2 — non-Map view 2D minimap unchanged | Switch graph view Map → "Force" via "Change graph view" dropdown; run `browser_evaluate` | `iso3dCornerPresent: false` (`.iso-map-corner` not rendered); `canvasCount: 0` (no WebGL canvas mounted — three.js not loaded outside Map); 2D minimap present (`minimapClasses: ["minimap svelte-15cdyrc"]`). Screenshot `ac1-clause2-force-view-2d-minimap.png` | Non-Map views keep the 2D minimap unchanged; three.js never mounts there (also re-confirms FR-005 lazy load) | AC-1 clause 2 / FR-001 clause 2 (+ re-confirms FR-005) | **PASS** |
| 9 | Console cleanliness across scenarios 1–8 | Observe browser console throughout the session | Zero errors referencing `widgets/iso-map`, `IsoMinimap`, `IsoMapCorner`, `shared-drill-bus`. All `IsoScene`/`ZONE_HIT_OPACITY` errors trace to the deleted `src/routes/iso-spike/IsoScene.svelte` throwaway spike route (confirmed absent from the tracked tree: `git ls-files template/src/routes/iso-spike` → 0 files). Remaining noise: transient `api/instances`/`api/log`/`api/map`/`api/list` `ERR_CONNECTION_REFUSED` during dev-server restart + 2× `api/score` 400 (score-suppression test artifact) | No iso-feature console errors from current shipped code | (supports all rows above) | **PASS** |

**Coverage vs PRD-039 acceptance criteria — closing the gaps EVID-103 named:**

- **AC-3 (depth control 1/2/3 + ascend + show/hide toggle; FR-004)** — **CLOSED** by scenarios 1–7. Every element of FR-004's three acceptance-criteria bullets (depth selection changes visible level count; ascend climbs one level on both surfaces; toggle hides then restores without disturbing 2D map state) is now demonstrated with DOM/aria-state evidence, not just a static screenshot showing the controls exist (which is all EVID-103 had).
- **AC-1 clause 2 ("every other view's 2D minimap unchanged"; FR-001 second bullet)** — **CLOSED** by scenario 8. The Force view was visited and its 2D minimap confirmed present and unmodified, with the 3D corner element and WebGL canvas confirmed absent — the `{#if view === 'map'}` conditional in `DependencyGraph.svelte` (lines 219-226, grepped directly by this agent) is the source-level mechanism backing this observation.
- **Combined with EVID-103** (AC-2 bidirectional sync, FR-005/NFR-002 on-demand load, AC-1 render half): **this EVID + EVID-103 together close AC-1 (both clauses), AC-2, AC-3, FR-001, FR-002, FR-003, FR-004, FR-005, and NFR-002 for PRD-039.**
- Scenario 6 additionally **re-confirms** AC-2/FR-003 (bidirectional sync) via a fresh interaction path (3D-corner click descending the 2D map), independent corroboration rather than new coverage.
- Not addressed by this EVID (unchanged from EVID-103's scope): NFR-001 (bundle-size cap, owned by the companion ADR + EVID-099), NFR-003/NFR-004/NFR-005/NFR-006 (non-regression/idempotency/a11y/governance — covered by other EVIDs in the chain, not this browser-interaction pass), AC-4/AC-5/AC-6 (on-demand network trace beyond what EVID-103 captured, governance greps, quality-gate CI status).

**Environment caveat (recorded honestly, matching EVID-103's disclosure):** this is a **dev-server manual capture** — a one-shot interaction-proof, not an automated regression guard. No Playwright test suite exists yet for the iso-map widget's depth/ascend/toggle interactions beyond unit-level tests (`iso-view-state.render.test.ts`, `shared-drill-bus.svelte.test.ts` referenced in EVID-100/101); a future regression in this exact interaction path would only be caught by another manual pass or a new automated test.

## Recommended next steps

- Re-run `guardian` on the PRD-039 / ADR-011 / RFC-036 chain — both gaps guardian's EVID-102 named (AC-3 interaction, AC-1 clause-2) are now closed by this EVID + EVID-103 together.
- Consider promoting scenarios 1–8 above into a Playwright regression test for the iso-map widget's depth/ascend/toggle + view-swap behaviour, so this coverage is not solely a one-shot manual capture (per the environment caveat).
- No further browser-interaction capture is needed for AC-1/AC-2/AC-3/FR-001..FR-005/NFR-002 on this PRD — remaining open items are NFR-001 (dist-size cap, ADR-gated) and the non-regression/governance/quality-gate EVIDs already tracked separately in the chain (EVID-099/100/101).

## References

- Parent: `PRD-039`
- Related EVIDENCE: `EVID-103` (render-proof + on-demand-load + AC-2 sync — the sibling capture this EVID completes), `EVID-099` (build/cap/svelte-check/SSR measurement), `EVID-100` / `EVID-101` (code review + re-review), `EVID-102` (guardian gate CONCERNS — named the two gaps this EVID closes)
- Related ADR: `ADR-011` (lazy three.js/Threlte chunk, dist-cap raise 3→3.5 MiB)
- Related RFC: `RFC-036` (lazy 3D iso-map widget, shared-drill-bus)

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

