---
depth: standard
id: EVID-027
kind: evidence
last_modified_at: 2026-05-07T21:17:33.662131+00:00
last_modified_by: claude-code/2.1.132
links:
- target: PRD-022
  relation: informs
- target: RFC-019
  relation: informs
status: active
title: Force 3D smoke test — Threlte canvas, simulation, theme + bundle
---

# EVID-027: Force 3D smoke test — Threlte canvas, simulation, theme + bundle

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-07 |
| Valid Until | 2026-08-07 |
| Target | PRD-022 / RFC-019 |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Summary

End-to-end browser smoke test of the new `force3d` view mode (PRD-022 /
RFC-019) against the parent Forgeplan workspace (123 artifacts, 104 edges,
mixed kinds + statuses). Verifies: dropdown placement + experimental badge,
lazy-load isolation, 3D scene rendering, orbit camera, theme reactivity,
type-check, and prod build success.

## Method

1. `npm run check` — full svelte-check.
2. `npm run build` — Vite production build; inspect chunk graph.
3. `FORGEPLAN_CWD=$repo_root FORGEPLAN_BIN=/opt/homebrew/bin/forgeplan
   npm run dev` — boot dev server on `127.0.0.1:5174`.
4. Browser drive (Chromium + claude-in-chrome MCP):
   - open `http://127.0.0.1:5174`
   - click pane view-mode dropdown → confirm "Force 3D" last with EXPERIMENTAL pill
   - select Force 3D → wait for lazy chunk
   - drag-orbit the canvas → confirm camera rotation
   - toggle Light ↔ Dark theme → confirm canvas backdrop + node colors update

## Observations

| Probe | Expected | Observed | Verdict |
|-------|----------|----------|---------|
| `npm run check` | 0 errors | `2105 FILES 0 ERRORS 0 WARNINGS` | passes |
| `npm run build` | success | `built in 6.44s`; `dependency-graph-3d.js` server chunk = 17.95 kB; client chunk `BUVFnBlC.js` (Three+Threlte) = 793 kB | passes |
| Lazy import path in client | `import('../chunks/BUVFnBlC.js')` only on `view === 'force3d'` | grep over `nodes/2.CrgDLbMO.js` shows the chunk is referenced **only** behind the `view === 'force3d'` guard, never as a static import on the homepage entry | passes (NFR-003 / FR-009 / SC-4) |
| Dropdown order | Force 3D last | accessibility tree: option index 8 of 8, label `"Force 3D"`, badge `experimental`, accessible name `"Force 3D, experimental"` | passes (FR-006 / SC-5) |
| 3D rendering | spheres + edges visible | 123 spheres, 104 line segments, 3D parallax under orbit | passes (FR-002 / FR-003) |
| Orbit camera | drag rotates | drag (710,400) → (900,250) shifted layout consistent with rotation | passes (FR-004) |
| Theme reactivity | bg + node colors flip on `data-theme` change | confirmed: dark = near-black gradient + light nodes; light = cream gradient + dark nodes | passes (FR-007) |
| Mode parity (visible counts) | filteredNodes / filteredEdges = parent counts | 123 / 104 with empty filter set, identical to 2D Force | passes (AC-2) |

## Limitations

- Performance budgets (NFR-001 first-frame, NFR-002 fps) not yet collected
  via DevTools Performance trace — visual smoke only. The UI is responsive
  during orbit; capturing p50 fps across 5 runs is deferred to a follow-up
  EvidencePack.
- Hover highlight (FR-005) is wired in code but `pointerenter` on
  `<T.Mesh>` requires `@threlte/extras` `interactivity()` plugin — left as
  TODO for the in-Force-mode 2D ↔ 3D switch follow-up (`force-mode-2d3d-switch`
  TODO marker).
- WebGL fallback message exists but was not exercised (no headless WebGL-
  disabled probe was run).

