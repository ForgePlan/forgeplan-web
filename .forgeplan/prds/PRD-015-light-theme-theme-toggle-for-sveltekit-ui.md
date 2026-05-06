---
depth: standard
id: PRD-015
kind: prd
status: active
title: Light theme + theme toggle for SvelteKit UI
---

# PRD-015: Light theme + theme toggle for SvelteKit UI

## Executive Summary

### Vision

Make the `.forgeplan-web/` viewer comfortable to read on bright displays
by shipping a light theme alongside the existing dark theme, with a
user-controlled toggle that respects the OS preference by default.

### Problem

The SvelteKit viewer is currently dark-only (`color-scheme: dark` in
`template/src/app/styles/app.css`). Users running their OS in light mode,
or projecting on screens in lit rooms, get an out-of-context dark UI
that does not match the marketing site's light cream/beige aesthetic
(see `forgeplan.dev`).

**Impact**: viewer feels off-brand vs. `forgeplan.dev`; readability
complaint surface; user explicitly requested it.

### Target Users

| Persona | Description | Key pain |
|---------|-------------|----------|
| Forgeplan user (light-mode OS) | Runs `npx @forgeplan/web start` on a Mac/Linux/Windows in default light system theme | Viewer clashes with the rest of the desktop, hard to read in bright environments |
| Brand-conscious operator | Demos the viewer in talks / docs alongside `forgeplan.dev` | Dark-only viewer breaks visual continuity with the cream-based marketing site |

---

## Success Criteria

| ID   | Criterion                                       | Metric                                | Current | Target               | Timeframe       | How to measure                                          |
|------|-------------------------------------------------|---------------------------------------|---------|----------------------|-----------------|---------------------------------------------------------|
| SC-1 | Viewer supports light theme without dark-mode visual residue | hardcoded `rgba(255,255,255,*)` in `template/src` | many   | 0 (all via CSS vars) | this PR        | `grep -RIn "rgba(255, 255, 255" template/src` returns 0 |
| SC-2 | Theme toggle persists across reloads             | localStorage round-trip               | n/a     | 100%                 | this PR         | Manual: choose Light → reload → still Light             |
| SC-3 | Theme switch is flash-free                       | FOUC frames on first paint            | n/a     | 0                    | this PR         | Inline pre-paint script reads `localStorage` before SvelteKit hydrates |
| SC-4 | OS preference is honoured by default              | `prefers-color-scheme: light` users get light  | n/a | 100%        | this PR         | Manual: set OS to light, clear storage, reload          |

---

## Product Scope

### MVP (in-scope)

- Single light palette derived from screenshots the user supplied
  (cream/beige `#f4f1ea`-ish canvas, near-black text, brand orange
  accent unchanged).
- Tri-state toggle: `auto` (follow OS) | `light` | `dark`. Default `auto`.
- Persist user choice in `localStorage` under `forgeplan-web.theme`.
- Pre-paint init script in `app.html` so the first frame is correct
  (no flash of wrong theme).
- Toggle UI lives in the existing top header (`HealthBar`).
- All graph views (Force, Tree, Radial, Lanes, Sankey, Sunburst,
  Matrix) render correctly in both themes — no white-on-white or
  black-on-black strokes.

### Out of scope

- Custom user-defined palettes.
- High-contrast / accessibility-specific themes (separate concern).
- Re-skinning the marketing site `forgeplan.dev` (different repo).
- Touching `dist/` or `dist-experimental/` directly — those rebuild
  from `template/`.

### Growth

- Per-component theme overrides.
- Optional sepia / OLED-pure-black variants.

---

## User Journeys

### Journey 1: Light-mode user starts the viewer

**User goal**: comfortably read the artifact graph on a light desktop.

| Step | User action                                                | System response                                                              |
|------|-------------------------------------------------------------|------------------------------------------------------------------------------|
| 1    | Runs `npx @forgeplan/web start`, opens browser              | First paint shows light theme (OS preference detected via media query)       |
| 2    | Notices toggle in top header                                | Toggle shows `auto` highlighted                                              |
| 3    | Clicks `dark` to override                                    | UI repaints to dark theme; choice saved to localStorage                       |
| 4    | Reloads page                                                | Dark theme applied before hydration; no flash                                |

### Journey 2: Dark-mode user wants permanent dark

**User goal**: keep dark theme forever even if OS toggles.

| Step | User action          | System response                                  |
|------|----------------------|--------------------------------------------------|
| 1    | Opens viewer (auto, dark) | Dark applied                                |
| 2    | Clicks `dark` to lock | `auto` deselected; `dark` highlighted; saved      |
| 3    | OS later switches to light | Viewer stays dark (explicit choice wins)    |

---

## Functional Requirements

| ID     | Category | Priority | Requirement                                                                                | Journey   |
|--------|----------|----------|---------------------------------------------------------------------------------------------|-----------|
| FR-001 | Core     | Must     | User can switch the viewer between Light, Dark, and Auto from a control in the top header   | Journey 1 |
| FR-002 | Core     | Must     | Viewer remembers the last explicit choice (Light or Dark) across page reloads               | Journey 2 |
| FR-003 | Core     | Must     | When set to Auto, viewer follows the OS `prefers-color-scheme` and updates if it changes    | Journey 1 |
| FR-004 | UX       | Must     | Viewer paints the correct theme on first frame (no flash of wrong theme)                    | Journey 1 |
| FR-005 | UX       | Should   | Both themes render the artifact graph (all 8 view modes) with legible strokes and labels    | Journey 1 |

---

## Non-Functional Requirements

| ID      | Category    | Requirement                                              | Metric                              | Condition                            | Measurement                          |
|---------|-------------|----------------------------------------------------------|-------------------------------------|--------------------------------------|--------------------------------------|
| NFR-001 | Performance | Theme switch shall apply within one frame                | < 16ms                              | Switch on a 1k-node graph             | Manual visual / DevTools Performance |
| NFR-002 | Compat      | No new runtime dependency added to `template/package.json` | 0 new entries                       | After feature lands                  | Diff inspection                      |
| NFR-003 | Bundle      | Feature shall not grow `dist-experimental/index.js` by more than 5 kB | < 5 kB delta              | After `npm run build`                | `du -sh dist-experimental/index.js`  |

---

## Acceptance Criteria

### AC-1: Auto follows OS

```gherkin
Given the user has never explicitly chosen a theme
And   the OS prefers-color-scheme is light
When  the user opens the viewer
Then  the viewer renders in the light palette
And   the toggle shows Auto highlighted
```

### AC-2: Explicit choice survives reload

```gherkin
Given the user clicks Dark in the header toggle
When  the user reloads the page
Then  the viewer renders in dark on the first frame
And   the toggle shows Dark highlighted
```

### AC-3: All graph views legible in light

```gherkin
Given the user is on the light theme
When  the user cycles through Force, Tree, Radial, Lanes, Sankey, Sunburst, Matrix views
Then  every node label is readable
And   no stroke is white-on-cream or black-on-black
```

---

## Dependencies

| Dependency                  | Type      | Status |
|-----------------------------|-----------|--------|
| `template/src/app/styles/app.css` (token system) | Internal | Ready |
| RFC-014 (theme toggle architecture)               | Internal | Drafted with this PRD |

---

## Risks & Mitigations

| ID  | Risk                                                                   | Probability | Impact | Mitigation                                                                                       |
|-----|------------------------------------------------------------------------|-------------|--------|--------------------------------------------------------------------------------------------------|
| R-1 | Hardcoded `rgba(255,255,255,*)` in graph views breaks light theme       | High        | High   | Sweep + replace with new theme-aware tokens (`--canvas-stroke-*`)                               |
| R-2 | First-paint flash if pre-paint script is async                          | Medium      | Medium | Inline script in `app.html` runs synchronously before SvelteKit hydration                        |
| R-3 | Theme color leaks into Force-graph dot grid (currently `rgba(255,255,255,0.10)`) | Medium      | Medium | Replace with `--dot-grid-color` token                                                            |

---

## Affected files

- `template/src/app.html` (pre-paint init script + `data-theme` attribute)
- `template/src/app/styles/app.css` (dual-theme tokens via `[data-theme]`)
- `template/src/shared/lib/theme.svelte.ts` (new — theme store)
- `template/src/widgets/health-bar/ui/HealthBar.svelte` (toggle UI)
- `template/src/widgets/dependency-graph/ui/*.svelte` (replace hardcoded white rgbas)
- `template/src/widgets/dependency-graph/lib/relation.ts` (tokenize)
- `template/src/entities/artifact/lib/theme.ts` (light-theme-aware border colors)
- `template/src/shared/ui/dialog/Dialog.svelte` (overlay rgba → token)

## Related Artifacts

| Artifact | Relation              |
|----------|-----------------------|
| RFC-014  | Architecture proposal |
| EVID-019 | Smoke evidence         |

