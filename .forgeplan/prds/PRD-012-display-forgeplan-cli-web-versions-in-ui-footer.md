---
depth: standard
id: PRD-012
kind: prd
last_modified_at: 2026-05-06T16:19:18.515494+00:00
last_modified_by: claude-code/2.1.131
status: active
title: Display forgeplan CLI + web versions in UI footer
---

---
id: PRD-012
title: "Display forgeplan CLI + web versions in UI footer"
status: Draft
created: 2026-05-06
updated: 2026-05-06
priority: P3
depth: standard
domain: general
projectType: web_app
---

# PRD-012: Display forgeplan CLI + web versions in UI footer

## Executive Summary

### Vision

Render the running forgeplan CLI version and the @forgeplan/web package
version as a small unobtrusive label in the bottom-left corner of the
graph UI, so any user (or screenshot) immediately reveals which exact
toolchain produced the view.

### Problem

The viewer renders a graph derived from the host's `forgeplan` CLI but
shows nothing about which CLI version actually produced the JSON. When a
user files a bug ("graph shows nothing", "list endpoint 500s"), there is
no way to tell, from a screenshot or pasted URL, which CLI build is
running on their machine — schema/CLI mismatches between web 0.1.x and
forgeplan 0.27.x are diagnosed by hand. The package's own version is
similarly invisible after `npx @forgeplan/web init`.

**Impact**: every bug report needs a clarifying round-trip
("`forgeplan --version`?", "what's in `.forgeplan-web/package.json`?")
before triage can start; documentation screenshots have no proof of
which release they were taken on.

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| forgeplan-web user | Engineer using `npx @forgeplan/web start` to inspect their workspace | "Is this UI bug fixed in latest? Am I on a stale CLI?" |
| Maintainer / triager | Repo maintainer reading bug reports, screenshots | Cannot infer CLI/web version from a screenshot — must ask |

### Differentiators

- Versions are rendered live from the actual installed binaries, not
  baked at the time of a doc build, so the label cannot drift from
  reality.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Version label visible on every page render | Label present in DOM at viewport bottom-left | Not present | Present on `/` | This PR | Manual smoke test (vite dev) |
| SC-2 | Both versions resolved (web + CLI), no spinner left | DOM text matches `^web v\d+\.\d+\.\d+ · cli v\d+\.\d+\.\d+$` (or `· cli ?` if CLI lookup fails) | n/a | Pattern matches within 2s | This PR | `node scripts/smoke.mjs` extension hits `/api/version` and asserts shape |

---

## Product Scope

### MVP (In-Scope)

- A new `GET /api/version` endpoint that returns `{ web: string, cli: string | null }`.
- `getForgeplanVersion()` helper in `template/src/shared/server/forgeplan.ts`
  that spawns `forgeplan --version`, parses `forgeplan X.Y.Z`, caches the
  result for the process lifetime.
- `__FORGEPLAN_WEB_VERSION__` constant injected by Vite from
  `template/package.json#version` so the web version is known without
  runtime I/O.
- Small `version-footer` widget (FSD widget layer) rendered inside
  `HomePage`, fixed to bottom-left, monospace, low-contrast.
- The CLI version may be `null` if the CLI is missing, errors, or the
  output cannot be parsed — the UI renders `cli ?` rather than failing.

### Out of Scope

- Telemetry / phone-home reporting of versions.
- Showing forgeplan-web build commit/SHA (only the package version).
- A "check for update" prompt or comparison against a remote registry.
- Surfacing versions of any other binary in the user's PATH.

### Growth Vision

- Could be extended to display a "stale" badge if the user's CLI is
  older than the web client expects (requires a documented compat
  matrix — explicit follow-up, not in this PR).

---

## User Journeys

### Journey 1: forgeplan-web user — "is my CLI even running?"

**Цель пользователя**: confirm at a glance that `forgeplan` is reachable
and at what version.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Runs `npx @forgeplan/web start` and opens `http://127.0.0.1:5173/` | Graph renders | unchanged |
| 2 | Glances at bottom-left | Sees `web v0.1.11 · cli v0.27.0` | new |
| 3 | If CLI is missing | Sees `web v0.1.11 · cli ?`, no error toast | degrades gracefully |

**Результат**: user knows both versions without opening DevTools or a terminal.

### Journey 2: Maintainer — bug triage from screenshot

**Цель пользователя**: identify the toolchain version in a user-supplied screenshot.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Opens issue with screenshot of UI | n/a | — |
| 2 | Reads the bottom-left label | Confirms exact `web` and `cli` versions | no ping-pong needed |

**Результат**: triage starts with versions known.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | User can read the @forgeplan/web package version in the UI without opening DevTools | Journey 1 |
| FR-002 | Core | Must | User can read the host forgeplan CLI version in the UI without running a terminal command | Journey 1 |
| FR-003 | Reliability | Must | UI degrades to a placeholder (`?`) when CLI version lookup fails, with no error toast and no broken layout | Journey 1 |
| FR-004 | Performance | Should | Version label appears within 2 seconds of first paint | Journey 1 |
| FR-005 | Accessibility | Should | Label is announced as `forgeplan-web version 0.1.11, forgeplan CLI version 0.27.0` to screen readers | Journey 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | `/api/version` shall respond | < 200 ms p95 | After first call (cached) | Smoke test instrumentation |
| NFR-002 | Reliability | CLI version cache shall not stale across CLI replacement | n/a — process restart on `start` resets cache | Per process | Manual (kill + restart server) |
| NFR-003 | Security | Endpoint shall not accept input parameters | 0 accepted query params | All requests | Code review of `+server.ts` |
| NFR-004 | Layout | Footer shall not overlap interactive UI | 0 click-blocking events on the area covered by the footer in any viewport ≥ 1024×768 | All viewports ≥ 1024×768 | Manual verification |

---

## Acceptance Criteria

### AC-1: happy path

```gherkin
Given a workspace with a working `forgeplan` CLI on PATH
When the user opens `/`
Then the bottom-left footer shows `web v<semver> · cli v<semver>`
And both segments resolve within 2 seconds.
```

### AC-2: missing CLI

```gherkin
Given `FORGEPLAN_BIN` points to a non-existent path
When the user opens `/`
Then the footer shows `web v<semver> · cli ?`
And no error toast is rendered
And the rest of the page still loads.
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| `forgeplan --version` flag stable across 0.27.x | External | Stable (verified manually) | forgeplan upstream |

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | `forgeplan --version` output format changes (e.g. JSON-only) | Low | Low | Permissive parser: regex on `\d+\.\d+\.\d+`; fall back to `null` | this PR |
| R-2 | New endpoint widens the read-only proxy surface and contradicts rule 22 | Low | Medium | Update rule 22 in same PR to call out `--version` flag, keep subcommand allow-list closed | this PR |

---

## Affected Files

- `template/src/shared/server/forgeplan.ts` — add `getForgeplanVersion()` cache
- `template/src/routes/api/version/+server.ts` — new GET endpoint
- `template/src/widgets/version-footer/` — new FSD widget
- `template/src/pages/home/ui/HomePage.svelte` — render the footer
- `template/vite.config.ts` — inject `__FORGEPLAN_WEB_VERSION__`
- `template/src/app.d.ts` — declare ambient global
- `.claude/rules/22-readonly-proxy.md` — clarify `--version` flag handling

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| RFC-011 | Implementation approach | draft |
| EVID-XXX | Smoke test confirming endpoint shape and footer render | tbd |



