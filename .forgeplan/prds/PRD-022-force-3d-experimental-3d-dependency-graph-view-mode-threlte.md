---
depth: standard
id: PRD-022
kind: prd
last_modified_at: 2026-05-07T20:54:26.426014+00:00
last_modified_by: claude-code/2.1.132
status: active
title: Force 3D — experimental 3D dependency-graph view mode (Threlte)
---

---
id: PRD-022
title: "Force 3D — experimental 3D dependency-graph view mode (Threlte)"
status: Draft
author: claude-code
created: 2026-05-07
updated: 2026-05-07
priority: P2
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-022: Force 3D — experimental 3D dependency-graph view mode (Threlte)

## Progress

```
Phase 0  ████████████████████░░░░  4/5  ( 80%)
─────────────────────────────────────────────────
TOTAL                               4/5  ( 80%)
```

---

## Executive Summary

### Vision

A new opt-in **Force 3D** view mode that renders the same artifact dependency
graph in true 3D space, giving the explorer a navigable "constellation" of
PRDs / RFCs / ADRs / Specs / Evidence so that cluster topology is legible at
a glance even at 100+ artifacts.

### Problem

The current 2D `Force` view collapses dense workspaces into hairballs when
the artifact count crosses ~80 — clusters overlap, edges criss-cross, and
positional meaning is lost (PRD-018 / EVID-022 already shipped damping
mitigations, but the underlying 2D limitation remains). The explorer cannot
visually separate orthogonal sub-graphs without manually filtering by kind
or status.

**Impact**: at the reference workspace (the parent Forgeplan repo, ~69
artifacts) clusters touch each other; the screenshot bundled with this PRD
shows a representative dense graph where the central hairball obscures
detail. Adding more artifacts will only widen the gap between what the
viewer needs to see and what 2D physics can show.

### Target Users

| Persona | Описание | Ключевая боль |
|---------|----------|---------------|
| Forgeplan power user (daily) | Reviewer of large workspaces (50+ artifacts), uses Force view to find blind spots / orphans / clusters. | 2D hairballs hide topology; manual filtering takes time. |
| Curious onlooker (occasional) | Investor / new contributor exploring a project's artifact graph for orientation. | Wants something striking + understandable; flat 2D feels "engineering-only". |

### Differentiators

- 3D force-directed layout (3 axes × repulsion + link forces) — separable
  clusters become spatially distinct.
- Forgeplan-native styling: token-driven colors per artifact `kind`, status
  ring, `R_eff`-driven sphere size — same visual grammar as the 2D Force
  view, not a generic gallery demo.
- Experimental opt-in (last in the dropdown, badged `experimental`) — no
  regression risk for the default Force flow.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Force 3D renders same artifact set as Force | nodes(force_3d) === nodes(force) for the same `kindFilter` / `statusFilter` | n/a | 100 % match | Ship | Manual smoke against parent Forgeplan workspace (≥60 artifacts). |
| SC-2 | Initial frame budget on a 200-node graph | Time from mount to first stable frame | n/a | ≤ 1500 ms on M-class laptop, Chromium release | Ship | Browser DevTools Performance trace, p50 across 5 runs. |
| SC-3 | Steady-state frame rate while orbiting | rAF over 5 s of mouse-drag rotation | n/a | ≥ 45 fps on a 200-node graph | Ship | DevTools Performance "Frames" track. |
| SC-4 | Bundle size impact on default `dist/` shape | Difference in `dist/client/_app/immutable/` total gzip vs main | n/a | 0 bytes (lazy-loaded, code-split chunk) | Ship | `du -sb` on `dist/client/_app/immutable/` before/after on default mode. |
| SC-5 | Experimental badge visible | `experimental` badge rendered next to "Force 3D" in the view-mode dropdown | n/a | Visible in dropdown + accessible name | Ship | Manual + visual inspection against `/playground` toggle catalogue. |

---

## Product Scope

### MVP (In-Scope)

- New `force3d` entry registered in `GRAPH_VIEWS` (last position) and `GraphView` union.
- New widget `widgets/dependency-graph-3d/` exposing `Force3DView.svelte`
  (Threlte canvas + `d3-force-3d` simulation + node spheres + edge segments).
- `experimental` badge surfaced in the view-mode dropdown next to "Force 3D".
- Lazy-loaded chunk: Threlte / Three.js never enter the main bundle of
  non-3D users.
- `R_eff` → sphere radius mapping consistent with 2D `r_eff` font emphasis.
- `kind` → token color (matches 2D `kindBorder`/`kindLabelColor`).
- `status` → emissive ring / outline per `statusRing`.
- Pointer hover → highlight neighbours + dim others (parity with 2D Force
  semantics, no animation regressions).
- Camera: orbit + zoom (Three.js OrbitControls or equivalent Threlte abstraction).
- Reduced-motion preference honoured: simulation alpha decays faster.
- TODO marker in `ForceView.svelte` recording the future plan: a 2D ↔ 3D
  switch *inside* the Force mode itself (so users don't have to drop out
  to a separate dropdown entry).

### Out of Scope

- The in-Force-mode 2D ↔ 3D switch (recorded as TODO; separate PRD later).
- Mobile / touch optimisation (desktop-first; the badge says experimental).
- VR / WebXR mode.
- Custom shaders, post-processing, bloom / FXAA.
- Persistence of camera state across sessions (we reset on view switch in
  parity with 2D Force).
- Per-artifact 3D label rendering (sprite labels are deferred — hover
  tooltip only for MVP).

### Growth Vision

- Bring the visual upgrade into the **default** Force mode via a switch
  (the recorded TODO).
- Edge bundling in 3D for very dense graphs.
- Time-axis: extrude `created_at` along Z so topology + chronology are
  visible together.
- Persist camera + filter state in URL so a 3D constellation can be linked.

---

## User Journeys

### Journey 1: Daily reviewer wants to see cluster topology at a glance

**Цель пользователя**: Spot orthogonal sub-graphs without filtering.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Open the workspace | HomePage shows Force 2D by default | No regression |
| 2 | Open the pane view-mode dropdown | Sees seven existing modes + "Force 3D" last with experimental badge | Discoverable |
| 3 | Selects "Force 3D" | Threlte canvas mounts, 3D simulation runs to settle | First-frame ≤ 1500 ms (SC-2) |
| 4 | Drags to orbit | Camera rotates, fps stable (SC-3) | Reduced motion respected |
| 5 | Hovers a node | Neighbours highlighted, others dim, tooltip shows id + title | Same hover semantics as 2D Force |

**Результат**: cluster boundaries visible in 3D; user can identify isolated
sub-graphs without filter manipulation.

### Journey 2: Onlooker explores forgeplan-web for the first time

**Цель пользователя**: Get a striking, legible orientation view.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Lands on HomePage | Sees Force 2D (default) | Familiar |
| 2 | Opens the view dropdown | Sees the experimental Force 3D entry, last | Curiosity hook |
| 3 | Selects Force 3D | 3D scene builds, badge shows "experimental" — caveat is honest | Onlooker is informed |

**Результат**: the user walks away with a clear "this project has structure"
takeaway, with the right caveat.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | Reviewer can select "Force 3D" from the view-mode dropdown of any pane. | Journey 1, 2 |
| FR-002 | Core | Must | Reviewer can see all artifacts of the current `kindFilter` / `statusFilter` set as nodes in the 3D scene. | Journey 1 |
| FR-003 | Core | Must | Reviewer can see all dependency edges (informs / based_on / supersedes / refines / contradicts) as 3D segments. | Journey 1 |
| FR-004 | Core | Must | Reviewer can orbit and zoom the camera with the pointer. | Journey 1 |
| FR-005 | Core | Must | Reviewer can hover a node to see its id + title and have neighbours highlighted. | Journey 1 |
| FR-006 | Core | Should | Reviewer can read the `experimental` badge next to the "Force 3D" label in the dropdown. | Journey 2 |
| FR-007 | UX | Should | Reviewer can rely on the same color-by-kind / status-ring grammar already used in 2D Force. | Journey 1 |
| FR-008 | UX | Should | Reviewer can see node radius scaled by `R_eff` (parity with 2D emphasis). | Journey 1 |
| FR-009 | Performance | Must | The Force 3D chunk is lazy-loaded — non-3D users do not pay for it. | Journey 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | First stable frame after switching to Force 3D | ≤ 1500 ms p50 | 200-node graph, M-class laptop, Chromium release | DevTools Performance |
| NFR-002 | Performance | Steady-state fps while orbiting | ≥ 45 fps p50 | 200-node graph, drag-rotate 5 s | DevTools Frames track |
| NFR-003 | Bundle | Default `dist/` size | unchanged (Δ = 0 bytes for non-3D users) | Force 3D chunk loaded only on selection | `du -sb dist/client/_app/immutable/` baseline vs PR |
| NFR-004 | Robustness | Switching modes in either direction | 0 console errors | 50 cycles between Force 2D ↔ Force 3D | Manual + console assert |
| NFR-005 | A11y | Dropdown affordance | Keyboard reachable, label "Force 3D, experimental" | Tab + Enter | bits-ui Select baseline + axe DevTools |
| NFR-006 | Reduced motion | Simulation cooling | alpha decay 2× faster when `prefers-reduced-motion: reduce` | OS preference set | Manual |
| NFR-007 | Read-only proxy | No new `/api/*` endpoints | `grep -RIn "forgeplan" template/src/routes/api/` unchanged | Diff vs `develop` | Diff inspection (rule 22) |

---

## Acceptance Criteria

### AC-1: Lazy-loaded Force 3D chunk

```gherkin
Given a fresh production build of forgeplan-web
When  the user does NOT select Force 3D mode
Then  the bundle byte-count of dist/client/_app/immutable/ matches the
      pre-PR baseline (Force 3D code lives in its own chunk)
```

### AC-2: Mode parity

```gherkin
Given a workspace of N artifacts
When  the user is in Force mode then switches to Force 3D
Then  the number of rendered nodes equals N (after the same filters)
And   the number of rendered edges equals the number of rendered edges
      in Force mode for the same filters
```

### AC-3: Experimental badge

```gherkin
Given the view-mode dropdown is open
When  the user inspects the entries
Then  "Force 3D" is the last entry
And   it carries an "experimental" badge visible to sighted users
And   its accessible name reads "Force 3D, experimental"
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| `threlte` (Threlte v8 / Svelte 5) | Runtime | Available on npm | upstream |
| `three` | Runtime | Available on npm | upstream |
| `d3-force-3d` | Runtime | Available on npm | upstream |
| Existing graph data store | Internal | Active | this repo |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Three.js bundle adds ~150KB gzip to the main bundle | Medium | Medium | Lazy-load via dynamic `import()` (FR-009 / NFR-003). Verify via `du -sb` baseline diff. | this repo |
| R-2 | WebGL not available in user environment | Low | Medium | Fallback message "Force 3D requires WebGL" rendered in the canvas slot; user can switch back to Force. | this repo |
| R-3 | Threlte v8 + Svelte 5 runes integration has rough edges | Medium | Medium | Stick to `<T>` declarative components and a small `useTask` for sim ticks; avoid the experimental APIs. | this repo |
| R-4 | Hairballs are still hairballs in 3D for very dense central clusters | Low | Low | Reuse `forceClusterRepel` ported to 3 axes; document in the RFC that this is mitigation, not elimination. | this repo |

---

## Affected Files

- `template/src/shared/config/ui-prefs.ts` — add `force3d` to `GRAPH_VIEWS` + `GraphView` union, extend `GraphViewMeta` with optional `badge`.
- `template/src/shared/ui/select/Select.svelte` — render `item.badge` next to label.
- `template/src/widgets/dependency-graph-3d/**` — new widget (Threlte canvas + sim + theme).
- `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` — wire `force3d` branch with dynamic import.
- `template/src/widgets/dependency-graph/ui/ForceView.svelte` — `// TODO(force-mode-2d3d-switch)` marker for the future in-mode switch.
- `template/package.json` — add `threlte`, `three`, `d3-force-3d` to `dependencies` + their `@types/*` to devDeps.

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| RFC-019 | Architecture proposal | Draft |
| EVID-XX | Browser smoke test | TBD |

---

> **Next step**: forgeplan validate PRD-022; align with RFC-019; create EvidencePack after browser smoke.



