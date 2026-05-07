---
depth: standard
id: PRD-018
kind: prd
last_modified_at: 2026-05-07T16:47:00.658537+00:00
last_modified_by: claude-code/2.1.132
status: draft
title: shadcn-svelte primitives in shared/ui
---

---
id: PRD-018
title: "shadcn-svelte primitives in shared/ui"
status: Draft
author: claude-code
created: 2026-05-07
updated: 2026-05-07
priority: P1
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-018: shadcn-svelte primitives in shared/ui

## Progress

```
Phase 0  ░░░░░░░░░░░░░░░░░░░░░░░░  0/0  (  0%)
─────────────────────────────────────────────────
TOTAL                               0/0  (  0%)
```

---

## Executive Summary

### Vision

Promote `template/src/shared/ui` from 5 ad-hoc primitives (Button, Code, Dialog,
Modal, Select) to the full shadcn-svelte primitive set (26 components) so every
widget/page in the SvelteKit app composes from a single, consistent primitive
library. Refs: GitHub issue ForgePlan/forgeplan-web#68.

### Problem

The `template/` SvelteKit app currently grows ad-hoc styled markup inside each
widget (mosaic panes, version footer, update dialog, panels, etc.). Recurring
visual atoms — badges, inputs, tabs, switches, tooltips — are reimplemented per
caller, drifting apart in spacing, colors, hover states, and ARIA wiring.
`shared/ui/` advertises 12 folders (`badge/alert/separator/skeleton/spinner/`
`progress/card/` …) but 7 of them are empty placeholders. The next set of UI
features in this repo (mosaic toolbar, command palette, settings tabs) needs
these primitives to land first.

**Impact**: each new widget reinvents 50–200 LOC of CSS; design drift compounds
each release; accessibility (focus rings, keyboard nav, screen-reader labels)
varies by author. Three of the last five F-features had visual regressions
reported in audits (F14, F15, F18).

### Target Users

| Персона          | Описание                                    | Ключевая боль                                              |
|------------------|---------------------------------------------|------------------------------------------------------------|
| Component author | Engineer adding a new widget under `pages/` | Has to choose between ad-hoc CSS or copying another widget |
| Design reviewer  | Reviews PRs against the design system       | No single source for what a primitive looks like           |
| End user         | Browser visitor of `.forgeplan-web/`        | Inconsistent affordances across panes (e.g. tabs vs select) |

### Differentiators

- Built on `bits-ui` (already in `dependencies`) — no new runtime deps for 24/26 primitives.
- Styled with the project's CSS variables from `app/styles/app.css`, **not Tailwind** — keeps the dual-theme contract from PRD-015 / RFC-014.
- Same shape as existing `Button` / `Select` primitives: one folder per component, barrel `index.ts`, public surface in `shared/ui/index.ts`.

---

## Success Criteria

| ID   | Criterion                                            | Metric                                              | Current | Target  | Timeframe | How to Measure                                  |
|------|------------------------------------------------------|-----------------------------------------------------|---------|---------|-----------|-------------------------------------------------|
| SC-1 | All 26 primitives shipped from `shared/ui` barrel    | Named exports count in `shared/ui/index.ts`         | 5       | ≥26     | This PRD  | `grep -c "^export" template/src/shared/ui/index.ts` |
| SC-2 | No ad-hoc copies of these primitives in `widgets/*`  | Inline `<button class="...">` style blocks under `widgets/` | unbounded | ≤ baseline-2 per widget | This PRD | manual audit + grep `<style>` blocks |
| SC-3 | Visual smoke passes in Chrome                        | Manual run of dev server, navigation through routes | n/a     | 0 errors | This PRD | Chrome MCP smoke + console error log            |
| SC-4 | `npm run check` clean after integration              | svelte-check exit code                               | 0       | 0       | This PRD  | CI / local                                      |

---

## Product Scope

### MVP (In-Scope)

26 primitives split across 7 functional groups (one GitHub sub-issue per group):

1. **Visual atoms** — Badge, Separator, Skeleton, Spinner, Card, Alert, Progress.
2. **Form basics** — Label, Input, Field, InputGroup.
3. **Toggles** — Toggle, ToggleGroup, ButtonGroup, Switch, Checkbox, Slider.
4. **Radio** — Radio, RadioGroup.
5. **Disclosure** — Tabs, Collapsible, Accordion.
6. **Overlays** — Tooltip, Popover, Toaster.
7. **Command** — Command, Item.
8. **Integration** — promote into widgets/pages where ad-hoc styles exist; visual smoke in Chrome.

Each primitive ships:
- a single `<Name>.svelte` component under `shared/ui/<name>/`,
- a `index.ts` barrel re-exporting it (and any sub-types),
- a re-export from `shared/ui/index.ts`,
- `TODO(...)` markers for any cut corner per `.claude/rules/10-comments-policy.md`.

### Out of Scope

- A separate Storybook / docs site for primitives (later — current `playground/` route stays minimal).
- Migrating *all* widget CSS to the new primitives in this PRD — the integration step targets the obvious wins (PaneFrame, UpdateDialog, version-footer); the long tail is tracked as follow-up.
- Replacing `Button` / `Select` (already shipped) — they stay; new primitives slot in around them.
- Adding Tailwind / Tailwind variants config.
- Toaster as a third-party dep (`sonner-svelte` etc.) — implemented as a lightweight in-house primitive on top of bits-ui patterns; revisit if the in-house version proves insufficient.

### Growth Vision

- Theme-token driven design system with light/dark parity for every primitive (extends PRD-015).
- Primitive-level visual regression tests (Playwright + Chrome).
- Make `shared/ui` re-publishable as `@forgeplan/web-ui` if a second consumer materialises.

---

## User Journeys

### Journey 1: Component Author — adds a new widget

**Цель пользователя**: ship a new widget under `widgets/<slice>/ui/` reusing the design system.

| Шаг | Действие                                              | Ответ системы                                                              | Заметки                          |
|-----|-------------------------------------------------------|----------------------------------------------------------------------------|----------------------------------|
| 1   | imports primitives via `import { X } from '@/shared/ui'` | TypeScript resolves; primitive renders with default styles                | One-line import, barrel-driven   |
| 2   | applies variant / size / state props                  | Consistent affordances (hover, focus-visible, disabled) across all widgets | Same shape as existing Button   |
| 3   | composes a higher-order widget without writing CSS    | Widget passes design review with no spacing / color drift                  | Falls through to `app.css` vars  |

**Результат**: zero ad-hoc CSS for atoms; widget review surfaces only domain-specific feedback.

### Journey 2: Design Reviewer — reviews a PR

**Цель пользователя**: confirm a PR doesn't introduce visual drift.

| Шаг | Действие                                              | Ответ системы                                       | Заметки                  |
|-----|-------------------------------------------------------|-----------------------------------------------------|--------------------------|
| 1   | scans diff for `<style>` blocks under `widgets/*`     | only domain-specific styles remain (layout, motion) | Atoms come from primitives |
| 2   | checks consumed primitives match catalogue            | exports in `shared/ui/index.ts` are the single source | Catalogue is the contract |

**Результат**: review focuses on domain logic, not on re-litigating spacing/colour.

---

## Functional Requirements

| ID     | Category    | Priority | Requirement                                                                       | Journey   |
|--------|-------------|----------|-----------------------------------------------------------------------------------|-----------|
| FR-001 | Core        | Must     | Component author can import each of the 26 primitives via `@/shared/ui` barrel    | Journey 1 |
| FR-002 | Core        | Must     | Component author can pass `variant` / `size` / `disabled` props with consistent semantics across primitives | Journey 1 |
| FR-003 | Accessibility | Must   | Component author can rely on keyboard nav + ARIA labelling provided by the primitive without extra wiring | Journey 1 |
| FR-004 | Theming     | Must     | Component author can render any primitive against `data-theme="dark"` or `data-theme="light"` without per-call overrides | Journey 1 |
| FR-005 | Integration | Should   | Design reviewer can verify a PR uses primitives by reading the diff               | Journey 2 |
| FR-006 | Integration | Should   | Component author can replace existing ad-hoc CSS in `PaneFrame`, `UpdateDialog`, `version-footer` with primitive consumption | Journey 1 |
| FR-007 | DX          | Should   | Component author receives a single TypeScript type per primitive prop set         | Journey 1 |
| FR-008 | Catalogue   | Could    | Component author can browse a `playground/` route showing all primitives in one place | Journey 1 |

---

## Non-Functional Requirements

| ID      | Category      | Requirement                                           | Metric            | Condition                  | Measurement                              |
|---------|---------------|-------------------------------------------------------|-------------------|----------------------------|------------------------------------------|
| NFR-001 | Performance   | Adding 26 primitives shall not regress dev cold start | < +500 ms         | `npm run dev` start time   | Manual stopwatch + Vite log              |
| NFR-002 | Bundle        | Adding 26 primitives shall not regress prod bundle    | < +30 KB gz       | `vite build` client output | `du -k template/build/client/_app/*.js`  |
| NFR-003 | Type safety   | All primitives shall pass `svelte-check`              | 0 errors          | Repo-wide                  | `npm run check`                          |
| NFR-004 | Accessibility | Each primitive shall expose role + keyboard nav from bits-ui | A11y review pass | Per primitive              | Manual review against bits-ui docs        |
| NFR-005 | Theming       | Each primitive shall render correctly in both dark and light themes | Visual smoke pass | Browser test               | Chrome smoke at `data-theme` toggle      |

---

## Acceptance Criteria

### AC-1: Primitives are exported from the barrel

```gherkin
Given the component author writes `import { Badge, Tabs, Tooltip } from '@/shared/ui'`
When `npm run check` runs
Then svelte-check reports 0 errors
And each named import resolves to a `*.svelte` file under `template/src/shared/ui/`
```

### AC-2: Visual smoke in Chrome

```gherkin
Given the dev server runs at http://127.0.0.1:5174
When the reviewer navigates the home page and toggles theme
Then no console errors are emitted
And tabs / popovers / tooltips render without layout overflow at default viewport
```

### AC-3: No ad-hoc atoms remain in the integration scope

```gherkin
Given the integration sub-issue (group 8) is closed
When grep finds `<style>` blocks under `widgets/version-footer`, `widgets/mosaic`
Then the only remaining styles are layout-specific (grid, motion) — not atoms (button, badge, tabs)
```

---

## Dependencies

| Dependency  | Type      | Status | Owner       |
|-------------|-----------|--------|-------------|
| bits-ui     | Technical | Ready  | already in `dependencies` (^2.18.1) |
| @lucide/svelte | Technical | Ready | already in `dependencies` (^1.14.0) |
| PRD-015 / RFC-014 (theme tokens) | Internal | Active | merged |

---

## Risks & Mitigations

| ID  | Risk                                                                                | Probability | Impact | Mitigation                                                                                                  | Owner       |
|-----|-------------------------------------------------------------------------------------|-------------|--------|-------------------------------------------------------------------------------------------------------------|-------------|
| R-1 | Bundle size regression from 26 new components                                       | Medium      | Medium | Vite tree-shakes per-import; barrel re-exports default imports; measure with NFR-002 before activation     | claude-code |
| R-2 | API drift between primitives — variant naming, size scales                          | High        | Medium | Standardise on existing Button/Select prop shapes; document conventions in `shared/ui/README.md`            | claude-code |
| R-3 | bits-ui upgrade later breaks several primitives at once                             | Low         | High   | Pin to ^2.18.x in template; track upstream changelog; one ADR per major bump                                 | claude-code |
| R-4 | Toaster without a third-party impl is harder than expected                          | Medium      | Low    | Time-box; if in-house spike misses one day, defer Toaster to follow-up issue                                 | claude-code |
| R-5 | Replacing existing ad-hoc CSS in widgets surfaces visual regressions                | Medium      | Medium | Integration in group 8 only; Chrome smoke at the end; revert path is per-commit                              | claude-code |

---

## Timeline

| Milestone           | Target Date | Description                              |
|---------------------|-------------|------------------------------------------|
| PRD validated       | 2026-05-07  | This PRD passes `forgeplan validate`     |
| Visual atoms shipped | 2026-05-07 | Sub-issue group 1 merged                 |
| Form + toggles done | 2026-05-08  | Sub-issues 2 + 3 + 4 merged              |
| Disclosure + overlays + command shipped | 2026-05-08 | Sub-issues 5 + 6 + 7 merged   |
| Integration + Chrome smoke | 2026-05-08 | Sub-issue 8 merged + EvidencePack |
| PRD activated       | 2026-05-08  | After EvidencePack with R_eff > 0        |

---

## Affected Files

- `template/src/shared/ui/**` — new component folders, updated barrel
- `template/src/shared/ui/README.md` — primitive catalogue update
- `template/src/widgets/version-footer/**` — integration
- `template/src/widgets/mosaic/**` — integration
- `template/src/app/styles/app.css` — possibly new tokens (component-scoped vars)
- `template/package.json` — only if Toaster needs a dep (see R-4)

## Related Artifacts

| Artifact | Relation       | Status |
|----------|----------------|--------|
| RFC-016  | architecture proposal | draft |
| GitHub #68 | source request | open  |

---

> **Next step**: After approve → fill RFC-016 with the bits-ui-based architecture and per-primitive shape, then implement group-by-group.


