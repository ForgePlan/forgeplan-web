---
depth: standard
id: RFC-016
kind: rfc
last_modified_at: 2026-05-07T16:47:02.610858+00:00
last_modified_by: claude-code/2.1.132
links:
- target: PRD-018
  relation: based_on
status: draft
title: bits-ui-based primitives with CSS-var styling
---

---
id: RFC-016
title: "bits-ui-based primitives with CSS-var styling"
status: Draft
author: claude-code
created: 2026-05-07
updated: 2026-05-07
prd: PRD-018
depth: standard
---

# RFC-016: bits-ui-based primitives with CSS-var styling

## Progress

```
Phase 1  ░░░░░░░░░░░░░░░░░░░░░░░░  0/8  (  0%)
Phase 2  ░░░░░░░░░░░░░░░░░░░░░░░░  0/2  (  0%)
─────────────────────────────────────────────────
TOTAL                               0/10 (  0%)
```

---

## Summary

Build the shadcn-svelte primitive surface (26 components) inside
`template/src/shared/ui/` by wrapping `bits-ui` (already in `dependencies`)
with thin Svelte 5 components styled by CSS variables from
`template/src/app/styles/app.css`. Match the existing Button/Select shape
(one folder + barrel + top-level re-export).

## Motivation

PRD-018 documents the *what*. This RFC pins the *how*:

- We do **not** install Tailwind. The repo's design contract (PRD-015 / RFC-014)
  is dual-theme via `data-theme` + CSS variables. Primitives must read tokens,
  not class names.
- We do **not** install `shadcn-svelte` CLI artefacts directly. They ship
  Tailwind-class strings; mixing them in would split the styling story.
- Existing `Button` (`shared/ui/button/Button.svelte`) and `Select`
  (`shared/ui/select/Select.svelte`) already demonstrate the pattern: thin
  Svelte 5 component, `Props` typed, raw CSS in `<style>` reading
  `var(--…)`, optional `bits-ui` for accessibility-heavy primitives.

If we don't standardise this now, every new widget keeps growing ad-hoc CSS
and the design system never coalesces. See PRD-018 § Problem.

## Goals

- One folder per primitive under `template/src/shared/ui/`.
- Public surface = named exports from `template/src/shared/ui/index.ts`.
- `bits-ui` for behaviour (focus management, keyboard nav, ARIA wiring) where
  it offers a primitive — not for visual atoms (Badge, Separator, …).
- Styling exclusively via CSS variables from `app.css`. No Tailwind, no
  inline class strings.
- Variant and size props use the **same vocabulary** across primitives:
  - `variant`: `primary` / `secondary` / `ghost` / `danger` (subset per primitive).
  - `size`: `sm` / `md` (extend later if needed).
- Follow `.claude/rules/10-comments-policy.md` — `TODO(reason): …` for
  every cut corner.

## Non-Goals

- Visual regression test infra (Playwright + screenshot diffing) — separate effort.
- Replacing every ad-hoc style in the codebase — only the obvious wins per PRD-018 § Out of Scope.
- A standalone `@forgeplan/web-ui` npm package — primitives stay internal to `template/`.
- Reworking PRD-015 theme tokens — primitives consume what's already there.

## Options Considered

### Option A: Thin bits-ui wrappers + CSS vars (proposed)

**Description**: each primitive imports the matching `bits-ui` part(s) and
adds CSS via `<style>` reading from `app.css`. Visual atoms with no
behaviour requirement (Badge, Separator, Skeleton, Spinner, Card,
Progress, Alert, Label) are pure Svelte components — no bits-ui import.

**Pros**:
- Zero new runtime deps (bits-ui is already there).
- Same pattern as Button/Select — one mental model.
- CSS-var styling keeps PRD-015 dual-theme behaviour for free.
- Tree-shakeable per primitive.

**Cons**:
- Slightly more code to write than dropping shadcn-svelte CLI output.
- We re-implement variant CSS each primitive (mitigated by shared tokens).

### Option B: shadcn-svelte CLI add + retro-fit Tailwind

**Description**: install Tailwind, run `npx shadcn-svelte@latest add …`, port
existing tokens to a Tailwind preset.

**Pros**:
- Out-of-the-box parity with shadcn-svelte ecosystem.

**Cons**:
- Adds Tailwind + PostCSS to the build (build-time cost, dev dep churn).
- PRD-015 / RFC-014 dual-theme contract works via CSS vars; mapping to
  Tailwind preset is non-trivial and breaks the "tokens are the source of truth"
  rule.
- Mixed styling story: existing Button/Select stay raw CSS, new primitives
  use Tailwind — design drift not removed, just relocated.

### Option C: third-party UI lib (skeleton-svelte, melt-ui pre-built, …)

**Description**: depend on a fully styled component library.

**Pros**:
- Least code.

**Cons**:
- Brings its own opinionated theming layer that fights PRD-015.
- Bundle size (often 200+ KB).
- Lock-in: hard to bend for our specific affordances (graph-pane chrome,
  health-bar tints).

## Trade-off Analysis

| Критерий              | Option A (proposed)            | Option B (shadcn-svelte CLI)             | Option C (third-party lib)        |
|-----------------------|--------------------------------|------------------------------------------|-----------------------------------|
| Complexity            | Medium (write 26 thin wrappers) | High (Tailwind setup + token re-mapping) | Low                               |
| New runtime deps      | 0                              | 0                                        | 1+ (often heavy)                  |
| New dev deps          | 0                              | 2+ (tailwindcss, postcss, autoprefixer)  | 0–1                               |
| Dual-theme fit        | Native (CSS vars)              | Requires shim                            | Foreign theme system              |
| Bundle delta          | < +30 KB (NFR-002)             | + Tailwind preflight + utilities         | + 100–300 KB                      |
| Migration risk        | Low                            | Medium (CSS strategy split)              | High (lock-in)                    |
| Developer experience  | Same as Button/Select          | Different per primitive                  | Library-specific                  |
| Operational burden    | Low                            | Medium                                   | High (upgrades, breaking changes) |

## Proposed Direction

Option A — thin bits-ui wrappers + CSS-var styling. Matches the existing
shape (Button, Select), keeps theming honest, and adds zero deps.

### Per-primitive shape

```
template/src/shared/ui/<name>/
  <Name>.svelte          # the primitive
  index.ts               # `export { default as <Name> } from './<Name>.svelte';`
                         # plus type re-exports (e.g. SelectItem)
```

The top-level `template/src/shared/ui/index.ts` re-exports each primitive.
Order entries alphabetically to keep diffs scannable.

### Variant / size vocabulary

- `variant`: subset of `'primary' | 'secondary' | 'ghost' | 'danger' | 'success'` — each primitive picks the subset that makes sense (e.g. Badge: `primary | secondary | success | danger | ghost`; Button keeps `primary | secondary | ghost`).
- `size`: `'sm' | 'md'` minimum; some primitives may extend (`lg`, `xs`).
- `disabled`: `boolean` — every interactive primitive supports it; styles via `[aria-disabled="true"]` or native `:disabled` selectors.

### bits-ui touchpoints

| Primitive       | bits-ui import                    | Notes                                          |
|-----------------|-----------------------------------|------------------------------------------------|
| Tooltip         | `Tooltip.{Provider,Root,Trigger,Content,Arrow}` | Wrap whole `<App />` with Provider in `+layout.svelte` |
| Popover         | `Popover.{Root,Trigger,Content,Arrow,Portal}`   | Same portal pattern as Select                  |
| Tabs            | `Tabs.{Root,List,Trigger,Content}`              | Forwards `value` two-way                       |
| Accordion       | `Accordion.{Root,Item,Trigger,Content}`         | Single + multiple modes                        |
| Collapsible     | `Collapsible.{Root,Trigger,Content}`            | Animated via CSS `data-state`                  |
| Switch          | `Switch.{Root,Thumb}`                           |                                                |
| Checkbox        | `Checkbox.{Root,Indicator}`                     | Uses `@lucide/svelte` Check                    |
| RadioGroup      | `RadioGroup.{Root,Item}`                        | `Radio` is `RadioGroup.Item` thin alias        |
| Slider          | `Slider.{Root,Range,Thumb}`                     |                                                |
| Toggle          | `Toggle.Root`                                   | Single button-like                             |
| ToggleGroup     | `ToggleGroup.{Root,Item}`                       |                                                |
| Command         | `Command.{Root,Input,List,Empty,Group,Item,Separator}` | Item primitive consumed by Command list |
| Item            | `Command.Item` re-export with our chrome        |                                                |

Pure-CSS primitives (no bits-ui): Badge, Separator, Skeleton, Spinner,
Card, Progress, Alert, Label, Input, Field, InputGroup, ButtonGroup, Toaster.

For Toaster: implement an in-house `toaster.svelte.ts` store (Svelte 5 runes)
+ `Toaster.svelte` mount component + `toast()` helper. Live behind
`shared/services/toaster` if cross-app coordination is needed; primitive
view in `shared/ui/toaster/`. Defer to a follow-up if scope creep — see
PRD-018 § Out of Scope risk R-4.

### Layout / file ownership

Each group implements its own folders. Sub-issues are non-overlapping per
file. Barrel update is serialised: every group commits its own update to
`template/src/shared/ui/index.ts` at the end of its work; conflicts are
resolved on the spot.

### Tests

- `npm run check` after every group (svelte-check).
- Visual smoke in Chrome at the end of group 8 (PRD-018 AC-2).
- No unit tests at primitive level — bits-ui tests its own behaviour.

## Risks & Open Questions

- **Toaster**: in-house impl quality. Mitigation: time-box one day, fall
  back to deferring per R-4.
- **Tooltip provider placement**: must wrap entire layout once. If multiple
  providers are mounted, behaviour is undefined. Owner doc in README.
- **Bundle delta**: NFR-002 budget is +30 KB gz. Verified at end of group 8.
- **Open question**: do we expose `class:` overrides? Initial answer: no — prop-driven only. Revisit if a widget hits a real wall.

## Implementation Phases

### Phase 1: Primitive build-out (one task per group; serial commits)

- [ ] **1.1** Group 1 — Visual atoms (Badge, Separator, Skeleton, Spinner, Card, Alert, Progress)
- [ ] **1.2** Group 2 — Form basics (Label, Input, Field, InputGroup)
- [ ] **1.3** Group 3 — Toggles (Toggle, ToggleGroup, ButtonGroup, Switch, Checkbox, Slider)
- [ ] **1.4** Group 4 — Radio (Radio, RadioGroup)
- [ ] **1.5** Group 5 — Disclosure (Tabs, Collapsible, Accordion)
- [ ] **1.6** Group 6 — Overlays (Tooltip, Popover, Toaster)
- [ ] **1.7** Group 7 — Command (Command, Item)
- [ ] **1.8** Update `shared/ui/README.md` with the new catalogue

### Phase 2: Integration

- [ ] **2.1** Promote primitives into `widgets/version-footer`, `widgets/mosaic`, `widgets/update-dialog`
- [ ] **2.2** Visual smoke in Chrome — open dev server, walk routes, toggle theme; capture screenshots; record EvidencePack

## Affected Files

- `template/src/shared/ui/**`
- `template/src/shared/ui/index.ts`
- `template/src/shared/ui/README.md`
- `template/src/widgets/version-footer/**`
- `template/src/widgets/mosaic/**`
- `template/src/routes/+layout.svelte` (Tooltip provider mount)
- possibly `template/src/app/styles/app.css` (new component-scoped vars)

## Related Artifacts

| Artifact | Type | Relation     |
|----------|------|--------------|
| PRD-018  | PRD  | based_on     |
| PRD-015  | PRD  | informs (theme tokens) |
| RFC-014  | RFC  | informs (theme tokens) |

---

> **Next step**: validate this RFC, link to PRD-018, then begin Phase 1.1 (Visual atoms).


