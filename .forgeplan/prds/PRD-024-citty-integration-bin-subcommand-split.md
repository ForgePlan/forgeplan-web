---
depth: standard
id: PRD-024
kind: prd
links:
- target: PRD-025
  relation: informs
status: draft
title: citty integration + bin/ subcommand split
---

---
id: PRD-024
title: "citty integration + bin/ subcommand split"
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

# PRD-024: citty integration + bin/ subcommand split

## Executive Summary

### Vision

Replace the hand-rolled argv parser in `bin/forgeplan-web.mjs` with the
`citty` CLI framework and split the monolithic 367-line bin script into
small per-subcommand files under `bin/commands/`. The result is a
maintainable surface that supports interactive prompts, typed flags, and
auto-generated `--help` while keeping zero third-party transitive deps.

### Problem

The current parser (`bin/forgeplan-web.mjs:22-40`) is a flat `Set` of
argv tokens. Adding a new flag means hand-editing `flags.has(...)` calls
in three places (`init`, `update`, `start`). Adding a new subcommand
means appending to a `switch` block. There is no `--help <subcommand>`,
no flag validation (`--scope=foo` silently passes through), and no
hook-point for an interactive prompt — which GitHub issue #109 (sub-issues
#110–#115) needs in order to ship `--scope user|project` with a default
chosen by arrow-key prompt.

**Impact**: `npx @forgeplan/web` users hit DX papercuts (no per-subcommand
help, silent typos), and contributors avoid touching `bin/` because every
new flag risks breaking three subcommands at once.

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| Forgeplan-web user | Devs running `npx @forgeplan/web init` against a repo with `.forgeplan/` | No `--help init`; typos like `--no-gitignor` silently ignored; no interactive scope picker for #109 |
| Contributor on `bin/` | Devs adding new flags / subcommands | Three places to edit; manual flag parsing is brittle; cannot grow further without rewrite |

### Differentiators

- Citty is zero-dep ESM-only — preserves rule 23's invariant (no third-
  party transitive resolution at `npx` time).
- Per-subcommand files keep diffs small and reviewable.
- Interactive prompt support unblocks #109 (#111 needs scope prompt) and
  future flags without re-litigating the framework choice.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | All existing flags keep identical observable behavior | Flag-parity tests pass | 0 of 6 covered | 6 of 6 (`-y`, `--force`, `--quiet`, `--no-gitignore`, `--experimental`, `--no-experimental`) | Same PR | `node scripts/smoke.mjs` covering each flag |
| SC-2 | Cold start delta vs current parser | ms from `npx` to first stdout | baseline current | < +100ms over baseline (median of 5 runs) | Same PR | `hyperfine 'node bin/forgeplan-web.mjs help'` |
| SC-3 | Bundle / tarball size delta | `npm pack` tarball bytes | baseline current | < +10KB (citty is ~6KB ESM) | Same PR | `npm pack --dry-run` size diff |
| SC-4 | Per-subcommand help works | `npx @forgeplan/web init --help` exit 0 with section | not implemented | exit 0, prints flags table | Same PR | Smoke assertion |
| SC-5 | Unknown subcommand fails fast | `npx @forgeplan/web bogus` exit code | currently 1 (custom message) | 1 (citty message includes available commands) | Same PR | Smoke assertion |

---

## Product Scope

### MVP (In-Scope)

- Adopt `citty` (per ADR-003) as the CLI framework. Single new entry in
  root `package.json#dependencies`.
- Split `bin/forgeplan-web.mjs` into:
  - `bin/forgeplan-web.mjs` — 5–10 line entrypoint that imports `runMain`
    from citty + the root command from `bin/cli.mjs`.
  - `bin/cli.mjs` — root command (`defineCommand`) wiring subcommands.
  - `bin/commands/init.mjs`, `bin/commands/update.mjs`,
    `bin/commands/start.mjs`, `bin/commands/help.mjs` — one
    `defineCommand` per file.
  - `bin/lib/` — shared helpers (`config.mjs`, `gitignore.mjs`,
    `forgeplan-binary.mjs`) extracted from current monolith.
- Backwards-compat: every existing flag works with identical semantics.
  Aliases preserved (`upgrade` for `update`; `serve`/`run` for `start`).
- Rule 23 amendment landed in same PR (citty added to allowlist).

### Out of Scope

- Adding new flags (covered by PRD-025 `--scope`, PRD-026 start-resolution,
  PRD-027 instance registry).
- Replacing `commander`/`cac` — alternatives live in RFC-020 trade-off
  table; decision is final per ADR-003.
- Test framework introduction. Smoke remains `scripts/smoke.mjs` (Node
  built-in `node:test` only).
- TypeScript migration of `bin/`. Scope stays ESM `.mjs`.

### Growth Vision

- Citty's prompt support unblocks PRD-025/026 interactive scope picker.
- Per-subcommand split makes future subcommands (e.g. `doctor`, `migrate`)
  cheap to add.

---

## User Journeys

### Journey 1: User runs init for the first time

**Цель**: Scaffold `.forgeplan-web/` into the current project.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | `npx @forgeplan/web init` | Banner + scaffold copied | Existing behavior preserved |
| 2 | `npx @forgeplan/web init --help` | Lists `--force`, `--no-gitignore`, `--experimental`, `-y`, `--quiet` with descriptions | NEW — per-subcommand help |
| 3 | `npx @forgeplan/web init --bogus` | Exits 1, shows "Unknown flag --bogus" + suggestion | NEW — fail-fast on typos |

**Результат**: Scaffold ready; user understands the flag surface.

### Journey 2: Contributor adds a new flag

**Цель**: Extend `init` with `--scope user|project` (PRD-025 follow-up).

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Edits `bin/commands/init.mjs` only | One file diff | vs three-place edit today |
| 2 | Adds `args.scope = { type: 'string', valueHint: 'user\|project' }` | citty type-validates at parse time | Typos rejected at runtime, not silently dropped |
| 3 | Runs `node scripts/smoke.mjs` | All existing flag-parity tests pass | Backwards-compat invariant |

**Результат**: New flag without touching update/start/help.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | User can run `npx @forgeplan/web --help` and see top-level subcommand list with descriptions | Journey 1 |
| FR-002 | Core | Must | User can run `npx @forgeplan/web <subcommand> --help` and see flags for that subcommand | Journey 1 |
| FR-003 | Core | Must | User receives a non-zero exit and a clear message when an unknown subcommand is invoked | Journey 1 |
| FR-004 | Core | Must | User receives a non-zero exit and a clear message when an unknown flag is passed to a known subcommand | Journey 1 |
| FR-005 | Core | Must | All existing flags (`-y`, `--force`, `--quiet`, `--no-gitignore`, `--experimental`, `--no-experimental`) preserve identical observable behavior | Journey 1 |
| FR-006 | Core | Must | All existing subcommand aliases (`upgrade` → `update`; `serve`/`run` → `start`; `-h`/`--help` → `help`) preserve identical behavior | Journey 1 |
| FR-007 | DX | Must | Contributor can add a new flag by editing exactly one file under `bin/commands/` | Journey 2 |
| FR-008 | DX | Should | Contributor can add a new subcommand by adding one file under `bin/commands/` and one line in `bin/cli.mjs` | Journey 2 |
| FR-009 | DX | Should | Each file under `bin/commands/` is under 200 LOC | Journey 2 |
| FR-010 | Compatibility | Must | The published tarball includes `bin/` recursively (current `package.json#files: [bin, dist, ...]` already does so — must keep working) | Journey 1 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | Cold start delta vs current parser shall stay bounded | < +100ms (median of 5 runs) | `node bin/forgeplan-web.mjs help` from cold cache | `hyperfine` |
| NFR-002 | Bundle | Tarball size delta shall stay bounded | < +10KB | `npm pack --dry-run` | bytes diff |
| NFR-003 | Compatibility | Every flag in current help text shall continue to work | 6 of 6 flag-parity tests pass | `node scripts/smoke.mjs` | smoke exit 0 |
| NFR-004 | Zero-dep invariant (rule 23) | `bin/**` shall import only `node:*` and citty (allowlisted) | 0 other third-party imports | grep verification | rule-23 verification snippet |
| NFR-005 | Engines | Node engine support unchanged | `^20.19.0 \|\| >=22.12.0` | `package.json#engines` | review-time check |

---

## Acceptance Criteria

### AC-1: Backwards compatibility — every existing invocation works unchanged

```gherkin
Given the current `bin/forgeplan-web.mjs` is replaced with the citty-based split
When the user runs `npx @forgeplan/web init -y --force --no-gitignore --experimental --quiet`
Then the scaffold is copied with identical observable side effects (.forgeplan-web/, .gitignore, forgeplan-web.json)
And exit code is 0
And `node scripts/smoke.mjs` passes for all 6 flag combinations
```

### AC-2: Per-subcommand help is auto-generated

```gherkin
Given the citty-based split is in place
When the user runs `npx @forgeplan/web update --help`
Then stdout includes a usage line, a description, and a flags table listing `--force`, `--experimental`, `--no-experimental`, `--quiet`
And exit code is 0
```

### AC-3: Unknown flag fails fast

```gherkin
Given the citty-based split is in place
When the user runs `npx @forgeplan/web init --no-gitignor` (typo)
Then exit code is non-zero
And stderr names the unknown flag
And the scaffold is NOT created
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| citty (npm package) | Runtime | Pending — adds to root `package.json#dependencies` | This PRD |
| ADR-003 (rule 23 amendment) | Internal | Drafted in parallel | adr-architect-109 |
| RFC-020 | Internal | This PRD's architecture | docs-eng-109 |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Citty's auto-help text differs subtly from hand-rolled help, breaks user scripts that grep | Low | Low | Smoke test asserts exit codes only, not exact help wording; document the change in CHANGELOG | dev |
| R-2 | Cold-start regression > 100ms breaks NFR-001 | Low | Medium | Citty is tiny (~6KB ESM); benchmark in CI before merge | dev |
| R-3 | Subcommand alias mapping (`upgrade` / `serve` / `run`) lost in split | Medium | Medium | Citty supports `meta.alias` on subcommands; explicit smoke test per alias | dev |
| R-4 | Future esbuild bundling of bin/ (RFC-013 graduation) breaks if citty pulls dynamic imports | Low | Low | Citty is pure ESM static; verify with `node --import bin/forgeplan-web.mjs` | dev |

---

## Affected Files

- `bin/forgeplan-web.mjs` — shrinks to ~10 lines (entry point only)
- `bin/cli.mjs` — NEW, root command definition
- `bin/commands/init.mjs` — NEW, extracted from monolith
- `bin/commands/update.mjs` — NEW, extracted from monolith
- `bin/commands/start.mjs` — NEW, extracted from monolith
- `bin/commands/help.mjs` — NEW or removed (citty auto-generates help)
- `bin/lib/config.mjs` — NEW, shared `readConfig` / `readPkgVersion`
- `bin/lib/gitignore.mjs` — NEW, shared `ensureGitignore`
- `bin/lib/forgeplan-binary.mjs` — NEW, shared `ensureForgeplanBinary` / `ensureForgeplanWorkspace`
- `bin/banner.mjs` — unchanged sibling
- `package.json` — add `citty` to `dependencies`
- `.claude/rules/23-bin-zero-deps.md` — amendment landed via ADR-003
- `scripts/smoke.mjs` — flag-parity assertions
- GitHub sub-issue: #110 (109a)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| RFC-020 | Architecture | Draft (parallel) |
| ADR-003 | Decision (rule 23 amendment) | Proposed (parallel) |
| PRD-025 | Depends on this PRD (consumes the new flag plumbing) | Draft |
| PRD-026 | Depends on this PRD | Draft |
| GitHub #110 | Source sub-issue | Open |
| GitHub #109 | Parent issue | Open |

---

> **Next step**: Wait for ADR-003 finalization → land RFC-020 alongside this PRD → implement in Wave 5.



