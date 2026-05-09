---
depth: standard
id: RFC-021
kind: rfc
links:
- target: PRD-025
  relation: based_on
status: active
title: Scope resolver and user-scope path conventions for init
---

---
id: RFC-021
title: "Scope resolver and user-scope path conventions for init"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
prd: PRD-025
depth: standard
---

# RFC-021: Scope resolver and user-scope path conventions for init

## Summary

Introduce `bin/lib/scope.mjs` — pure resolver functions that map scope
intent (`user` | `project`) to absolute filesystem paths, plus a
`promptScope()` helper that wraps citty's prompt API. Lock the user-scope
path to `~/.forgeplan-web/` (no XDG, no per-OS variants in MVP) per
ADR-004.

## Motivation

PRD-025 introduces `--scope user|project` for `init`. The next step
(PRD-026 / RFC-022) builds a start-resolution chain that probes both
scopes. A shared resolver module avoids two divergent path computations
and gives PRD-027's registry helper a single source of truth for "where
does the user-scope live?".

If we don't extract a helper: scope path is hard-coded inline in
`bin/commands/init.mjs` (PRD-025) and re-derived in `bin/commands/start.mjs`
(PRD-026) and `bin/lib/registry.mjs` (PRD-027). Three drift surfaces.

## Goals

- Single home for scope-path resolution: `bin/lib/scope.mjs`.
- Lock user-scope path to `~/.forgeplan-web/` (ADR-004 invariant).
- Provide `promptScope()` that returns `'user' | 'project'` from arrow-
  key TTY prompt, with non-TTY fall-through error.
- Persist resolved scope into `forgeplan-web.json` so downstream
  (`update`, `start`) can read it back.

## Non-Goals

- XDG_CONFIG_HOME compliance.
- Per-OS conventional paths (`%APPDATA%`, `~/Library/Application Support/`).
- Custom scope paths (e.g. `--scope /tmp/sandbox`).
- Migration tooling.

## Options Considered

### Option A: `~/.forgeplan-web/` (CHOSEN per ADR-004)

**Description**: User-scope root = `path.join(os.homedir(), '.forgeplan-web')`.
Cross-platform via Node's `os.homedir()`. Cross-tool consistency: every
language's stdlib has the same primitive.

**Pros**:
- Trivial implementation; one helper line.
- Works identically on macOS, Linux, Windows (tested in PRD-025 NFR-004).
- Visible to users (dotfile in `~/`).
- Co-locates with `instances.json` (ADR-004) — both live under the same
  root.

**Cons**:
- Not technically XDG-compliant on Linux (XDG_CONFIG_HOME would put it
  under `~/.config/forgeplan-web/`).
- Pollutes the home directory root with one more dotfile.

### Option B: XDG_CONFIG_HOME

**Description**: Honor `XDG_CONFIG_HOME` env (default `~/.config/`) on
Linux/macOS; fall back to `~/.forgeplan-web/` on Windows or when env
unset.

**Pros**:
- Aligns with Linux desktop conventions.
- Polite citizen on systems with `~/.config/` already in use.

**Cons**:
- Per-OS branching = more code paths to test.
- macOS users typically don't set `XDG_CONFIG_HOME`; behavior would be
  identical to Option A for ~80% of users while adding a Linux-specific
  fork.
- ADR-004 explicitly punts XDG to a future major version.

### Option C: Per-OS conventional paths

**Description**: macOS: `~/Library/Application Support/forgeplan-web/`;
Linux: `~/.config/forgeplan-web/`; Windows: `%APPDATA%/forgeplan-web/`.

**Pros**:
- Most "native" feel per OS.

**Cons**:
- Three distinct codepaths.
- Migration story is harder if a user moves between OSes.
- Forgeplan-web is a developer tool, not a desktop app; native paths
  are overkill.

## Trade-off Analysis

| Критерий | A: ~/.forgeplan-web/ (chosen) | B: XDG | C: per-OS |
|----------|-------------------------------|--------|-----------|
| Implementation complexity | Lowest | Medium | High |
| Cross-platform parity | High (single path) | Medium (Linux fork) | Low (3 forks) |
| Discoverability | Visible dotfile | Hidden in `.config/` | Buried in OS dirs |
| Migration risk (future XDG) | Easy (read-old, write-new) | n/a | Hard |
| Co-location with `instances.json` | Same root | Same root | Same root |
| Operational burden | Lowest | Medium | High |

## Proposed Direction

**Option A — `~/.forgeplan-web/`.** Locked by ADR-004. Module shape:

```js
// bin/lib/scope.mjs
import os from 'node:os';
import path from 'node:path';

export const USER_SCOPE_DIRNAME = '.forgeplan-web';

export function resolveUserScopeRoot() {
  return path.join(os.homedir(), USER_SCOPE_DIRNAME);
}

export function resolveProjectScopeRoot(cwd) {
  return path.join(cwd, USER_SCOPE_DIRNAME);
}

export function resolveScopeRoot(scope, cwd) {
  if (scope === 'user') return resolveUserScopeRoot();
  if (scope === 'project') return resolveProjectScopeRoot(cwd);
  throw new Error(`unknown scope: ${scope}`);
}

// Returns 'user' | 'project'. Throws on non-TTY.
export async function promptScope({ defaultScope = 'user' } = {}) {
  if (!process.stdin.isTTY) {
    throw new Error('no TTY; pass --scope user|project explicitly');
  }
  const { prompt } = await import('citty');
  return prompt('Where to install?', {
    type: 'select',
    options: [
      { label: `user    (${resolveUserScopeRoot()})`, value: 'user' },
      { label: `project (${resolveProjectScopeRoot(process.cwd())})`, value: 'project' },
    ],
    initial: defaultScope,
  });
}
```

`forgeplan-web.json` schema bump:

```json
{
  "workspaceRoot": "/Users/.../forgeplan-web",
  "createdAt": "2026-05-08T...",
  "updatedAt": "2026-05-08T...",
  "version": "0.1.14",
  "experimental": false,
  "scope": "user"   // NEW — "user" | "project"
}
```

Reader code (in `bin/lib/config.mjs`) treats absent `scope` as
`"project"` for back-compat with already-written configs.

## Risks & Open Questions

- **R-1: `os.homedir()` on Windows when running under a non-standard
  shell** (Git Bash, MSYS2). Should resolve to `C:\Users\<name>` on all
  three; Node has historically been reliable here. Smoke test asserts.
- **R-2: Symlinked home dir** (some corporate setups symlink `~`).
  `os.homedir()` returns the symlink target string; we don't follow,
  we just use it. Either way the path is stable per user.
- **R-3: Long-path Windows users** (`MAX_PATH 260` legacy). Path is
  ~30 chars + user name + filenames; well under 260.
- **OQ-1**: Should we accept `~/.forgeplanweb/` (no dash) as an alias?
  No — single canonical name avoids confusion.
- **OQ-2**: Should `promptScope()` live in `scope.mjs` or its own file?
  Keep in `scope.mjs` — it's a thin wrapper, splitting adds churn.

## Implementation Phases

### Phase 1: Pure resolver helpers (no behavior change)

- [ ] **1.1** Create `bin/lib/scope.mjs` with `resolveUserScopeRoot`,
  `resolveProjectScopeRoot`, `resolveScopeRoot`.
- [ ] **1.2** Unit-cover via `node:test` in
  `scripts/test/scope.test.mjs`: macOS path, Linux path, Windows path
  (mocked via `os.homedir` stub).

### Phase 2: Wire into `init`

- [ ] **2.1** `bin/commands/init.mjs` consumes `resolveScopeRoot`
  instead of inline `path.join(cwd, '.forgeplan-web')`.
- [ ] **2.2** Add `--scope` arg via citty.
- [ ] **2.3** `forgeplan-web.json` writer adds `scope` field.

### Phase 3: Prompt fallback

- [ ] **3.1** `promptScope()` exported from `scope.mjs`.
- [ ] **3.2** `init.mjs` calls `promptScope()` when scope unset, TTY
  open, and `-y` not passed.
- [ ] **3.3** Non-TTY fall-through: emit FR-009 error.

### Phase 4: Smoke + matrix

- [ ] **4.1** Smoke: assert `init --scope user` writes to
  `~/.forgeplan-web/`.
- [ ] **4.2** Smoke: assert `init -y` (no `--scope`) writes to
  `./.forgeplan-web/`.
- [ ] **4.3** CI Windows matrix: assert path resolution matches
  expected `os.homedir()` value.

## Affected Files

- `bin/lib/scope.mjs` (NEW)
- `bin/lib/config.mjs` — `scope` field reader/writer
- `bin/commands/init.mjs` — consumes resolver
- `scripts/test/scope.test.mjs` (NEW)
- `scripts/smoke.mjs` — scope assertions

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-025 | PRD | based_on |
| ADR-004 | ADR | decided_by (locks user-scope path) |
| PRD-024 | PRD | informs (citty + bin split prerequisite) |
| RFC-022 | RFC | informs (start-resolution consumes resolver) |
| RFC-023 | RFC | informs (registry consumes resolver) |
| GitHub #111 | Issue | implements |

---

> **Next step**: Land alongside PRD-025. PRD-026 (RFC-022) consumes `resolveScopeRoot`.



