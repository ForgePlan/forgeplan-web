---
depth: standard
id: PRD-028
kind: prd
links:
- target: PRD-029
  relation: informs
status: draft
title: Combobox primitive in shared/ui (bits-ui port)
---

---
id: PRD-028
title: "Combobox primitive in shared/ui (bits-ui port)"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
priority: P2
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-028: Combobox primitive in shared/ui (bits-ui port)

## Executive Summary

### Vision

Add a Combobox primitive to `template/src/shared/ui/` — a search-input-
augmented dropdown built on top of `bits-ui` (already in
`template/package.json#dependencies` since PRD-018). It mirrors the
shape of the existing `Select` primitive but adds keyboard-driven
search, making it the right fit for any list whose count grows past
~10 items.

### Problem

The HealthBar instance switcher (PRD-029) needs a dropdown with
keyboard search — users will accumulate dozens of registered instances
over time, and `Select` becomes unusable past ~15 items (no filter,
arrow-key linear nav). Hand-rolling search inside the consumer widget
would violate rule 24 (`shared/ui` ownership). The right move is to
add Combobox as a first-class primitive, showcased on `/playground`,
reusable by any future consumer.

**Impact**: Without Combobox, PRD-029's switcher either ships a hand-
rolled search inside `widgets/health-bar/` (violation of rule 24) or
stays linear-scan (poor UX past 5-10 instances).

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| Widget composer (contributor) | Builds widgets in `entities/`, `widgets/`, `pages/` | No primitive for searchable dropdowns; would have to re-skin Select via :global() (forbidden) |
| HealthBar end-user | Sees the instance switcher | Linear scrolling through dozens of instances is slow; expects type-to-filter |

### Differentiators

- bits-ui-based: same accessibility chops as the rest of the catalogue.
- Variants `default` and `mono` mirror existing primitive patterns.
- Sizes `sm` and `md` mirror existing primitive patterns.
- /playground showcase across all variant × size × theme combos —
  catalogue stays the source of truth (rule 24 invariant).

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Combobox available from shared/ui barrel | `import { Combobox } from '@/shared/ui'` resolves | not implemented | resolves with full type signatures | Same PR | `npm run check` |
| SC-2 | All variant × size combos showcased on /playground | Tile count for Combobox section | 0 | 4 (2 variants × 2 sizes) × 3 themes (light/dark/orch) | Same PR | Manual verification + screenshots |
| SC-3 | Bundle delta | dist-experimental size delta | 0 | < 5KB gzipped | Same PR | `scripts/build.mjs` size diff |
| SC-4 | Type-check 0 errors | `npm run check` exit code | 0 | 0 (no regressions) | Same PR | CI |
| SC-5 | Rule 24 verification clean | grep snippet from rule 24 | 0 hits | 0 hits | Same PR | rule-24 verification snippet |
| SC-6 | First-paint of /playground unchanged | Time-to-LCP delta | baseline | < +50ms | Same PR | Lighthouse run |
| SC-7 | Keyboard accessibility | All a11y semantics work (arrow up/down, Enter, Escape, Home/End, type-to-filter) | n/a | passes axe smoke + manual | Same PR | axe + manual |

---

## Product Scope

### MVP (In-Scope)

- New primitive `template/src/shared/ui/combobox/` with the same shape
  as existing primitives (`Combobox.svelte`, sub-components, barrel
  `index.ts`).
- Sub-components: `ComboboxTrigger`, `ComboboxContent`, `ComboboxItem`,
  `ComboboxInput` (search input rendered inside Content).
- Variants: `default`, `mono` (matches Toggle/Button/Badge convention).
- Sizes: `sm`, `md` (matches existing).
- Two-way binding via `$bindable()` for selected value.
- Re-export from `template/src/shared/ui/index.ts`.
- /playground page section showcasing all variant × size combos in
  light + dark + orch themes.
- `class?: string` forwarded to root for layout-only consumer styling
  (rule 24 invariant).
- Accessibility per bits-ui: arrow-key nav, Enter to select, Escape to
  close, type-to-filter, ARIA pattern (`combobox` / `listbox`).

### Out of Scope

- Multi-select Combobox (only single-select MVP).
- Async/server-side option loading — items are passed in directly.
- Virtualized list rendering — punt until >100 options pattern emerges.
- Custom rendering of options beyond label + optional icon.
- Adopting Combobox into existing widgets that currently use Select —
  unless the widget owner opts in.

### Growth Vision

- Multi-select variant.
- Async option provider hook.
- Virtualization for very long lists.

---

## User Journeys

### Journey 1: Contributor adds Combobox to a new widget

**Цель**: Use Combobox in a new widget without violating rule 24.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | Imports `import { Combobox } from '@/shared/ui'` | Type-checked, available | No re-skin needed |
| 2 | Renders `<Combobox value={...} options={...} variant="mono" size="sm" />` | Renders with project tokens | Variants / sizes from catalogue |
| 3 | Reviews on /playground first | Sees the same variant × size live | Catalogue invariant |

**Результат**: Widget consumes primitive cleanly.

### Journey 2: End-user uses keyboard search

**Цель**: Find an item among many by typing.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | Clicks the trigger | Content opens; input focused | Keyboard-first |
| 2 | Types a few chars | List filters live | bits-ui handles |
| 3 | Arrow-down + Enter | Selection commits | Same as Select |

**Результат**: Fast selection in long lists.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | Contributor can `import { Combobox } from '@/shared/ui'` | Journey 1 |
| FR-002 | Core | Must | Combobox renders a trigger button + popover containing a search input + filtered option list | Journey 2 |
| FR-003 | Core | Must | Combobox supports keyboard navigation (arrow up/down, Home/End, Enter, Escape, type-to-filter) per bits-ui defaults | Journey 2 |
| FR-004 | Core | Must | Combobox supports `variant` prop with values `default` and `mono` | Journey 1 |
| FR-005 | Core | Must | Combobox supports `size` prop with values `sm` and `md` | Journey 1 |
| FR-006 | Core | Must | Combobox accepts `value` (bindable) and `options` (array of `{ value, label, icon? }`) | Journey 1, 2 |
| FR-007 | Core | Must | Combobox forwards `class?: string` to the root for consumer layout-only styling (rule 24 invariant) | Journey 1 |
| FR-008 | Core | Must | Combobox is showcased on /playground in all 2 × 2 × 3 (variant × size × theme) combinations | Journey 1 |
| FR-009 | Core | Must | Combobox uses bits-ui's Combobox primitive under the hood (no hand-rolled accessibility) | Journey 2 |
| FR-010 | Core | Must | Combobox styles read CSS variables from `template/src/app/styles/app.css` (`--bg`, `--bg-1`, `--bg-2`, `--fg`, `--fg-1`, `--accent`, `--line`, etc.) — no Tailwind, no inline color/border styles | Journey 1 |
| FR-011 | UX | Should | Combobox preserves dual-theme (light / dark via `data-theme`) without consumer intervention | Journey 1 |
| FR-012 | UX | Should | Combobox emits `onValueChange` callback in the same shape as ToggleGroup / Select | Journey 1 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Bundle | dist-experimental size delta from adding Combobox | < 5KB gzipped | `npm run build` | size diff |
| NFR-002 | Performance | /playground first-paint regression | < +50ms | Lighthouse on the section | LCP delta |
| NFR-003 | A11y | Axe score on /playground Combobox section | 0 violations | both themes | Manual axe run |
| NFR-004 | Type safety | `npm run check` exit code | 0 | full check after adding primitive | CI |
| NFR-005 | Rule 24 | Upper-layer `:global()` overrides on Combobox internal classes | 0 hits | rule-24 grep snippet | grep |

---

## Acceptance Criteria

### AC-1: Combobox primitive available from barrel

```gherkin
Given the new primitive lives at template/src/shared/ui/combobox/
When a developer types `import { Combobox } from '@/shared/ui'` in a widget
Then svelte-check resolves the import with full type signatures
And rendering <Combobox> with valid props produces no runtime errors
```

### AC-2: /playground showcase complete

```gherkin
Given /playground is loaded
When the user scrolls to the Combobox section
Then there are 4 tiles (2 variants × 2 sizes)
And each tile is rendered under light, dark, and orch themes
And each rendering passes axe smoke (0 violations)
```

### AC-3: Rule 24 verification clean

```gherkin
Given Combobox is in shared/ui and consumed by widgets
When the rule-24 verification snippet runs
Then no upper-layer Svelte file targets Combobox internal class names via :global()
And no widget patches Combobox chrome from above
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| bits-ui (`@melt-ui/bits-ui`-equiv) | Runtime (already a dep) | Present | template/package.json |
| PRD-018 (shadcn primitives in shared/ui) | Internal | Active | n/a (foundational) |
| PRD-029 (HealthBar switcher) | Consumer | Drafted | docs-eng-109 |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | bits-ui's Combobox API changes between minor versions | Low | Low | Pin minor in `template/package.json`; rely on existing PRD-018 update flow | dev |
| R-2 | Bundle bloat exceeds 5KB cap | Low | Medium | Measure post-build; bits-ui Combobox is tree-shaken-friendly | dev |
| R-3 | Combobox CSS overrides break orch theme | Medium | Low | /playground showcase asserts all 3 themes; visual review pre-merge | dev |
| R-4 | Existing Select consumers want to swap to Combobox immediately | Low | Low | Out of scope; document upgrade path; consumers opt in | dev |

---

## Affected Files

- `template/src/shared/ui/combobox/Combobox.svelte` (NEW)
- `template/src/shared/ui/combobox/ComboboxTrigger.svelte` (NEW)
- `template/src/shared/ui/combobox/ComboboxContent.svelte` (NEW)
- `template/src/shared/ui/combobox/ComboboxItem.svelte` (NEW)
- `template/src/shared/ui/combobox/ComboboxInput.svelte` (NEW)
- `template/src/shared/ui/combobox/index.ts` (NEW)
- `template/src/shared/ui/index.ts` — re-export Combobox
- `template/src/routes/playground/+page.svelte` — showcase section
- `template/src/shared/ui/README.md` — document new primitive
- GitHub sub-issue: #114 (109e)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-018 | Foundation (bits-ui primitives in shared/ui) | Active |
| RFC-024 | Architecture | Draft |
| PRD-029 | Consumer (HealthBar switcher) | Draft |
| RFC-016 | Reference (bits-ui-based primitives convention) | Active |
| GitHub #114 | Source sub-issue | Open |

---

> **Next step**: Land alongside RFC-024. Independent of PRD-024..027 chain — can ship in parallel.


