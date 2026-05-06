---
depth: standard
id: RFC-014
kind: rfc
links:
- target: PRD-015
  relation: refines
prd: PRD-015
status: active
title: 'Light theme architecture: data-theme attribute + dual-token CSS'
---

# RFC-014: Light theme architecture — `data-theme` attribute + dual-token CSS

## Summary

Switch the existing single-palette CSS in `template/src/app/styles/app.css`
to a dual-palette system keyed by a `data-theme="light|dark"` attribute on
`<html>`. Drive that attribute from a small Svelte 5 store
(`shared/lib/theme.svelte.ts`) that reads `localStorage` and the
`prefers-color-scheme` media query, with a synchronous inline init script
in `app.html` to avoid a flash on first paint.

## Motivation

Per PRD-015, the viewer is currently dark-only. Making it dual-theme is
a self-contained UI change with a clear boundary: tokens in one CSS file
+ a handful of components that hardcode `rgba(255,255,255,*)` for
SVG strokes need to read from CSS vars instead.

## Goals

- One source of truth for color: CSS variables on `:root[data-theme=…]`.
- Zero new runtime npm deps.
- No flash of incorrect theme on first paint.
- Toggle UI affordance follows the existing `notify-toggle` button shape
  in the header (consistency with current chrome).

## Non-Goals

- Per-component user customisation.
- Sepia / OLED / high-contrast variants.
- Refactoring `dist/` or `dist-experimental/` directly — both rebuild
  from `template/`.

## Options considered

### Option A — `data-theme` attribute on `<html>` + dual `:root[data-theme]` blocks (chosen)

```css
:root[data-theme='dark']  { --bg: #050505; --fg: #f5f5f5; ... }
:root[data-theme='light'] { --bg: #f4f1ea; --fg: #1a1815; ... }
```

Toggle just flips the attribute; CSS does the rest. Works without JS for
default dark; the inline pre-paint script picks the right value before
hydration.

Pros: minimal diff, no media-query duplication, JS-driven explicit choice
overrides OS preference cleanly, easy to e2e-test by setting
`document.documentElement.dataset.theme`.

Cons: graph views currently hardcode white rgbas — must be tokenized.

### Option B — `prefers-color-scheme` media query only

Pros: zero JS for the OS-following case.

Cons: cannot model an explicit user override (Light user, Dark OS) without
JS that synthesises a media-query class anyway, and `@media` blocks balloon
the diff because every `:root` rule needs a duplicate inside `@media`.

### Option C — Tailwind / CSS-in-JS theme provider

Pros: ergonomic.

Cons: violates NFR-002 (no new runtime dep) and contradicts the project's
hand-rolled CSS-token aesthetic.

**Decision: Option A.**

## Token mapping

```
Token            Dark          Light
--bg             #050505       #f4f1ea  (cream canvas, matches forgeplan.dev)
--bg-1           #0b0b0b       #ffffff  (raised cards, white)
--bg-2           #141414       #f7f4ed
--bg-3           #1a1a1a       #ece8df
--fg             #f5f5f5       #1a1815  (near-black on cream)
--fg-1           #e5e5e5       #2a2724
--fg-2           #a3a3a3       #6b6760
--fg-3           #737373       #8c887f
--fg-4           #525252       #b5b1a8
--accent         #ff5a1f       #ff5a1f  (unchanged)
--accent-soft    #ff8a5b       #ff7a3f
--accent-dim     rgba(255,90,31,.18)  rgba(255,90,31,.12)
--good           #22c55e       #15803d
--bad            #ef4444       #dc2626
--line           rgba(255,255,255,.06) rgba(0,0,0,.06)
--line-2         rgba(255,255,255,.14) rgba(0,0,0,.12)
--line-3         rgba(255,255,255,.28) rgba(0,0,0,.22)
--dot-grid-color rgba(255,255,255,.10) rgba(0,0,0,.10)
--canvas-overlay rgba(5,5,5,.85)        rgba(244,241,234,.85)
--canvas-stroke  rgba(255,255,255,.45)  rgba(0,0,0,.55)   (NEW — for graph node strokes)
--canvas-stroke-2 rgba(255,255,255,.32) rgba(0,0,0,.40)   (NEW)
--canvas-stroke-soft rgba(255,255,255,.16) rgba(0,0,0,.12) (NEW)
--canvas-stroke-on-fill rgba(0,0,0,.4)  rgba(255,255,255,.55) (NEW — opposite-of-canvas)
--card-shadow    rgba(0,0,0,.5)         rgba(0,0,0,.08)
```

## Architecture

The data flow is one-way:

```
app.html inline script  ──reads──▶ localStorage 'forgeplan-web.theme'
        │
        └─writes─▶ <html data-theme="light|dark">  ◀──CSS reads via :root[data-theme]
                                ▲
                                │ on toggle click
ThemeStore.setMode() ───────────┘
   ▲
   │ Svelte 5 $state + $derived
   │
HealthBar segmented toggle ── [Auto | Light | Dark]
```

- **Single source of truth**: the `data-theme` attribute on `<html>`.
  Both the inline script (first paint) and the Svelte store (post-hydration)
  write it; CSS reads it via `:root[data-theme=…]` selectors.
- **`ThemeStore` (`shared/lib/theme.svelte.ts`)** holds `mode` and
  `systemPref` as `$state`, `effective` as `$derived`. `start()`
  attaches a `matchMedia('(prefers-color-scheme: light)')` listener so
  Auto follows OS changes without reload.
- **`HealthBar`** owns the toggle UI (segmented `[Auto | Light | Dark]`)
  and calls `themeStore.setMode(...)` on click.
- **CSS** is layered: `:root` (default → dark fallback) →
  `:root[data-theme='dark']` (explicit) → `:root[data-theme='light']`
  (override via attribute selector). Component-scoped CSS reads tokens
  via `var(--…)` unmodified.
- **SVG attribute substitution**: graph views use Svelte's `style:fill` /
  `style:stroke` directives instead of bare `fill={...}` / `stroke={...}`
  attributes so `var()` resolves through inline CSS. SVG XML attributes
  do not parse `var()` — only inline-styled fill/stroke do.

## Implementation

### Phase 1 — tokens

- Rewrite `template/src/app/styles/app.css` `:root` block as
  `:root[data-theme='dark']` + `:root[data-theme='light']`.
- Default fallback `:root` block points to the dark palette so CSS still
  renders if no JS / no attribute (graceful).
- Add new `--canvas-stroke*` and `--canvas-overlay` tokens.

### Phase 2 — store + pre-paint

- New file: `template/src/shared/lib/theme.svelte.ts` exports
  `themeStore` (Svelte 5 `$state`-based) with
  `mode: 'auto' | 'light' | 'dark'` and a derived `effective: 'light' | 'dark'`
  that reads `matchMedia('(prefers-color-scheme: light)')` on Auto.
- `app.html` gets an inline `<script>` (synchronous, before SvelteKit) that
  reads `localStorage.getItem('forgeplan-web.theme')` and sets
  `document.documentElement.dataset.theme` accordingly. Reads the media
  query for Auto fallback.
- `app/styles/app.css` `color-scheme: dark` becomes per-attribute too.

### Phase 3 — toggle UI

- Add a small segmented `[Auto | Light | Dark]` control in
  `HealthBar.svelte` next to the existing notify toggle. Reuses the
  `view-toggle` styling pattern from `HomePage.svelte` for visual
  consistency.

### Phase 4 — graph view sweep

- Replace hardcoded white rgbas in `widgets/dependency-graph/ui/*.svelte`
  with `var(--canvas-stroke*)` / `var(--dot-grid-color)`.
- `entities/artifact/lib/theme.ts`: `NEUTRAL_BORDER` /
  `NEUTRAL_FG` lose their hardcoded values and become CSS-var readers
  (via `getComputedStyle(document.documentElement)`); cache per-frame.
- `Dialog.svelte` overlay `rgba(0,0,0,.6)` becomes a token too
  (`--scrim`).

### Phase 5 — evidence + activate

- Smoke: `npm run build` from repo root → bin script init in
  `/tmp/scratch` → start server → hit `/` → confirm light + dark via
  curl-like attribute read (manual screenshot).
- EvidencePack EVID-019 with `## Structured Fields`
  `verdict: supports`, `congruence_level: 3`, `evidence_type: test`.

## Risks

- **R1 (high)**: graph views are 8 files with many hardcoded rgbas; miss
  one and a stroke disappears in light mode. *Mitigation*: grep gate as
  the SC-1 measurement.
- **R2 (medium)**: `entities/artifact/lib/theme.ts` is currently called
  from D3-rendered SVG that returns string colors. Reading
  `getComputedStyle` synchronously is fine but must invalidate when
  `data-theme` changes — wire a `MutationObserver` or read-on-demand.

## Open questions

- Should `auto` re-read on `prefers-color-scheme` change without reload?
  Yes — the matchMedia listener stays attached.

## Affected files

Same as PRD-015 § Affected files.


