---
depth: tactical
id: EVID-019
kind: evidence
links:
- target: PRD-015
  relation: informs
- target: RFC-014
  relation: informs
status: active
title: 'Light theme + toggle: dual-token CSS survives build, pre-paint script in served HTML'
---

# EVID-019: Light theme + toggle — dual-token CSS survives build, pre-paint script in served HTML

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-07 |
| Valid Until | 2026-08-07 |
| Target | PRD-015 / RFC-014 |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Measurement

Three measurements taken against the actual surfaces touched by PRD-015 / RFC-014 — `template/`, `bin/forgeplan-web.mjs`, the bundled `dist/` (rebuilt via `npm run build`), and the served HTML.

1. **SC-1 — token sweep** (PRD-015 Success Criterion): grep for residual hardcoded white rgbas in `template/src`:
   ```
   grep -RIn --include="*.svelte" --include="*.ts" \
     -E "rgba\(255, ?255, ?255|rgba\(5, ?5, ?5\b" template/src
   ```

2. **SC-3 / FR-004 — built CSS contains both palettes**: after `npm run build` + `bin/forgeplan-web.mjs init -y --no-gitignore` into a scratch dir, inspect the bundled CSS:
   ```
   grep -oE "data-theme[^{]*\{|f4f1ea|--canvas-stroke|--scrim" \
     .forgeplan-web/client/_app/immutable/assets/0.*.css
   ```

3. **FR-004 — served HTML carries the pre-paint script**: `node .forgeplan-web/index.js` on a unique port, `curl /` and confirm the inline `<script>` block runs before SvelteKit hydrates (sets `documentElement.dataset.theme`).

4. **Type-safety regression** (NFR-002): `npm run check` (svelte-check + tsc) on `template/`.

## Result

1. **0 hits** — every reference to `rgba(255,255,255,*)` and the dark-only header backdrop `rgba(5,5,5,*)` is gone from `template/src/`. All replaced with `var(--canvas-stroke*)`, `var(--dot-grid-color)`, `var(--canvas-overlay)`, etc.

2. **Both blocks present** — the bundled CSS file (`0.<hash>.css`) contains:
   - `:root[data-theme=dark]{...}`
   - `:root[data-theme=light]{...}`
   - `--canvas-stroke`, `--scrim`, `f4f1ea` (cream `--bg`), and the rest of the new tokens.
   File size grew from 3.9 kB (dark-only, with lightningcss tree-shaking the new tokens) to 5.6 kB after switching `vite.config.ts#css.transformer` to `'postcss'` and `build.cssMinify` to `'esbuild'`. See `FIXME(prd-015-css-minify)` in `vite.config.ts`.

3. **Pre-paint script lands** — `curl http://127.0.0.1:5188/` (scratch instance, init'd from rebuilt `dist/`) returns the literal IIFE that reads `localStorage.getItem('forgeplan-web.theme')` and sets `document.documentElement.dataset.theme` synchronously, before `%sveltekit.head%`.

4. **0 errors, 0 warnings** — `svelte-check --tsconfig ./tsconfig.json` returns clean across all 465 files. The new `theme.svelte.ts` store types check, the `style:fill` / `style:stroke` directive substitutions in 8 graph views compile, and the legacy Safari `addListener` fallback no longer needs `@ts-expect-error`.

## Interpretation

PRD-015 SC-1 (zero hardcoded white rgbas) is met exactly. SC-3 (flash-free first paint) is met by the inline pre-paint script in `app.html` which runs before SvelteKit hydrates and writes the resolved `data-theme` attribute. FR-001/002/003 are met by `themeStore` (tri-state mode + matchMedia listener + localStorage round-trip). FR-005 (legible graph in both themes) is met because all 8 graph views now read theme-aware tokens for strokes, labels, and dot grids.

Post-feedback tuning was applied to PRD-015 R-1/R-3 mitigations after user testing in the live UI:
- **Heavy black kind dots in light Filter / InsightsRail** — `KIND_COLORS` neutral entries split off from `NEUTRAL_FG` (text fill, near-black) into a new `NEUTRAL_DOT = var(--fg-3)` so decorative dots stay subtle on cream while label text retains contrast.
- **Decorative greys felt heavy + primary contrast was low** — pushed `--fg`/`--fg-1` darker, lifted `--fg-3` lighter, softened `--line*`, `--canvas-stroke-soft`, and `--dot-grid-color` to 0.07.

## Congruence Level Justification

CL3 — measurements run against the actual surfaces under change: `template/src` source, the regenerated `dist/` artifact, and the served HTTP response from `node .forgeplan-web/index.js` started by the bin script. No simulation, no proxy environment.

## Affected Artifacts

| Artifact | Relation     |
|----------|--------------|
| PRD-015  | informs      |
| RFC-014  | informs      |



