---
depth: standard
id: PRD-025
kind: prd
links:
- target: PRD-026
  relation: informs
status: active
title: init --scope user/project with interactive prompt fallback
---

---
id: PRD-025
title: "init --scope user|project with interactive prompt fallback"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
priority: P1
depth: standard
domain: general
projectType: cli_tool
stepsCompleted: []
---

# PRD-025: init --scope user|project with interactive prompt fallback

## Executive Summary

### Vision

Extend `npx @forgeplan/web init` with a `--scope user|project` flag that
chooses where the scaffold is written: per-project (`./.forgeplan-web/`,
today's behavior) or per-user (`~/.forgeplan-web/`, the new default for
fresh installs). When the flag is omitted on an interactive TTY, the
user is prompted with arrow-key selection.

### Problem

Today every project gets its own `.forgeplan-web/` (~11 MB including a
generated `node_modules/` for the legacy artifact, ~1 MB for the bundled
artifact). Users with N forgeplan-managed repos pay N× disk + N× update
cycles. There is no way to share a single scaffold across repos. Sub-issue
#111 is the prerequisite for the multi-instance registry (#113), which
requires a stable user-scope path (`~/.forgeplan-web/instances.json`,
locked by ADR-004).

**Impact**: Fresh adopters with multiple forgeplan repos report disk-
bloat surprise; the per-project scaffold also makes the upcoming
multi-instance switcher (#115) impossible to ship without a user-scope
home.

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| Fresh adopter | First-time `npx @forgeplan/web init` user | Wants single install across all repos; doesn't know which scope is "right"; needs guidance |
| Existing user (project-scope) | Has `.forgeplan-web/` in N repos already | Must keep working unchanged — zero-config invariant |
| Power user | Wants explicit non-interactive control (CI / scripts) | Needs `--scope` flag to bypass prompt |

### Differentiators

- Backwards-compat invariant: `init -y` (no `--scope`) keeps writing
  project-scope. Existing users see no change.
- Interactive prompt only fires when TTY is available AND `--scope` is
  not passed AND `-y` is not passed. CI is unaffected.
- User-scope path is locked to `~/.forgeplan-web/` by ADR-004 (no XDG,
  no per-OS paths in MVP — punted to growth).

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | `init -y` keeps writing project-scope (zero-config preservation) | Filesystem state diff | project-scope | project-scope (unchanged) | Same PR | Smoke test: existing flag-parity asserts |
| SC-2 | `init --scope user` writes to `~/.forgeplan-web/` | Existence check | not implemented | exists | Same PR | Smoke test: assert `~/.forgeplan-web/index.js` |
| SC-3 | Interactive prompt selects user-scope as default | Cursor position on first render | n/a | "user" highlighted | Same PR | Manual verification + e2e on Linux + macOS |
| SC-4 | `forgeplan-web.json` records the chosen scope | JSON field present | absent | `"scope": "user" \| "project"` | Same PR | Schema check |
| SC-5 | Project-scope appends `.gitignore`; user-scope does NOT | git status diff | project: appends; user: n/a (no host repo) | unchanged | Same PR | Smoke test: assert no `.gitignore` write under `--scope user` |
| SC-6 | Prompt latency on TTY | ms to first prompt render | n/a | < 50ms | Same PR | Manual / smoke timing |

---

## Product Scope

### MVP (In-Scope)

- New flag: `--scope user|project` on `init` subcommand (delivered via
  citty in PRD-024).
- Interactive prompt when scope omitted on TTY. Default selection = `user`
  (encouraging the new shared-scope pattern for fresh installs).
- New helper module `bin/lib/scope.mjs` — pure resolver functions
  (`resolveUserScopeRoot()`, `resolveProjectScopeRoot(cwd)`).
- `forgeplan-web.json` schema bump: add `"scope": "user" | "project"`
  field. Read-side accepts absent for back-compat (assumed `project`).
- `init -y` (no `--scope`): defaults to `project` (preserves existing
  user behavior). `init -y --scope user`: writes user-scope.
- `.gitignore` policy: project-scope appends `.forgeplan-web/` (existing
  behavior). User-scope: skipped entirely (the home dir isn't typically
  a git repo, and even if it is, we don't touch it).

### Out of Scope

- XDG_CONFIG_HOME compliance (per #109 acceptance — punted to a future
  PRD; tracked as growth).
- Per-OS paths (`%APPDATA%`, `~/Library/Application Support/`).
- Migration tool to move existing `./.forgeplan-web/` into
  `~/.forgeplan-web/`.
- Cross-host federation, auth, or remote scopes.
- Changing the default of `init -y` to user-scope (reserved for a future
  major version).

### Growth Vision

- Add XDG support after MVP usage settles.
- Add `init --scope <custom-path>` for CI sandboxes.

---

## User Journeys

### Journey 1: Fresh adopter

**Цель**: First-time install. User wants the lightest path.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | `npx @forgeplan/web init` | Banner + scope prompt: "Where to install? (↑↓ to select) ▶ user (~/.forgeplan-web/)  project (./.forgeplan-web/)" | Default highlight = user |
| 2 | Presses Enter | Scaffold copied to `~/.forgeplan-web/`; `forgeplan-web.json` records `scope: "user"` | NEW |
| 3 | `npx @forgeplan/web start` | Server boots reading from `~/.forgeplan-web/`; UI loads | Scope persists |

**Результат**: Single shared scaffold; subsequent repos reuse it.

### Journey 2: Existing user (project-scope)

**Цель**: Update an existing scaffold; doesn't pass `--scope`.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | `npx @forgeplan/web init -y` | Banner + scaffold copied to `./.forgeplan-web/` (project-scope) | Backwards-compat invariant |
| 2 | `git status` | Shows `.forgeplan-web/` already ignored | `.gitignore` was appended on first init |
| 3 | `npx @forgeplan/web start` | Server boots from project scaffold | Unchanged |

**Результат**: No behavior change; reassurance that the upgrade is safe.

### Journey 3: Power user / CI

**Цель**: Non-interactive install with explicit scope.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | `npx @forgeplan/web init --scope user -y` | Scaffold copied to `~/.forgeplan-web/` non-interactively; no prompt | `-y` confirms non-interactive |
| 2 | CI continues | Exit 0 | No prompt regression in CI |

**Результат**: Scriptable, deterministic.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | User can run `init --scope user` to install at `~/.forgeplan-web/` | Journey 1, 3 |
| FR-002 | Core | Must | User can run `init --scope project` to install at `./.forgeplan-web/` | Journey 2, 3 |
| FR-003 | Core | Must | When TTY is interactive AND `--scope` omitted AND `-y` omitted, user is prompted with arrow-key selection | Journey 1 |
| FR-004 | Core | Must | Prompt default selection is `user` for fresh installs | Journey 1 |
| FR-005 | Core | Must | When `-y` passed without `--scope`, scope defaults to `project` (zero-config preservation) | Journey 2 |
| FR-006 | Core | Must | Project-scope appends `.forgeplan-web/` to host `.gitignore` (existing behavior) | Journey 2 |
| FR-007 | Core | Must | User-scope does NOT touch any `.gitignore` | Journey 1 |
| FR-008 | Core | Must | `forgeplan-web.json` records the chosen scope as `"scope": "user" \| "project"` | Journey 1, 2, 3 |
| FR-009 | Core | Must | When non-TTY (CI) AND `--scope` omitted AND `-y` omitted, exit non-zero with message "no TTY; pass `--scope user\|project`" | Journey 3 |
| FR-010 | UX | Should | Prompt shows the resolved absolute path next to each option | Journey 1 |
| FR-011 | UX | Should | After install, stdout prints "→ scope: user (`~/.forgeplan-web/`)" line so the user knows what was chosen | Journey 1, 3 |
| FR-012 | DX | Should | `bin/lib/scope.mjs` exports pure functions reusable by PRD-026's start-resolution chain | Journey 3 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | Prompt first-render latency | < 50ms | TTY open | wall-clock measure |
| NFR-002 | Performance | `--scope` flag adds no measurable overhead | < 5ms over PRD-024 baseline | non-interactive `init -y --scope project` | hyperfine |
| NFR-003 | Compatibility | Existing `init -y` invocations preserve filesystem state | 0 diffs vs baseline | smoke run | `diff -r` |
| NFR-004 | Portability | `~/.forgeplan-web/` resolves correctly on macOS, Linux, Windows | path matches `os.homedir() + "/.forgeplan-web"` | all 3 OS | smoke matrix |
| NFR-005 | Safety | User-scope MUST NOT write outside `~/.forgeplan-web/` | 0 writes elsewhere | smoke audit | rule 20 verification (extended) |

---

## Acceptance Criteria

### AC-1: Backwards compatibility — `init -y` defaults to project-scope

```gherkin
Given a fresh repo with .forgeplan/ but no .forgeplan-web/
When the user runs `npx @forgeplan/web init -y`
Then the scaffold is created at ./.forgeplan-web/ (NOT ~/.forgeplan-web/)
And forgeplan-web.json contains "scope": "project"
And .gitignore is appended with .forgeplan-web/
And exit code is 0
```

### AC-2: Interactive prompt picks user as default

```gherkin
Given a TTY session and no --scope flag and no -y flag
When the user runs `npx @forgeplan/web init` and presses Enter immediately
Then the scaffold is created at ~/.forgeplan-web/
And forgeplan-web.json contains "scope": "user"
And no host .gitignore is touched
And exit code is 0
```

### AC-3: Non-TTY without explicit scope fails fast

```gherkin
Given a non-TTY session (e.g. piped from another command)
When the user runs `npx @forgeplan/web init` (no --scope, no -y)
Then exit code is non-zero
And stderr contains "no TTY" and instructs to pass --scope
And no scaffold is created
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| PRD-024 (citty + bin/ split) | Internal | Drafted | docs-eng-109 |
| ADR-004 (registry path) | Internal | Drafted (parallel) | adr-architect-109 |
| `consola.prompt` (via citty) | Runtime | Bundled with citty | This PRD |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Existing project-scope users surprised by new prompt | Low | Low | `-y` preserves old behavior; release notes call it out | dev |
| R-2 | `os.homedir()` returns unexpected path on Windows | Medium | Medium | Smoke matrix asserts; document in CHANGELOG | dev |
| R-3 | User-scope clashes with previously-init'd ~/.forgeplan-web/ from another tool | Very low | Low | Detect existing forgeplan-web.json before clobber; pass `--force` to override | dev |
| R-4 | Prompt fails on dumb terminals (TERM=dumb) | Medium | Low | Treat as non-TTY; fall back to error per FR-009 | dev |

---

## Affected Files

- `bin/commands/init.mjs` — adds `--scope` arg, prompt fallback, scope-aware target path
- `bin/lib/scope.mjs` — NEW; `resolveUserScopeRoot()`, `resolveProjectScopeRoot(cwd)`, `promptScope()`
- `bin/lib/gitignore.mjs` — gated by scope (project-only)
- `bin/lib/config.mjs` — `forgeplan-web.json` schema bump (`scope` field)
- `template/src/shared/server/forgeplan.ts` — read scope from cfg if needed (read-only)
- `scripts/smoke.mjs` — assertions for user-scope, project-scope, prompt-default
- README.md — document `--scope` flag and new prompt
- GitHub sub-issue: #111 (109b)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-024 | Depends on (citty + prompt support) | Draft |
| RFC-021 | Architecture | Draft |
| ADR-004 | Decision (registry path = `~/.forgeplan-web/`) | Proposed (parallel) |
| PRD-026 | Consumes scope (start-resolution chain) | Draft |
| PRD-027 | Consumes user-scope path (instances.json) | Draft |
| GitHub #111 | Source sub-issue | Open |

---

> **Next step**: Land alongside PRD-024 / RFC-021. PRD-026 (start chain) depends on this.





