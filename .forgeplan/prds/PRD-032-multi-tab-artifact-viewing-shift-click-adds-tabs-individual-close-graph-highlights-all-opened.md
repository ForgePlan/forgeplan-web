---
depth: standard
id: PRD-032
kind: prd
status: active
title: Multi-tab artifact viewing — Shift+click adds tabs, individual close, graph highlights all opened
---

---
id: PRD-032
title: "Multi-tab artifact viewing — Shift+click adds tabs, individual close, graph highlights all opened"
status: Draft
author: fedorovvvv
created: 2026-05-09
updated: 2026-05-09
priority: P2
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-032: Multi-tab artifact viewing

> Issue: <https://github.com/ForgePlan/forgeplan-web/issues/116>

## Executive Summary

### Vision

Researcher reading a Forgeplan workspace can keep several artifacts open
side-by-side as a tab strip in the right panel — `Shift+click` on any
artifact-opening control adds a new tab, plain click replaces the active
tab, and every opened artifact is visually highlighted in the dependency
graph until its tab is closed.

### Problem

Today the right panel renders a **single** artifact at a time
(`selectedId: string | null` on `HomePage`). Comparing two artifacts —
e.g. a PRD and its RFC, or two evidence packs against the same PRD —
forces the user to context-switch back and forth, losing the panel
scroll position, the impact root, and the in-panel graph highlight on
each switch. A standard tab strip pattern (Shift = "open in new tab",
plain click = "open here") removes that friction.

**Impact**: review/audit flows touch 3–5 artifacts per pass; without
tabs each pass costs `(N-1)` reloads of `/api/get/<id>` and a re-mount
of the markdown renderer. With tabs that drops to `0`.

### Target Users

| Persona     | Description                                         | Key pain                                                                    |
|-------------|-----------------------------------------------------|-----------------------------------------------------------------------------|
| Reviewer    | Runs `/fpl-skills:audit` then walks the graph by eye| Comparing PRD against linked evidence requires repeated round-trips         |
| Maintainer  | Triaging blind spots / stale artifacts              | Wants to keep the offending PRD open while drilling into linked RFC + ADR   |

### Differentiators

- Modifier-driven, not menu-driven — matches browser tab UX (`Shift`/`Ctrl`+click).
- Centralised `useOpen(event, id)` helper so every entry point (graph,
  rail, in-panel link, NodeRef chip) gets identical Shift handling.

---

## Success Criteria

| ID   | Criterion                                            | Metric        | Current | Target | How to Measure                            |
|------|------------------------------------------------------|---------------|---------|--------|-------------------------------------------|
| SC-1 | `Shift+click` on any artifact-opening surface opens a new tab without closing the active one | tabs after action | 1       | 2      | Browser smoke (issue #116 acceptance walk)|
| SC-2 | Plain click on an artifact replaces the active tab   | tabs after action | 1       | 1      | Browser smoke                             |
| SC-3 | Closing the last tab hides the panel + clears store  | panel visible | true    | false  | Browser smoke                             |
| SC-4 | Every opened artifact is highlighted in the graph    | `.selected` count | 1       | N      | DOM inspection in the smoke walk          |
| SC-5 | Reload (= window close) clears the tab store         | tabs after F5 | N       | 0      | Browser smoke (no `localStorage` write)   |

---

## Product Scope

### MVP (In-Scope)

- New rune-store module owning `tabs: string[]` + `activeId: string | null`.
- `useOpen(event: MouseEvent | KeyboardEvent | undefined, id: string)`
  helper that branches on `event?.shiftKey`.
- Replacement of `selectedId` in `HomePage` with the store's
  `activeId`; render a `TabBar` above `ArtifactPanel`.
- Update of every open-call site so the underlying event reaches
  `useOpen`: `ForceView` graph node click, `InsightsRail` rows,
  `ArtifactPanel.onNavigate` for in-body links, `NodeRef` chip click.
- Extension of `ForceView` `.selected` styling so it matches a
  `Set<string>` of opened ids (not a single id).
- Per-tab close button in the tab strip; close-active falls back to
  the first remaining tab (issue spec §2).
- No persistence — closing the window / reloading the page clears the
  store (issue spec §3).

### Out of Scope

- Drag-to-reorder tabs.
- Cross-window / cross-session persistence (deliberate per issue §3).
- Pin / unpin, "reopen closed tab", browser-history integration.
- Keyboard-driven tab switching (Ctrl+Tab) — follow-up.
- Multi-select in graph (lasso) — follow-up.

### Growth Vision

- A `Ctrl/Cmd+click` shortcut that opens-without-activating.
- A `Cmd+W` shortcut for closing the active tab.
- Per-tab independent scroll state inside `ArtifactPanel`.

---

## User Journeys

### Journey 1: Reviewer compares PRD with its evidence pack

| Step | User action                                     | System response                                        |
|------|--------------------------------------------------|--------------------------------------------------------|
| 1    | Click PRD-032 in graph                           | Tab strip shows `[PRD-032]`, panel renders PRD-032     |
| 2    | `Shift+click` EVID-035 in the same graph         | Tab strip shows `[PRD-032 | EVID-035*]`, panel switches to EVID-035, both nodes highlighted |
| 3    | Click `[PRD-032]` in the tab strip               | Panel switches back to PRD-032 without re-fetching     |
| 4    | Click the close (`×`) on `[EVID-035]`            | Tab dropped, panel stays on PRD-032, only PRD-032 highlighted |

### Journey 2: Maintainer dives a stale artifact chain

| Step | User action                                     | System response                                        |
|------|--------------------------------------------------|--------------------------------------------------------|
| 1    | Click "Stale" tab in `InsightsRail`, click row 1 | Panel shows the stale PRD                              |
| 2    | `Shift+click` the linked RFC chip in the panel   | Tab strip grows, panel jumps to RFC, both highlighted  |
| 3    | `Shift+click` the linked ADR chip in the panel   | Tab strip grows again, panel jumps to ADR              |
| 4    | Reload the page                                  | Tab strip is empty, panel hidden — no resurrected tabs |

---

## Functional Requirements

| ID     | Category    | Priority | Requirement                                                                                                | Journey   |
|--------|-------------|----------|------------------------------------------------------------------------------------------------------------|-----------|
| FR-001 | Core        | Must     | User can `Shift+click` an artifact-opening control to add the artifact as a new tab and make it active     | Journey 1 |
| FR-002 | Core        | Must     | User can plain-click an artifact-opening control to replace the active tab with that artifact              | Journey 1 |
| FR-003 | Core        | Must     | User can close any individual tab; closing the active tab activates the first remaining tab; closing the last tab hides the panel | Journey 1 |
| FR-004 | UX          | Must     | Every artifact present in the tab strip is visually highlighted in the dependency graph                    | Journey 1 |
| FR-005 | Core        | Must     | When the window is closed/reloaded, the tab store is cleared (no resurrection)                              | Journey 2 |
| FR-006 | UX          | Should   | All open-call sites (graph node click, rail rows, in-panel links, NodeRef chips) honour `Shift` identically | Journey 2 |
| FR-007 | UX          | Should   | Active tab is visually distinct from inactive tabs (border / weight)                                        | Journey 1 |

---

## Non-Functional Requirements

| ID      | Category        | Requirement                                                | Metric             | Condition                          | Measurement                |
|---------|-----------------|------------------------------------------------------------|--------------------|------------------------------------|----------------------------|
| NFR-001 | Performance     | Switching the active tab shall be instant (no fetch)       | < 16ms             | Tab already in store               | Browser devtools timeline  |
| NFR-002 | Maintainability | Shift-modifier logic shall live in exactly one helper       | 1 implementation   | All open call-sites                | grep `event.shiftKey` count |
| NFR-003 | Architecture    | Tab store shall not import from `widgets/` or `pages/`     | layer respect      | per FSD layer rule                 | manual review              |
| NFR-004 | A11y            | Tabs shall be keyboard-focusable; close button has aria-label| 100% coverage      | Tab strip                          | manual screen-reader pass  |

---

## Acceptance Criteria

### AC-1: Shift+click adds a tab

```gherkin
Given the artifact panel shows PRD-001 (one tab)
When  the user Shift+clicks node "RFC-001" in the graph
Then  the tab strip shows [PRD-001 | RFC-001*]
And   the panel renders RFC-001
And   both PRD-001 and RFC-001 are .selected in the graph
```

### AC-2: Plain click replaces

```gherkin
Given the tab strip shows [PRD-001* | RFC-001]
When  the user plain-clicks node "ADR-001" in the graph
Then  the tab strip shows [ADR-001* | RFC-001]
And   PRD-001 is no longer in the strip
```

### AC-3: Close active falls back to first remaining

```gherkin
Given the tab strip shows [PRD-001 | RFC-001* | ADR-001]
When  the user clicks the (×) on RFC-001
Then  the tab strip shows [PRD-001* | ADR-001]
And   the panel renders PRD-001
```

### AC-4: Close last hides panel

```gherkin
Given the tab strip shows [PRD-001*]
When  the user clicks (×) on PRD-001
Then  the panel is hidden
And   no node is .selected in the graph
```

### AC-5: Reload clears store

```gherkin
Given the tab strip shows [PRD-001 | RFC-001*]
When  the user reloads the page
Then  the tab strip is empty
And   the panel is hidden
```

---

## Risks & Mitigations

| ID  | Risk                                                                 | Probability | Impact | Mitigation                                                                       |
|-----|----------------------------------------------------------------------|-------------|--------|----------------------------------------------------------------------------------|
| R-1 | Shift+click on graph nodes conflicts with existing pan/select gesture | Low         | Medium | `e.stopPropagation()` already on node click; verify no accidental drag-start     |
| R-2 | `.selected` CSS extended to a Set breaks edge dimming logic          | Medium      | Low    | Audit `nodeClass` / `edgeClass` callers; add Set-aware variant, keep old narrow callers happy |
| R-3 | Notification-bus auto-focus replaces tabs unexpectedly                | Low         | Low    | `notifyBus.pendingFocus` continues to call the plain-open path → replaces active tab, expected |

---

## Affected Files

- `template/src/entities/artifact-tabs/` (new) — store + hook.
- `template/src/widgets/artifact-tabs/` (new) — TabBar UI.
- `template/src/pages/home/ui/HomePage.svelte` — replace `selectedId` with store.
- `template/src/widgets/dependency-graph/ui/ForceView.svelte` — pass `MouseEvent`, accept Set.
- `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` — relay event up.
- `template/src/widgets/insights-rail/ui/InsightsRail.svelte` — pass `MouseEvent` to `selectId`.
- `template/src/widgets/artifact-panel/ui/ArtifactPanel.svelte` — pass `MouseEvent` from in-body links + NodeRef.

## Related Artifacts

| Artifact   | Relation        | Status |
|------------|-----------------|--------|
| Issue #116 | Source request  | open   |


