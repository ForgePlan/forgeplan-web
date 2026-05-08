---
depth: standard
id: PRD-029
kind: prd
status: active
title: HealthBar instance switcher (Combobox wired to /api/instances)
---

---
id: PRD-029
title: "HealthBar instance switcher (Combobox wired to /api/instances)"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
priority: P1
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-029: HealthBar instance switcher (Combobox wired to /api/instances)

## Executive Summary

### Vision

Wire the HealthBar widget to the new `/api/instances` endpoint
(PRD-027 / RFC-025). When two or more forgeplan-web instances are
running, HealthBar renders a Combobox (PRD-028) listing them with the
current instance pre-selected. Picking another navigates the browser
to it via `window.location.replace`. With a single instance, the
existing static label is preserved (zero-config).

### Problem

Once PRD-027 makes multi-instance possible, users have no in-app way
to jump between instances — they must remember port numbers and edit
the URL. PRD-028 ships the right primitive (Combobox); this PRD wires
it to the registry data and integrates it into HealthBar's existing
layout.

**Impact**: Multi-instance feature is half-shipped without the UI
switcher; users who run 5 instances must memorize 5 URLs (`5174`,
`5175`, …) and tab through them manually.

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| Multi-instance dev | Has 2-5 instances running across repos | Must remember port numbers; alt-tab between browser tabs |
| Single-instance user | Has 1 instance | Wants no UI clutter; current static label preferred |
| Mobile / narrow viewport user | HealthBar already responsive | Combobox must not break narrow layouts |

### Differentiators

- Auto-hides when only 1 instance — zero clutter for the common case.
- Marks current instance visually (e.g. checkmark + accent).
- 5s client poll matches existing `healthPoller` cadence.
- Read-only — switcher reads `/api/instances`, never writes.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Switcher appears only when ≥2 instances | Conditional render check | not implemented | renders only when `instances.length >= 2` | Same PR | Unit + smoke |
| SC-2 | Selecting another instance navigates browser | `window.location.replace` invoked | not implemented | invoked with target URL | Same PR | E2E spy |
| SC-3 | Current instance pre-selected | combobox `value` matches current `host:port` | n/a | matches | Same PR | Unit |
| SC-4 | Single-instance UX preserved | HealthBar render diff vs current main | unchanged | unchanged (no Combobox in DOM) | Same PR | Snapshot test |
| SC-5 | Instance fetch latency | `GET /api/instances` round-trip | n/a | < 100ms p95 | Same PR | Browser perf timing |
| SC-6 | Combobox first-paint | ms from `instances` arrival to first render | n/a | < 50ms | Same PR | Performance.mark |
| SC-7 | Rule 24 clean (no :global() override on Combobox internals) | rule-24 grep snippet | 0 hits | 0 hits | Same PR | grep |
| SC-8 | Rule 22 amendment landed | Endpoint `/api/instances` documented in `.claude/rules/22-readonly-proxy.md` | not documented | documented as second non-forgeplan endpoint | Same PR | Diff review |

---

## Product Scope

### MVP (In-Scope)

- New entity slice `template/src/entities/instance/` — types + client
  poller mirroring the shape of `template/src/entities/health/`.
- Poll `/api/instances` every 5s (same cadence as healthPoller).
- HealthBar renders a Combobox in the `.meta` block when
  `instances.length >= 2`. Otherwise: existing static label kept.
- Combobox `value` = current instance's `host:port`. Options listed in
  ascending port order; current marked with an accent indicator.
- Selecting another option triggers `window.location.replace(\`http://${
  selected.host}:${selected.port}\`)` — full reload, no SPA navigation
  (each instance is a separate Node process).
- Endpoint `template/src/routes/api/instances/+server.ts` (created in
  PRD-027) — read-only, returns standard envelope.
- **Rule 22 amendment** (this PRD): document `/api/instances` as the
  second permitted non-forgeplan endpoint (alongside `/api/update-check`).

### Out of Scope

- Cross-host federation (`http://other-machine:5174` is not in the
  registry by design).
- Showing instance health (red/green dot per instance) — punt to
  growth.
- Authoring / killing instances from the UI — registry is read-only
  surface (rule 22 invariant).
- Persisting "favorite" instances across switches.

### Growth Vision

- Per-instance health indicator (red/green dot) sourced from
  `forgeplan health` of the target.
- Recently-visited instance list.
- Quick-stop button per instance (would require a new mutating endpoint
  — separate ADR).

---

## User Journeys

### Journey 1: Multi-instance dev switches between projects

**Цель**: Move from `proj-a` to `proj-b` without leaving the browser.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | Two instances running (5174 + 5175) | HealthBar Combobox visible with 2 entries | NEW |
| 2 | Clicks Combobox | Dropdown opens; current marked | Combobox primitive |
| 3 | Picks `proj-b (127.0.0.1:5175)` | `window.location.replace` → `http://127.0.0.1:5175` | Full reload |
| 4 | Browser is on proj-b | proj-b's HealthBar shows it as current | Round-trip |

**Результат**: One-click switch.

### Journey 2: Single-instance user — no clutter

**Цель**: Existing single-instance user sees no UI change.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | Visits `http://127.0.0.1:5174` (only instance) | HealthBar renders with existing static project label | Backwards-compat |
| 2 | DOM inspection | No Combobox node | Conditional render |

**Результат**: Zero UI churn.

### Journey 3: Narrow viewport

**Цель**: HealthBar stays usable on mobile / narrow screens.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | Window 360px wide | HealthBar wraps; Combobox shrinks to `size="sm"` | Combobox sizing |
| 2 | Combobox content opens | Dropdown is portaled (overflow ok) | bits-ui Portal |

**Результат**: No layout break.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | When ≥ 2 instances are present in `/api/instances` response, HealthBar renders a Combobox listing them | Journey 1 |
| FR-002 | Core | Must | Selecting a non-current instance triggers `window.location.replace` to its URL | Journey 1 |
| FR-003 | Core | Must | When exactly 1 instance is present, HealthBar renders the existing static label (no Combobox) | Journey 2 |
| FR-004 | Core | Must | Current instance is visually marked in the dropdown (checkmark or accent) | Journey 1 |
| FR-005 | Core | Must | The endpoint `GET /api/instances` is added to the rule-22 read-only allow-list (non-forgeplan endpoint, alongside `/api/update-check`) | Journey 1 |
| FR-006 | Core | Must | Client polls `/api/instances` every 5s using a poller that mirrors `healthPoller`'s shape | Journey 1, 2 |
| FR-007 | Core | Must | HealthBar consumes Combobox via `import { Combobox, ... } from '@/shared/ui'` (no re-skin) | Journey 1 |
| FR-008 | Core | Must | When the registry returns `{ ok: false }`, switcher hides gracefully and a toast (non-blocking) reports the error | Journey 1 |
| FR-009 | UX | Should | Combobox uses `size="sm"` to match HealthBar's compact density | Journey 1, 3 |
| FR-010 | UX | Should | Combobox label format: `{projectName} ({host}:{port})` | Journey 1 |
| FR-011 | UX | Should | Options sort by `port` ascending | Journey 1 |
| FR-012 | DX | Should | New entity slice `template/src/entities/instance/` exposes `instancePoller` + types | Journey 1 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | Instance fetch round-trip | < 100ms p95 | localhost | DevTools Network |
| NFR-002 | Performance | Combobox first-render | < 50ms | from `instances` arrival | Performance.mark |
| NFR-003 | Read-only | Switcher MUST never call mutating endpoints | 0 mutating fetches | static review | grep |
| NFR-004 | Rule 24 | No `:global()` override on Combobox internals from `widgets/health-bar/` | 0 matches | rule-24 snippet | grep |
| NFR-005 | A11y | Keyboard nav works (arrow keys, type-to-filter, Enter, Escape) | 0 axe violations | both themes | axe + manual |
| NFR-006 | Bundle | Bundle delta from poller + entity slice + HealthBar wiring | < 3KB gzipped | post-build | size diff |

---

## Acceptance Criteria

### AC-1: Switcher visible only with ≥2 instances

```gherkin
Given the registry returns 1 instance
When the user loads HealthBar
Then no Combobox is in the DOM
And the existing static project label is rendered

Given the registry returns 2 instances
When the user loads HealthBar
Then a Combobox is rendered with 2 options
And the current `host:port` is pre-selected
```

### AC-2: Selecting another instance navigates the browser

```gherkin
Given a Combobox with 2 instances and the current is 127.0.0.1:5174
When the user selects 127.0.0.1:5175
Then `window.location.replace` is called with "http://127.0.0.1:5175"
```

### AC-3: Read-only invariant — endpoint never mutates

```gherkin
Given the new endpoint /api/instances exists
When grep is run on template/src/routes/api/instances/+server.ts
Then no spawn / execFile / forgeplan-mutating calls are present
And no fs.writeFile* calls are present
And only GET handler is exported
```

---

## Rule 22 amendment (embedded — applied in same PR)

Append the following block to `.claude/rules/22-readonly-proxy.md` under
the "Allow-list extension" section, immediately after the
`/api/update-check` paragraph:

```markdown
## Allow-list extension: `/api/instances` (non-forgeplan)

`/api/instances` is the **second** non-forgeplan endpoint permitted
from `/api/*`. It reads the local instance registry at
`~/.forgeplan-web/instances.json` (defined by SPEC-003) so the UI can
render the multi-instance switcher (PRD-029).

Constraints (every one of these is enforceable from the diff):

- Method: `GET` only.
- Reads only `~/.forgeplan-web/instances.json` via the helper
  `template/src/shared/server/registry.ts`. Path is locked (rule 24
  invariant).
- No spawn, no host filesystem write, no Forgeplan invocation.
- 5s in-memory cache to absorb client poll spikes.
- Response shape mirrors the standard envelope:
  `{ ok, data: { instances }, error? }`.
- Filesystem read failures (file missing, parse error) MUST fall back
  to `{ ok: true, data: { instances: [] } }` — empty registry, never
  throw.

Any additional non-forgeplan endpoint requires a new Forgeplan artifact
and a fresh amendment to this rule. See PRD-027 / PRD-029 / RFC-025.
```

The runtime backstop (`runForgeplan` subcommand check) is unchanged —
this endpoint never calls forgeplan.

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| PRD-027 (registry endpoint) | Internal | Drafted | docs-eng-109 |
| PRD-028 (Combobox primitive) | Internal | Drafted | docs-eng-109 |
| RFC-025 (this PRD's architecture) | Internal | Drafted | docs-eng-109 |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | `window.location.replace` blocked by browser security policy | Very low | Medium | Localhost only — same-origin per scheme; document the limitation | dev |
| R-2 | Switcher renders before `instances` arrives → empty Combobox flash | Medium | Low | Render only when `instances.length >= 2` (already conditional) | dev |
| R-3 | Stale entry shown for 30-60s after a peer crashed | Medium | Low | Acceptable — sweep-on-next-start cleans (PRD-027); user gets a connection error if they pick stale entry; show toast | dev |
| R-4 | Rule 22 grep snippet not updated; review misses new endpoint | Low | Medium | Same PR adds the amendment block; reviewer follows checklist | dev |
| R-5 | Combobox dropdown clipped by HealthBar overflow | Low | Low | bits-ui Portal escapes overflow — already in ComboboxContent | dev |

---

## Affected Files

- `template/src/widgets/health-bar/ui/HealthBar.svelte` — wire Combobox
- `template/src/entities/instance/index.ts` (NEW)
- `template/src/entities/instance/lib/instance-poller.svelte.ts` (NEW)
- `template/src/entities/instance/model/types.ts` (NEW)
- `template/src/routes/api/instances/+server.ts` (NEW — created in PRD-027 wave; this PRD consumes)
- `template/src/shared/server/registry.ts` (NEW — created in PRD-027 wave; this PRD consumes)
- `.claude/rules/22-readonly-proxy.md` — amendment block above
- GitHub sub-issue: #115 (109f)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-027 | Depends on (registry + endpoint) | Draft |
| PRD-028 | Depends on (Combobox primitive) | Draft |
| RFC-025 | Architecture | Draft |
| RFC-024 | Informs (Combobox architecture) | Draft |
| GitHub #115 | Source sub-issue | Open |
| GitHub #109 | Parent issue | Open |

---

> **Next step**: Land alongside RFC-025 + PRD-027 + PRD-028. Consumes /api/instances and Combobox.





