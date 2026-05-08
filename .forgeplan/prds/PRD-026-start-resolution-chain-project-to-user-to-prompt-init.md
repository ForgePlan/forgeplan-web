---
depth: standard
id: PRD-026
kind: prd
links:
- target: PRD-027
  relation: informs
status: draft
title: start resolution chain (project to user to prompt-init)
---

---
id: PRD-026
title: "start resolution chain (project to user to prompt-init)"
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

# PRD-026: start resolution chain (project to user to prompt-init)

## Executive Summary

### Vision

Make `npx @forgeplan/web start` find the right scaffold automatically.
When invoked from any directory, it walks a deterministic chain —
project-scope first (existing behavior), user-scope next (PRD-025's new
home), and offers to run `init` interactively when neither is found.
Users can short-circuit the chain with `--scope user|project`.

### Problem

Today `start` only looks at `<cwd>/.forgeplan-web/` and fails immediately
if it's missing. Once PRD-025 ships, fresh users will install at user-
scope (`~/.forgeplan-web/`) but still run `npx @forgeplan/web start`
from inside a project — the start command would error out even though
a perfectly good scaffold exists in the user-scope. Without a smart
resolution chain, the user-scope rollout is unusable; the user must
either `cd ~` to start (awkward) or always pass an explicit path.

**Impact**: Without resolution, every `start` from a fresh project
errors; documentation must explain the gotcha; user-scope adoption stalls.

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| Project-scope user | Has `./.forgeplan-web/` in current repo | Wants `start` to keep working from cwd, no behavior change |
| User-scope user | Installed via `init --scope user` | Wants `start` to find user-scope from any cwd |
| First-time user | Has neither scaffold | Wants `start` to offer to install instead of erroring |

### Differentiators

- Backwards-compat invariant: a project-scope user sees zero behavior
  change. The chain probes project FIRST.
- One CLI command works from any cwd — no "you have to start from `~`"
  surprise for user-scope adopters.
- Friendly empty-state: prompt to init instead of error message.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Project-scope behavior preserved | `start` from a repo with `./.forgeplan-web/` boots existing scaffold | works | works (no change) | Same PR | Smoke test |
| SC-2 | User-scope auto-resolution from any cwd | `start` from `/tmp` with only `~/.forgeplan-web/` boots user scaffold | not implemented | works | Same PR | Smoke test |
| SC-3 | Explicit override works both ways | `start --scope user` from a repo with only project-scope errors with clear message | not implemented | exits non-zero with message | Same PR | Smoke test |
| SC-4 | Scaffold lookup latency | ms from invocation to spawn or fail | n/a (single-path probe) | < 50ms | Same PR | hyperfine |
| SC-5 | Empty-state UX | When no scaffold found, `start` prompts to init | exits with error | offers prompt | Same PR | Smoke test (TTY) |
| SC-6 | Empty-state CI behavior | Non-TTY without scaffold: clear error, exit non-zero | exits with error | unchanged (error) | Same PR | Smoke test (non-TTY) |

---

## Product Scope

### MVP (In-Scope)

- New resolution chain in `bin/commands/start.mjs`:
  1. If `--scope project` passed: probe `<cwd>/.forgeplan-web/` only.
  2. If `--scope user` passed: probe `~/.forgeplan-web/` only.
  3. If `--scope` omitted: probe project first, then user, then prompt.
- Reuse `bin/lib/scope.mjs` (PRD-025 / RFC-021).
- Empty-state: when no scaffold found AND TTY AND `-y` not passed,
  prompt "No scaffold found. Run `init` now? (Y/n) Where? (user|project)".
- Non-TTY empty-state: error with "no scaffold; run `npx @forgeplan/web
  init [--scope user|project]` first".
- `forgeplan-web.json` is consulted to determine the binding scope when
  scaffold exists (allows `start` to log the chosen scope clearly).

### Out of Scope

- Walking up parent directories searching for a project-scope scaffold
  (out of scope per #109; user is expected to be inside the project).
- Cross-host federation.
- Switching scope mid-session (a separate `--switch` flag deferred to
  growth).
- Auto-init without prompt.

### Growth Vision

- Walk-up parent search (`startResolveStrategy=parents`).
- Symlink legacy `./.forgeplan-web/` → `~/.forgeplan-web/` migration
  helper.

---

## User Journeys

### Journey 1: Project-scope user (no behavior change)

**Цель**: Run `start` in a repo that already has `./.forgeplan-web/`.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | `cd ~/proj && npx @forgeplan/web start` | Resolves to `./.forgeplan-web/`; spawns server | Project chain wins |
| 2 | Browser opens `http://127.0.0.1:5174` | Health, graph load | Unchanged |

**Результат**: Identical behavior to today.

### Journey 2: User-scope user from any cwd

**Цель**: Run `start` from anywhere; resolver finds the user scaffold.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | `cd /tmp && npx @forgeplan/web start` | Probes project (none) → probes user (`~/.forgeplan-web/`) → spawns | NEW |
| 2 | stdout: "→ scope: user (`~/.forgeplan-web/`)" | User sees what was picked | NEW |
| 3 | Browser opens `http://127.0.0.1:5174` | Server uses `FORGEPLAN_CWD` from `forgeplan-web.json` | Unchanged |

**Результат**: Single shared scaffold serves all repos.

### Journey 3: First-time user / empty state

**Цель**: Run `start` before installing.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | `npx @forgeplan/web start` (no scaffold anywhere, TTY) | Prompt: "No scaffold found. Install now? (Y/n)" → "Where? user/project" | NEW |
| 2 | User picks "user" | Runs init flow inline; then spawns | One-step onboarding |

**Результат**: Smoother first run.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | User can run `start` from any cwd; CLI finds the nearest scaffold via the chain (project → user → prompt) | Journey 1, 2 |
| FR-002 | Core | Must | When `--scope project` passed, only `<cwd>/.forgeplan-web/` is probed; missing → error | Journey 1 |
| FR-003 | Core | Must | When `--scope user` passed, only `~/.forgeplan-web/` is probed; missing → error | Journey 2 |
| FR-004 | Core | Must | When no scaffold is found AND TTY AND `-y` omitted, user is prompted to init inline | Journey 3 |
| FR-005 | Core | Must | When no scaffold is found AND non-TTY (or `-y` passed), exit non-zero with message instructing init | Journey 3 |
| FR-006 | Core | Must | Backwards compat: existing project-scope users see no behavior change | Journey 1 |
| FR-007 | UX | Should | After resolution, stdout prints "→ scope: user (`~/.forgeplan-web/`)" or "→ scope: project (./.forgeplan-web/)" | Journey 1, 2 |
| FR-008 | UX | Should | Resolver respects `FORGEPLAN_WEB_SCAFFOLD` env var as final override (escape hatch) | Journey 2 |
| FR-009 | DX | Should | `bin/commands/start.mjs` reuses `resolveScopeRoot` from `bin/lib/scope.mjs` (no path duplication) | Journey 1, 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | Scaffold lookup walltime | < 50ms | cold cache | hyperfine (median 5 runs) |
| NFR-002 | Compatibility | Project-scope user `start` filesystem touch | 0 changes | smoke baseline | `diff -r` |
| NFR-003 | Portability | Path probing works on macOS, Linux, Windows | All 3 OS green | CI matrix | smoke matrix |
| NFR-004 | Safety | Resolver MUST NOT execute child processes during probe | 0 spawns | static review | grep `spawn`/`execFile` outside the final `node index.js` invocation |

---

## Acceptance Criteria

### AC-1: Project-scope wins when both scopes exist

```gherkin
Given ./.forgeplan-web/ exists in cwd
And ~/.forgeplan-web/ also exists
When the user runs `npx @forgeplan/web start`
Then the resolver picks ./.forgeplan-web/
And stdout prints "→ scope: project (./.forgeplan-web/)"
And the server boots from cwd
```

### AC-2: User-scope picked when project-scope absent

```gherkin
Given no .forgeplan-web/ exists in cwd
And ~/.forgeplan-web/ exists
When the user runs `npx @forgeplan/web start`
Then the resolver picks ~/.forgeplan-web/
And stdout prints "→ scope: user (~/.forgeplan-web/)"
And the server boots from the user-scope scaffold
```

### AC-3: Empty state — TTY prompts to init

```gherkin
Given no scaffold exists in either scope
And the session is TTY
When the user runs `npx @forgeplan/web start`
Then stdout shows a prompt asking to init now
And on confirmation, init runs inline
And on decline, exit code is non-zero with helpful message
```

### AC-4: Empty state — non-TTY errors

```gherkin
Given no scaffold exists in either scope
And the session is non-TTY (CI)
When the user runs `npx @forgeplan/web start`
Then exit code is non-zero
And stderr instructs to run `init` first with --scope flag
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| PRD-025 (`--scope` flag plumbing) | Internal | Drafted | docs-eng-109 |
| RFC-021 (scope resolver) | Internal | Drafted | docs-eng-109 |
| PRD-024 (citty + bin/ split) | Internal | Drafted | docs-eng-109 |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Existing project-scope user inadvertently gets user-scope when they `cd` outside the project | Low | Medium | Project always probed first; clearly print resolved scope so user notices | dev |
| R-2 | Inline init prompt stalls CI that expected fast error | Low | Medium | TTY check guards prompt; non-TTY errors immediately | dev |
| R-3 | `~/.forgeplan-web/forgeplan-web.json` corrupted → start picks user but server fails | Low | Low | Validate JSON parse before spawn; fall back to error | dev |
| R-4 | Symlink at `~/.forgeplan-web/` causes confusion | Low | Low | `lstatSync` before spawn; refuse if symlink (mirrors update's CWE-59 guard) | dev |

---

## Affected Files

- `bin/commands/start.mjs` — adds resolution chain
- `bin/lib/scope.mjs` — extended with `resolveStartScaffold` (or fold into `resolveScopeRoot`)
- `bin/lib/config.mjs` — reads `scope` field from `forgeplan-web.json`
- `scripts/smoke.mjs` — chain assertions
- README.md — document chain order
- GitHub sub-issue: #112 (109c)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-025 | Depends on (`--scope` flag) | Draft |
| RFC-021 | Depends on (resolver) | Draft |
| RFC-022 | Architecture | Draft |
| PRD-024 | Depends on (citty + bin/ split) | Draft |
| PRD-027 | Informs (registry's stale-sweep runs on `start`) | Draft |
| GitHub #112 | Source sub-issue | Open |

---

> **Next step**: Land alongside RFC-022. PRD-027 (registry) hooks into `start` after this lands.



