---
depth: standard
id: RFC-020
kind: rfc
links:
- target: PRD-024
  relation: based_on
status: draft
title: citty integration architecture — bin/ subcommand split
---

---
id: RFC-020
title: "citty integration architecture — bin/ subcommand split"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
prd: PRD-024
depth: standard
---

# RFC-020: citty integration architecture — bin/ subcommand split

## Summary

Adopt `citty` (per ADR-003) as the CLI framework for `bin/` and split the
current 367-line monolith into a 5-line entrypoint plus per-subcommand
files under `bin/commands/` and shared helpers under `bin/lib/`.

## Motivation

Per PRD-024: the hand-rolled argv parser is brittle, lacks per-subcommand
help, silently drops typos, and offers no prompt hook (which #111 needs
for the scope picker). Continuing to extend it for the six new flags
across PRD-024..029 would push the monolith past 600 LOC and triple the
edge cases. Picking the CLI framework now (and locking it in ADR-003)
unblocks Waves 5–8 of the #109 plan.

If we do nothing: every new flag adds 3 edits in `bin/forgeplan-web.mjs`,
the help text drifts from reality, and the prompt-driven scope flow in
#111 either ships hand-rolled (≈80 LOC of stdin/stdout dance) or blocks.

## Goals

- Replace the argv-Set parser with citty's `defineCommand` while keeping
  zero-dep surface (rule 23 amended).
- Split per-subcommand logic into one file each under `bin/commands/`.
- Preserve every observable behavior of every existing flag (PRD-024 SC-1).
- Keep cold start delta < 100ms (PRD-024 NFR-001).
- Provide a prompt hook (`citty` exposes `consola.prompt`) for #111.

## Non-Goals

- Migrating the CLI to TypeScript.
- Adopting a richer test framework — smoke stays Node `node:test` only.
- Bundling `bin/` with esbuild (orthogonal to RFC-013 graduation).
- Replacing `bin/banner.mjs` (still a hand-rolled ANSI block).

## Options Considered

### Option A: Keep hand-rolled parser

**Description**: Continue with the current `Set`-based parser; add new
flags by extending `flags.has(...)` calls. Manually wire `--help <sub>`
and unknown-flag rejection.

**Pros**:
- Zero new dependencies.
- Already known to work.

**Cons**:
- Adds maintenance debt with every new flag (PRD-024..029 add ≥6 flags).
- No structured prompt support — #111 must hand-roll stdin reader.
- `--help <subcommand>` requires bespoke routing.
- Typo handling stays silent; can't reject unknown flags without
  per-subcommand allow-lists.

### Option B: citty (CHOSEN per ADR-003)

**Description**: Adopt `unjs/citty` — zero-dep ESM-only CLI framework.
Each subcommand is a `defineCommand({ meta, args, run })` exported from
its own file. Root command in `bin/cli.mjs` lists subcommands; entry
shrinks to `import { runMain } from "citty"; import { main } from
"./cli.mjs"; runMain(main)`.

**Pros**:
- Zero transitive deps, pure ESM, ≈6KB.
- Built-in `--help`, type-validated args, prompt support via `consola`.
- Already used in the unjs ecosystem (consola, unbuild, nuxi) — battle-
  tested at scale.
- Subcommand aliasing (`alias: ["upgrade"]`) one-liner.

**Cons**:
- New runtime dep — invalidates rule 23's "zero-dep" claim. Mitigated by
  ADR-003 explicit allowlist amendment.
- Auto-help wording differs slightly from current text — minor user-
  visible churn (smoke test asserts behavior, not wording).

### Option C: commander

**Description**: TJ Holowaychuk's classic CLI framework.

**Pros**:
- Mature, ubiquitous, deep stack-overflow corpus.

**Cons**:
- ≈30KB and pulls a few transitive deps (`@tootallnate/once`, etc. via
  newer versions). Bigger tarball delta than citty.
- CommonJS-first; ESM is bolted on. Aligns poorly with our pure-ESM
  `.mjs` files.
- API surface is larger than what we need; encourages monolithic configs.

### Option D: cac

**Description**: Cuk Wong's small CLI framework.

**Pros**:
- Small (~7KB), ESM-friendly.
- Familiar `program.command(...)` API.

**Cons**:
- Single-maintainer; less active than citty (last release older as of
  2026-05).
- Prompt support is third-party (not built-in); we'd need to add
  another dep for #111.
- Type validation is weaker than citty.

## Trade-off Analysis

| Критерий | A: hand-rolled | B: citty (chosen) | C: commander | D: cac |
|----------|----------------|-------------------|--------------|--------|
| Complexity (initial) | Lowest (already there) | Low | Medium | Low |
| Complexity (per future flag) | High | Low | Low | Low |
| Cold-start cost | Baseline | +~5ms | +~30ms | +~5ms |
| Tarball delta | 0 | +~6KB | +~30KB | +~7KB |
| Migration risk | None (status quo) | Low (clean cut) | Medium (CJS interop) | Low |
| Developer experience | Poor | Good | Good | Good |
| Prompt support (for #111) | DIY | Built-in (`consola.prompt`) | Third-party | Third-party |
| Operational burden | High (drifts) | Low | Low | Medium (less mature) |
| Zero-dep invariant (rule 23) | Preserved | Amended (ADR-003) | Amended | Amended |

## Proposed Direction

**Option B — citty.** Locked by ADR-003 (which amends rule 23 to allow
exactly `citty` in `bin/`). Architecture:

```
bin/
├── forgeplan-web.mjs      # 5–10 lines: import { runMain } from "citty"
│                          # import { main } from "./cli.mjs"
│                          # runMain(main)
├── cli.mjs                # defineCommand({ meta, subCommands: { init, update, start } })
├── banner.mjs             # unchanged
├── commands/
│   ├── init.mjs           # defineCommand — owns init args + run
│   ├── update.mjs         # defineCommand — owns update args + run
│   └── start.mjs          # defineCommand — owns start args + run
└── lib/
    ├── config.mjs         # readConfig, readPkgVersion, readWorkspaceRoot
    ├── gitignore.mjs      # ensureGitignore
    └── forgeplan-binary.mjs  # ensureForgeplanBinary, ensureForgeplanWorkspace
```

Each `bin/commands/<name>.mjs` exports a default `defineCommand` with:
- `meta: { name, description }`
- `args: { ... }` — typed flag definitions (string / boolean)
- `run({ args }) { ... }` — same logic as today, called with parsed args

Aliases:
- `update`: `meta.alias = ["upgrade"]`
- `start`: `meta.alias = ["serve", "run"]`

`run` functions stay synchronous wherever the current code is sync;
citty supports both. Help is auto-generated; we delete the bespoke
`help()` function.

## Risks & Open Questions

- **R-1: Citty's exit-code convention.** Citty exits 1 by default on
  unknown flag; we must verify it matches the hook expectations
  (`forge-safety-hook.sh`). Smoke test will exercise this.
- **R-2: Windows shell wrapping.** When `forgeplan-web.mjs` is shipped
  via npm, npm wraps it in `forgeplan-web.cmd` on Windows. Citty's
  `runMain` works with `process.argv.slice(2)` regardless; verify on
  CI Windows job.
- **R-3: ESM-only.** Citty is `"type": "module"` — fine since our entry
  is `.mjs`. No interop work.
- **R-4: Prompt SSR-safety.** `consola.prompt` reads from `process.stdin`.
  Behavior in non-TTY contexts (CI) must fall back to default (used by
  PRD-025's `--scope` flag — when prompt unavailable, fail with clear
  message instructing `--scope` flag).
- **OQ-1**: Should we expose citty's `defineCommand` to plugin authors
  later? Out of scope for now; punt to a future RFC if needed.
- **OQ-2**: Should `bin/lib/` be a separate "package" (with `package.json`)
  for type clarity? No — keeping it as bare `.mjs` files preserves the
  zero-resolution invariant (rule 23 verification snippet still grep-able).

## Implementation Phases

### Phase 1: Scaffold + helpers extraction (no behavior change)

- [ ] **1.1** Add `citty` to root `package.json#dependencies`.
- [ ] **1.2** Create `bin/lib/config.mjs`, `bin/lib/gitignore.mjs`,
  `bin/lib/forgeplan-binary.mjs` by extracting helpers from
  `bin/forgeplan-web.mjs` verbatim. No logic change.
- [ ] **1.3** Update rule 23 verification snippet to allow `citty` and
  `./lib/*.mjs` relative imports.

### Phase 2: Wire citty (init only)

- [ ] **2.1** Create `bin/commands/init.mjs` — port `init()` to
  `defineCommand`. Map current flags 1:1.
- [ ] **2.2** Create `bin/cli.mjs` — root command, registers `init` only.
- [ ] **2.3** Replace `bin/forgeplan-web.mjs` body with `runMain` entry.
  Keep old monolith logic for `update`/`start` via fall-through to
  legacy switch.
- [ ] **2.4** Smoke: assert `init -y --force --no-gitignore` still
  produces identical filesystem state.

### Phase 3: Port update + start, retire legacy switch

- [ ] **3.1** Create `bin/commands/update.mjs` (with `alias: ["upgrade"]`).
- [ ] **3.2** Create `bin/commands/start.mjs` (with `alias: ["serve",
  "run"]`).
- [ ] **3.3** Delete the legacy `switch (cmd)` block from
  `bin/forgeplan-web.mjs`; entry shrinks to 5–10 lines.
- [ ] **3.4** Delete `help()` function — citty auto-generates.

### Phase 4: Smoke + benchmark

- [ ] **4.1** Add `scripts/smoke.mjs` flag-parity assertions for all 6
  flags + 3 aliases.
- [ ] **4.2** Run `hyperfine` cold-start benchmark; assert delta < 100ms
  vs baseline. If exceeded, profile and optimize import order.
- [ ] **4.3** `npm pack --dry-run` size check; assert delta < 10KB.

## Affected Files

- `bin/forgeplan-web.mjs` (shrunk)
- `bin/cli.mjs` (NEW)
- `bin/commands/init.mjs` (NEW)
- `bin/commands/update.mjs` (NEW)
- `bin/commands/start.mjs` (NEW)
- `bin/lib/config.mjs` (NEW)
- `bin/lib/gitignore.mjs` (NEW)
- `bin/lib/forgeplan-binary.mjs` (NEW)
- `package.json` — `dependencies.citty`
- `.claude/rules/23-bin-zero-deps.md` — amendment from ADR-003
- `scripts/smoke.mjs` — assertions

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-024 | PRD | based_on |
| ADR-003 | ADR | decided_by |
| PRD-025 | PRD | informs (consumes prompt support) |
| PRD-026 | PRD | informs (consumes prompt support) |
| GitHub #110 | Issue | implements |

---

> **Next step**: Land alongside PRD-024 + ADR-003. Phase order is strict; do not skip Phase 1's helper extraction.

