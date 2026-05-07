---
depth: standard
id: PRD-019
kind: prd
status: draft
title: 'Post-PRD-018 SC-2 audit follow-ups: a11y, rule-24 variants, type safety'
---

---
id: PRD-019
title: "Post-PRD-018 SC-2 audit follow-ups: a11y, rule-24 variants, type safety"
status: Draft
created: 2026-05-07
updated: 2026-05-07
priority: P1
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-019: Post-PRD-018 SC-2 audit follow-ups: a11y, rule-24 variants, type safety

## Progress

```
Phase 0  ░░░░░░░░░░░░░░░░░░░░░░░░  0/0  (  0%)
─────────────────────────────────────────────────
TOTAL                               0/0  (  0%)
```

---

## Executive Summary

### Vision

Resolve the 13 follow-up findings from the PRD-018 SC-2 multi-expert audit (GitHub issue #99) so the `shared/ui` migration is no longer carrying silent a11y regressions, rule-24 violations, or type-safety leaks.

### Problem

PR #85 landed the shared/ui migration across 7 widgets/pages. The audit found:
- **2 critical a11y regressions** — HealthBar theme switcher lost `radiogroup` semantics, Timeline collapse uses `aria-pressed` instead of `aria-expanded`.
- **~13 rule-24 `:global()` violations** re-skinning primitive internals from upper layers.
- **4 type casts** hiding source-of-truth gaps.
- **2 latent reactivity bugs** (notify race during async permission prompt; auto-collapse `$effect` re-firing on graph poll).
- **Rule-24 verification grep does not run** on this repo (`rg --type svelte` unrecognized).

**Impact**: Screen-reader users get wrong announcements; primitive catalogue (`/playground`) lies — half the visuals are produced by overrides scattered across widgets.

### Target Users

| Persona | Description | Pain |
|---------|-------------|------|
| Screen-reader user | Uses VoiceOver / NVDA on the Forgeplan map | Theme/Timeline announce wrong roles |
| Frontend contributor | Adds new widgets/pages | Catalogue lies — copies inline override instead of proper variant |
| Reviewer | Gates PRs against rule-24 | Verification grep silently passes everything |

### Differentiators

- Adds missing primitive variants (mono Button/Badge/Toggle/Alert) so future widgets compose them instead of hand-rolling overrides.
- Fixes the rule-24 verification so the grep actually catches new violations.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | All 13 child issues from #99 resolved | issues closed | 0/13 | 13/13 | this PR | `gh issue list --search "is:closed milestone:#99"` |
| SC-2 | Zero a11y regressions on theme switcher and Timeline | DevTools accessibility tree | 2 regressions | 0 regressions | this PR | Chrome DevTools `Accessibility` tab |
| SC-3 | Rule-24 verification grep returns FAIL when violation exists | exit code | always 0 | 1 on violation, 0 on clean | this PR | run snippet from rule-24 against scratch dir |
| SC-4 | `npm run check` clean | svelte-check errors | 0 | 0 | this PR | `npm run check` exit 0 |

---

## Product Scope

### MVP (In-Scope)

- a11y: HealthBar `radiogroup`, Timeline `aria-expanded` (issues #86, #87).
- rule-24: new variants on Button (ghost-mono, icon), Badge (mono), Toggle/ToggleGroupItem (outline-mono), Alert (banner) — issue #88; remove `:global()` overrides in consumer files; tag remaining as `TODO(rule-24-cleanup)` (issue #90); fix verification grep + violations list (issue #89).
- a11y refactor: InsightsRail → Tabs primitive (#91), ArtifactPanel disclosure → Collapsible primitive (#92).
- type safety: HealthBar (#93), HomePage (#94), Filters (#98).
- bug fixes: HealthBar notify race (#95), ArtifactPanel auto-collapse `$effect` (#96).
- code quality: FIXME / TODO markers + small cleanups (#97).

### Out of Scope

- Adding rule-24 verification to CI (separate ticket if scope grows).
- Touching primitives outside the variant additions listed.
- Visual redesign — variants must match the existing `:global()` override visuals.

### Growth Vision

- After this lands, the catalogue (`/playground`) is the single source of truth again. Future widgets can compose without `:global()` overrides.

---

## User Journeys

### Journey 1: Screen-reader user toggling theme

**Goal**: Switch between Auto / Light / Dark via keyboard.

| Step | User action | System response | Notes |
|------|------------|-----------------|-------|
| 1 | Tabs to theme switcher | Reader announces "radio group, Theme" | Currently announces "toggle button group" — bug |
| 2 | Arrows to Light | Reader announces "Light, radio button, 2 of 3, selected" | |
| 3 | Tabs out | Roving tabindex preserved | |

**Outcome**: User knows exactly one theme is selected and how to change it.

### Journey 2: Frontend contributor adding a new widget

**Goal**: Render a mono-uppercase ghost button.

| Step | User action | System response | Notes |
|------|------------|-----------------|-------|
| 1 | Reads `shared/ui/README.md` | Sees `Button variant="ghost-mono"` | Currently has to grep `:global(.panel-action)` patterns |
| 2 | Uses `<Button variant="ghost-mono">` | Renders correctly in light + dark | Showcased on `/playground` |
| 3 | Opens PR | rule-24 grep passes (no `:global()` reaching primitive class names) | |

**Outcome**: Composition over override; catalogue stays the source of truth.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | A11y | Must | Screen-reader user can identify theme switcher as radio group with 3 radio items | Journey 1 |
| FR-002 | A11y | Must | Screen-reader user can identify Timeline collapse as a disclosure (`aria-expanded`) | Journey 1 |
| FR-003 | A11y | Must | Screen-reader user can identify InsightsRail tabs as a tablist with tabs | Journey 1 |
| FR-004 | UX | Must | Frontend contributor can use `Button variant="ghost-mono"` from shared/ui | Journey 2 |
| FR-005 | UX | Must | Frontend contributor can use `Button size="icon"` from shared/ui | Journey 2 |
| FR-006 | UX | Must | Frontend contributor can use `Badge variant="mono"` from shared/ui | Journey 2 |
| FR-007 | UX | Must | Frontend contributor can use `ToggleGroupItem variant="outline-mono"` and `Toggle variant="outline-mono"` from shared/ui | Journey 2 |
| FR-008 | UX | Must | Frontend contributor can use `Alert variant="banner"` from shared/ui | Journey 2 |
| FR-009 | Type-safety | Must | Frontend contributor cannot pass a wrong-cased ArtifactKind to Filters (compile error) | Journey 2 |
| FR-010 | Bug | Must | User cannot trigger inconsistent notify state by rapid-toggling during permission prompt | Journey 1 |
| FR-011 | Bug | Must | User-expanded Outgoing/Incoming list survives 10s graph poll | Journey 2 |
| FR-012 | Tooling | Must | Reviewer can run rule-24 verification grep and get correct exit code | Journey 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Quality | System shall pass svelte-check | 0 errors, 0 warnings | All template/src/**/*.svelte after migration | `npm run check` exit 0 |
| NFR-002 | A11y | System shall match WAI-ARIA 1.2 patterns | radiogroup / disclosure / tablist | Theme switcher, Timeline, InsightsRail | DevTools accessibility tree |
| NFR-003 | Compatibility | System shall preserve existing visual output | pixel-equivalent at default resolution | After variant migration | Visual smoke vs. /playground |

---

## Acceptance Criteria

### AC-1: Theme switcher announces as radiogroup

```gherkin
Given HealthBar is rendered
When user inspects the Accessibility tab in Chrome DevTools
Then the wrapper has role="radiogroup" with aria-label="Theme"
And each item has role="radio" with explicit aria-checked
```

### AC-2: Timeline collapse uses aria-expanded

```gherkin
Given Timeline is rendered with the body expanded
When user inspects the collapse control
Then the control has aria-expanded="true" and aria-controls="timeline-body"
And screen readers announce "expanded" / "collapsed", not "pressed"
```

### AC-3: Rule-24 grep catches violations

```gherkin
Given a widget contains :global(.panel-action) targeting a primitive class
When the rule-24 verification snippet runs
Then it exits non-zero and prints "FAIL"
```

### AC-4: No new :global() overrides on primitive internals

```gherkin
Given Wave 3 has merged
When `rg -g '*.svelte' --type-add 'svelte:*.svelte' ':global\(' src/{entities,widgets,pages,routes} -A 1` runs
Then output contains zero matches against PRIMITIVE_CLASSES regex (or only TODO(rule-24-cleanup)-tagged ones)
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| PRD-018 SC-2 (shared/ui migration) | Internal — already activated | Ready | this repo |
| Rule 24 (`shared/ui` ownership) | Internal | Ready | this repo |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | New primitive variant looks slightly different from the override it replaces, causing visual regression | Medium | Medium | Visual smoke against /playground in light + dark before removing the override | implementer |
| R-2 | bits-ui's ToggleGroup type="single" doesn't expose internals to add radiogroup role | Low | Medium | Workaround: explicit `role="radiogroup"` on wrapper + `role="radio"` mapping; document on /playground | implementer |
| R-3 | Untrack-wrapped $effect masks a different reactivity bug | Low | Medium | Manual smoke: expand list, wait > 10s for poll, verify it stays open | implementer |

---

## Affected Files

- `template/src/shared/ui/{button,badge,toggle,toggle-group,alert}/**`
- `template/src/widgets/{health-bar,timeline,artifact-panel,artifact-filters,insights-rail,mosaic,version-footer}/ui/**`
- `template/src/pages/home/ui/HomePage.svelte`
- `template/src/routes/playground/+page.svelte`
- `template/src/shared/ui/index.ts` and `template/src/shared/ui/README.md`
- `.claude/rules/24-shared-ui-ownership.md`

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-018 | Parent — drove shared/ui migration | active |
| EVID-023 | Closed PRD-018 SC-2 | active |

---

> **Next step**: validate, then RFC the variant API surface.
