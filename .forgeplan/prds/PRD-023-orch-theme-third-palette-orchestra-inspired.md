---
depth: standard
id: PRD-023
kind: prd
status: active
title: Orch theme — third palette (Orchestra-inspired)
---

---
id: PRD-023
title: "Orch theme — third palette (Orchestra-inspired)"
status: Draft
author: nikitafedorov
created: 2026-05-08
updated: 2026-05-08
priority: P2
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-023: Orch theme — third palette (Orchestra-inspired)

## Progress

```
Phase 0  ████████████████████████  4/4  (100%)
─────────────────────────────────────────────────
TOTAL                              4/4  (100%)
```

---

## Executive Summary

### Vision

Add a third theme `orch` to the Forgeplan web dashboard — a deep-black,
violet-glow palette inspired by orchestra.app's marketing site — alongside the
existing `light` and `dark` palettes. The visible toggle stays at three
positions (Auto / Light / Dark); `orch` is a hidden Easter egg activated by
clicking **Dark** five times in a row.

### Problem

The dashboard currently ships exactly two palettes: a near-black `dark`
(default, brand orange `#ff5a1f` accent) and a cream `light` (forgeplan.dev
marketing parity). Users who prefer a higher-contrast pure-black surface with
a cool accent (instead of the warm orange) have no option — the toggle has
three positions but the third (`auto`) only resolves to one of the two
existing palettes.

**Impact**: Users who keep the dashboard open all day on OLED displays report
that the warm orange dominates peripheral vision when they're not actively
parsing the graph. The orchestra-style palette (violet/lavender accent on
near-pure-black) is a known-good solution for this complaint pattern.

### Target Users

| Persona | Описание | Ключевая боль |
|---------|----------|---------------|
| Long-session reviewer | Keeps dashboard pinned in second monitor for hours | Warm orange accent fatigues peripheral vision over 4+ h sessions |
| OLED laptop user | Prefers true-black surfaces for battery + glare | Current `dark` `#050505` is near-black but warm-tinted; wants neutral pure-black |

### Differentiators

- Third palette is opt-in (toggle position), never auto-resolved — users who
  don't want it never see it.
- Reuses every existing CSS-var contract (`--bg`, `--fg-*`, `--accent`,
  `--canvas-*`, `--edge-*`) so zero component-level code changes are needed.
- Inline first-paint script keeps zero-flash boot for the new palette too.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Toggle exposes three explicit palettes plus Auto | Toggle button count | 3 (Auto/Light/Dark) | 4 (Auto/Light/Dark/Orch) | This PR | Manual: open `/`, count toggle items |
| SC-2 | First-paint correctness — no FOUC when `orch` is the saved mode | Pre-paint script applies orch on load | 2 modes handled | 3 modes handled | This PR | Set `localStorage['forgeplan-web.theme']='orch'`, hard reload, observe first frame |
| SC-3 | Every existing component renders correctly under `orch` | CSS-var coverage | 100% (dark/light) | 100% (dark/light/orch) | This PR | Visual diff against `/playground` |
| SC-4 | TypeScript compile passes after extending `ThemeMode` | `svelte-check` errors | 0 | 0 | This PR | `cd template && npm run check` |

---

## Product Scope

### MVP (In-Scope)

- New CSS palette block `:root[data-theme='orch']` in `template/src/app/styles/app.css`
  populating every token currently defined for `dark`/`light` (surfaces,
  foreground, accent, status, lines, canvas, edges, nodes, dot grid).
- Extend `ThemeMode` (and `ThemeEffective`) in
  `template/src/shared/lib/theme.svelte.ts` to include `'orch'`.
- Update the inline pre-paint script in `template/src/app.html` to accept and
  apply `'orch'` from `localStorage`.
- Add a fourth `ToggleGroupItem` (id: `orch`, label: `Orch`) to
  `template/src/widgets/health-bar/ui/HealthBar.svelte`.
- Update `THEME_OPTIONS` and `isThemeMode` type guard in HealthBar.

### Out of Scope

- Changing default mode (still `auto`).
- Auto resolving to `orch` — the system media query is binary
  (`prefers-color-scheme: light | dark`) and `orch` is an opt-in flavour, not
  a standard system preference.
- Per-component restyling — `orch` is a pure token-swap.
- Marketing-site (`forgeplan.dev`) parity for the new palette.

### Growth Vision

- Could become a sub-mode of `dark` (Auto → Dark variant picker) if more
  alternative dark palettes are added later.
- Light-side companion (`orch-light`?) deferred until user demand exists.

---

## User Journeys

### Journey 1: Long-session reviewer switches to Orch palette

**Цель пользователя**: Replace the warm orange dashboard with a violet-accent
near-pure-black palette for a multi-hour review session.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Opens dashboard at `/` | Dashboard renders in current palette (dark/light per Auto) | Baseline |
| 2 | Locates theme toggle in health bar (top-right) | Sees three buttons: Auto / Light / Dark | Toggle visibility unchanged |
| 3 | Clicks "Dark" five times in a row | First click switches to Dark; subsequent four clicks accumulate a streak counter; on the fifth click the palette swaps to Orch (pure-black + lavender) without flash | All five clicks land on Dark; clicking Auto/Light at any point resets the streak |
| 4 | Reloads page | First paint already shows Orch palette (no FOUC) | Pre-paint script reads `localStorage` |

**Результат**: User keeps the dashboard in Orch palette across sessions until
they explicitly switch back.

### Journey 2: OLED laptop user verifies pure-black surfaces

**Цель пользователя**: Confirm the new palette uses `#000` (or near) so OLED
pixels turn off where backgrounds render.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Switches to Orch palette | Background paints `--bg` (≈ `#000`) | Verifiable via inspector |
| 2 | Inspects body in DevTools | `background-color: rgb(0,0,0)` (or ≤ `#050505`) | OLED-friendly |

**Результат**: Battery saved, glare reduced.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | User can activate the `Orch` theme by clicking the **Dark** toggle button five times in a row (consecutive clicks; counter resets when any non-Dark item is clicked) | Journey 1 |
| FR-002 | Core | Must | System persists the chosen mode (including `orch`) in `localStorage` under key `forgeplan-web.theme` | Journey 1 |
| FR-003 | Core | Must | System applies the `orch` palette on first paint when `localStorage` holds `orch` (no FOUC) | Journey 1 |
| FR-004 | Core | Must | System exposes a complete `:root[data-theme='orch']` CSS block defining every token also defined for `dark` and `light` | Journey 2 |
| FR-005 | UX | Should | `orch` palette uses near-pure-black surfaces (≤ `#0a0a0a` for `--bg`) and a violet/lavender accent | Journey 2 |
| FR-006 | UX | Should | `Auto` mode never resolves to `orch` — it stays binary (`light` ↔ `dark`) per system media query | Journey 1 |
| FR-007 | UX | Must | The visible health-bar theme toggle exposes exactly three positions (Auto / Light / Dark); the `orch` mode has no visible toggle button | Journey 1 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | Theme switch shall paint | < 1 frame (~16ms) | After click on toggle | Manual perf-trace in DevTools (no JS work beyond a `dataset.theme` write) |
| NFR-002 | Compatibility | TypeScript check shall pass | 0 errors | After extending `ThemeMode` union | `cd template && npm run check` exit code 0 |
| NFR-003 | Maintainability | Net new CSS shall be one contiguous palette block | ≤ 80 LOC added to `app.css` | Per the existing `dark` block size | `git diff --stat template/src/app/styles/app.css` |
| NFR-004 | A11y | Foreground/background contrast shall meet WCAG AA | ≥ 4.5:1 for body text | `--fg-1` on `--bg-1` | Manual contrast-check via DevTools |

---

## Acceptance Criteria

### AC-1: Toggle has four positions, Orch sticks across reloads

```gherkin
Given the dashboard is loaded in default mode
When  the user clicks the "Orch" button in the health-bar theme toggle
Then  document.documentElement.dataset.theme === "orch"
And   localStorage.getItem("forgeplan-web.theme") === "orch"
When  the user reloads the page
Then  document.documentElement.dataset.theme === "orch" on the first frame (no flash of dark/light)
```

### AC-2: All CSS tokens defined for orch

```gherkin
Given the orch palette block exists in app.css
When  a reviewer greps :root[data-theme='dark'] for every --token
Then  every one of those tokens is also defined under :root[data-theme='orch']
```

### AC-3: Type system stays sound

```gherkin
Given ThemeMode now includes 'orch'
When  the project runs `npm run check` in template/
Then  exit code is 0 and no svelte-check warnings reference theme code
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| PRD-015 / RFC-014 (existing dual-theme infrastructure) | Internal | Active | — |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Some legacy `:global()` rule hard-codes a dark/light value bypassing the token contract, breaking `orch` | Medium | Low | Smoke-test `/playground` with `data-theme='orch'`; if breakage found, fix the offender to read the token | impl agent |
| R-2 | Adding a fourth toggle item makes the health bar overflow on narrow viewports | Low | Low | ToggleGroup already wraps; verify at 1024px width | impl agent |

---

## Affected Files

- `template/src/app/styles/app.css` — add `:root[data-theme='orch']` palette block
- `template/src/shared/lib/theme.svelte.ts` — extend `ThemeMode`, `ThemeEffective`, `isMode` guard
- `template/src/app.html` — pre-paint script accepts/applies `'orch'`
- `template/src/widgets/health-bar/ui/HealthBar.svelte` — extend `isThemeMode` guard, add Dark-click streak counter that activates `orch` on the 5th consecutive click; toggle stays at three visible positions
- `template/src/shared/ui/toggle-group/ToggleGroupItem.svelte` — forward optional `onclick` prop to the bits-ui primitive (rule-24-permitted primitive prop addition; needed for streak counting since `onValueChange` does not fire on repeat clicks of the already-selected item)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-015 | Predecessor (dual-theme system) | active |
| RFC-014 | Predecessor (theme architecture) | active |

(No SPEC/RFC/ADR satellites for this PRD — Standard depth, token-swap scope.)

---

> **Next step**: validate → implement → smoke → evidence → activate.


