---
depth: standard
id: PRD-021
kind: prd
status: active
title: Replace bespoke toaster with svelte-sonner; extend ToggleGroup with spacing prop and outline variant
---

# PRD-021: Replace bespoke toaster with svelte-sonner; extend ToggleGroup with spacing prop and outline variant

## Executive Summary

### Vision

Align two `template/src/shared/ui/` primitives — `Toaster` and `ToggleGroup` —
with shadcn-svelte's reference implementations so the catalogue is on the same
footing as the broader ecosystem and offers a richer composition surface for
upper layers.

### Problem

Today `shared/ui/toaster/` is a hand-rolled store + DOM rendering pair
(~230 LOC) that lacks several behaviours users expect from a modern toast
(stacking limits, hover-to-pause, swipe-to-dismiss, promise variant). Replacing
it wholesale with `svelte-sonner` (the engine shadcn-svelte recommends) is
cheaper than adding those features by hand and removes a maintenance liability.

`shared/ui/toggle-group/` only supports two variants (`default`, `outline-mono`)
and exposes no public knob to control inter-item gap. The artifact filters
widget needs a cleaner, less mono-styled outlined look with visible breathing
room between chips. Patching it from `widgets/` would violate rule 24
(`shared/ui` ownership).

**Impact**: Filters look heavy / cramped at the current visual; toasts cannot
be paused on hover; the catalogue is partially out of sync with the docs the
team copies recipes from.

### Target Users

| Persona | Описание | Ключевая боль |
|---------|----------|---------------|
| Forgeplan-web user | Reads PRD/RFC/Evidence in the dense graph view | Filter chips look heavy; transient toasts disappear too fast to read |
| Contributor on `template/` | Composes new widgets out of `shared/ui/` | Limited variant set; cannot control toggle-group spacing without `:global()` patches |

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Toaster API contract preserved | Number of public exports broken | 0 | 0 | Same PR | grep call sites in `template/src/**/*.{svelte,ts}` |
| SC-2 | Filters use new outline variant + spacing | Re-skin `:global()` overrides in `widgets/artifact-filters/` | 0 | 0 | Same PR | rule-24 verification snippet |
| SC-3 | Build green on Node 20.19+ | `npm run check && npm run build` exit code | 0 | 0 | Same PR | CI matrix |
| SC-4 | Bundle size of `dist-experimental/` | Bytes | < 3M | < 3M (regression budget +50KB) | Same PR | `scripts/build.mjs` assertion |

---

## Product Scope

### MVP (In-Scope)

- Replace `shared/ui/toaster/` with a thin wrapper over `svelte-sonner` while
  keeping the public surface (`Toaster`, `toast`, `toast.info/success/warning/danger`).
- Add `spacing?: boolean` prop to `ToggleGroup` (defaults `false`). When `true`,
  items get visible gaps and lose the shared container chrome — matching
  shadcn-svelte's `spacing` behaviour.
- Add `'outline'` variant to `ToggleGroup` matching shadcn-svelte (transparent
  group container, per-item border, no mono typography).
- Switch `widgets/artifact-filters/ui/Filters.svelte` to `variant="outline"`
  with `spacing={true}`.
- Update `/playground` showcase for both primitives.

### Out of Scope

- Migrating to shadcn-svelte's `bits-ui`-only Toggle (we keep our own wrapper).
- Replacing `shared/ui/toggle-group/` markup with shadcn's; we only add a
  variant/prop.
- Theming / dark-mode work beyond keeping current `data-theme` behaviour.
- Removing the legacy `outline-mono` variant (call sites stay).

### Growth Vision

- After this lands, broader migration to `svelte-sonner` features
  (`toast.promise`, custom JSX) opens up.
- `spacing` prop pattern applies to other group primitives (Tabs, Radio).

---

## User Journeys

### Journey 1: User reads filters

**Цель пользователя**: Quickly scan available kinds/statuses and click only
those that matter.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Opens the graph view | Sees Filters in the left aside | — |
| 2 | Looks at Kind / Status sections | Each chip is a separately bordered toggle with breathing room | Outline variant + spacing |
| 3 | Toggles ADR | Chip reflects pressed state via accent border | bits-ui handles `data-state='on'` |

**Результат**: Reduced visual weight + clear pressed/unpressed state.

### Journey 2: Contributor adds a new toast

**Цель пользователя**: Show a transient notification from a server action.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | `import { toast } from '@/shared/ui'` | Same import path as before | API preserved |
| 2 | Calls `toast.success('Saved')` | Sonner-rendered toast appears in bottom-right | Hover pauses dismissal |

**Результат**: No call-site changes; richer behaviour for free.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | Contributor can call `toast(...)`, `toast.success/info/warning/danger` from any client-side code | Journey 2 |
| FR-002 | Core | Must | Layout-level `<Toaster />` mounts svelte-sonner once with project-aligned defaults | Journey 2 |
| FR-003 | Core | Must | Composer can pass `spacing={true}` to `ToggleGroup` to opt into spaced items | Journey 1 |
| FR-004 | Core | Must | Composer can pass `variant="outline"` to `ToggleGroup` for shadcn-style outlined items | Journey 1 |
| FR-005 | UX | Should | Filters widget renders with `variant="outline"` + `spacing={true}` | Journey 1 |
| FR-006 | UX | Should | `/playground` showcases new variant + spacing combinations under both `data-theme` values | Journey 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Bundle | `dist-experimental/index.js` shall stay below assertion cap | < 3M | After `npm run build` | `scripts/build.mjs` assert |
| NFR-002 | Compatibility | All existing `toast.*` call sites shall continue to compile | 0 type errors | `npm run check` | svelte-check |
| NFR-003 | A11y | New ToggleGroup variant shall preserve `data-state` and focus-visible styling | 100% per `/playground` | Both themes | Manual + axe smoke |
| NFR-004 | Rule compliance | `widgets/` MUST NOT add `:global(.toggle-group...)` overrides | 0 matches | After PR | Rule-24 grep snippet |

---

## Acceptance Criteria

### AC-1: Toast public API preserved

```gherkin
Given an existing call site `toast.success('Saved')`
When the dev runs `npm run check` after the migration
Then svelte-check exits 0
And the runtime toast renders via svelte-sonner with the success variant
```

### AC-2: Filters use outline + spacing

```gherkin
Given the `/` page with active filters
When the user inspects the rendered DOM
Then the ToggleGroup root carries `variant="outline"` and `spacing` data attribute
And no `:global(.toggle-group*)` selector exists in `widgets/artifact-filters/`
```

### AC-3: Playground showcase

```gherkin
Given `/playground`
When the user visits the ToggleGroup section
Then there are tiles for `default`, `outline-mono`, and `outline` variants
And each tile demonstrates `spacing={false}` and `spacing={true}` side by side
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| svelte-sonner | npm runtime | Pending add to `template/package.json#dependencies` | This PRD |
| bits-ui ToggleGroup | npm runtime | Already present | — |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | svelte-sonner SSR mismatch (window references) | Low | Medium | Mount `<Toaster />` only in root layout; sonner is SSR-safe per docs | dev |
| R-2 | Bundle bloat exceeds 3M cap | Low | Medium | Measure post-build; sonner is ~6KB gzip + tiny CSS | dev |
| R-3 | Existing `outline-mono` callers visually regress | Low | Low | We only add new variant, don't rename | dev |
| R-4 | Sonner's CSS leaks across themes | Medium | Low | Override sonner CSS variables to project tokens (`--bg-1`, `--fg-1`, …) | dev |

---

## Affected Files

- `template/package.json` — add `svelte-sonner` dependency
- `template/src/shared/ui/toaster/Toaster.svelte` — re-implement on top of svelte-sonner
- `template/src/shared/ui/toaster/toaster-store.svelte.ts` — re-export sonner's `toast` with project-shape helpers
- `template/src/shared/ui/toaster/index.ts` — public surface preserved
- `template/src/shared/ui/toggle-group/ToggleGroup.svelte` — `spacing` prop + `'outline'` variant
- `template/src/shared/ui/toggle-group/ToggleGroupItem.svelte` — outline-variant styling
- `template/src/widgets/artifact-filters/ui/Filters.svelte` — switch to outline + spacing
- `template/src/routes/playground/+page.svelte` — new showcase tiles
- `template/src/shared/ui/README.md` — document new prop / variant

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| RFC-018 | Architecture proposal for this PRD | draft |
| EVID-026 | Build + smoke evidence | draft |
| ADR-002 (existing) | Sub-agent dispatch — informs single-agent workflow choice | active |
| Rule 24 | shared/ui ownership constraint | active |



