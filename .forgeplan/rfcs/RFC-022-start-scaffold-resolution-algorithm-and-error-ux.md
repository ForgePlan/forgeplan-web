---
depth: standard
id: RFC-022
kind: rfc
links:
- target: PRD-026
  relation: based_on
status: active
title: start scaffold-resolution algorithm and error UX
---

---
id: RFC-022
title: "start scaffold-resolution algorithm and error UX"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
prd: PRD-026
depth: standard
---

# RFC-022: start scaffold-resolution algorithm and error UX

## Summary

Specify the algorithm `bin/commands/start.mjs` uses to find the right
`.forgeplan-web/` scaffold given (cwd, optional `--scope`, optional
`-y`, TTY presence). Define the empty-state UX: prompt-to-init on TTY,
clear error on non-TTY.

## Motivation

PRD-026 needs a deterministic, testable algorithm for resolution. A
spec-as-RFC is the cheapest way to lock the order, the override
semantics, and the empty-state behavior before code. Without explicit
spec the implementation will drift from PRD-026's invariants and the
backwards-compat guarantee for project-scope users will erode under
future patches.

## Goals

- One pseudocode procedure with named branches for testability.
- Project scope probed BEFORE user scope (zero-config preservation).
- Empty-state UX uniform with `init`'s prompt (same citty primitives).
- Symlink + JSON-parse guards as a safety net.

## Non-Goals

- Walk-up parent search.
- Mid-session scope switching.
- Forwarding additional flags to spawned `node index.js` (already done
  via env in current code; unchanged).

## Options Considered

### Option A: Project → User → Prompt-init (CHOSEN)

**Description**: Probe project-scope first. If absent, probe user-scope.
If both absent, prompt to init (TTY) or error (non-TTY).

```
resolveScaffold({ cwd, explicitScope, yesFlag, isTTY }):
  if explicitScope === 'project':
    return projectAt(cwd) or fail("--scope project: no scaffold at <cwd>")
  if explicitScope === 'user':
    return userAt() or fail("--scope user: no scaffold at ~/.forgeplan-web/")
  // implicit: try chain
  let p = projectAt(cwd)
  if p: return p
  let u = userAt()
  if u: return u
  // empty state
  if isTTY and !yesFlag:
    return promptInitInline()
  fail("no scaffold; run `npx @forgeplan/web init [--scope user|project]`")
```

**Pros**:
- Preserves project-scope user behavior (project wins).
- Discoverable: when project is missing, user-scope is tried before
  failing.
- Symmetrical with `init` defaults.

**Cons**:
- Two probes per `start` invocation (negligible).
- Possible surprise if user has both scopes installed (project wins
  unexpectedly); mitigated by stdout log.

### Option B: User → Project → Prompt-init

**Description**: Reverse order. User-scope first.

**Pros**:
- Aligns with the new "user-scope is default" direction.

**Cons**:
- Breaks project-scope users who run `start` from a project — would
  pick `~/.forgeplan-web/` over the project's. Unacceptable per
  PRD-026 NFR-002.

### Option C: Walk-up parent search

**Description**: If `<cwd>/.forgeplan-web/` absent, walk up to parent
dirs looking for one (like git does for `.git/`).

**Pros**:
- Handles "ran from a subdir of the project" case.

**Cons**:
- Out of scope per #109.
- Requires bounding (where to stop?).
- Risk of picking up an unrelated scaffold from a parent project.

### Option D: Always prompt for scope

**Description**: Don't probe; always ask user to pick scope at start.

**Pros**:
- Explicit.

**Cons**:
- Massive UX regression (every start needs a click).
- Breaks scripts.

## Trade-off Analysis

| Критерий | A: project→user (chosen) | B: user→project | C: walk-up | D: always-prompt |
|----------|--------------------------|------------------|-----------|-----------------|
| Backwards compat | High | Broken | High | Broken |
| Discoverability | Good (logs scope) | Confusing | Good | Bad |
| Implementation cost | Low | Low | Medium | Low |
| CI compatibility | Good | Good | Good | Broken |
| Surprise factor | Low | High | Medium | High |

## Proposed Direction

**Option A** as specified above. Implementation in
`bin/commands/start.mjs`:

```js
import { defineCommand } from 'citty';
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { resolveUserScopeRoot, resolveProjectScopeRoot } from '../lib/scope.mjs';
import { readConfig } from '../lib/config.mjs';

const SCAFFOLD_ENTRY = 'index.js';
const ENV_OVERRIDE = 'FORGEPLAN_WEB_SCAFFOLD';

function probe(root) {
  if (!existsSync(root)) return null;
  if (lstatSync(root).isSymbolicLink()) return null; // safety
  const entry = join(root, SCAFFOLD_ENTRY);
  if (!existsSync(entry)) return null;
  return root;
}

function resolveScaffold({ cwd, explicitScope, yesFlag, isTTY }) {
  // Highest priority: explicit env override (escape hatch)
  if (process.env[ENV_OVERRIDE]) {
    return { scope: 'env', root: process.env[ENV_OVERRIDE] };
  }
  if (explicitScope === 'project') {
    const r = probe(resolveProjectScopeRoot(cwd));
    if (!r) throw new Error(`--scope project: no scaffold at ${resolveProjectScopeRoot(cwd)}`);
    return { scope: 'project', root: r };
  }
  if (explicitScope === 'user') {
    const r = probe(resolveUserScopeRoot());
    if (!r) throw new Error(`--scope user: no scaffold at ${resolveUserScopeRoot()}`);
    return { scope: 'user', root: r };
  }
  // implicit chain: project → user → prompt
  let r = probe(resolveProjectScopeRoot(cwd));
  if (r) return { scope: 'project', root: r };
  r = probe(resolveUserScopeRoot());
  if (r) return { scope: 'user', root: r };
  return null; // empty state
}
```

Empty-state UX (when `resolveScaffold` returns null):

```js
async function handleEmpty({ isTTY, yesFlag }) {
  if (!isTTY || yesFlag) {
    throw new Error(
      'no scaffold found in project (./.forgeplan-web/) or user (~/.forgeplan-web/) scope.\n' +
      '   run `npx @forgeplan/web init [--scope user|project]` first.'
    );
  }
  const { prompt } = await import('citty');
  const yes = await prompt('No scaffold found. Install now?', {
    type: 'confirm',
    initial: true,
  });
  if (!yes) process.exit(1);
  // re-enter init flow inline (call into bin/commands/init.mjs's run)
  ...
}
```

`forgeplan-web.json` is read AFTER resolution (we know the root). Its
`scope` field is informational; we trust the path we resolved.

## Risks & Open Questions

- **R-1: Symlink probe.** `existsSync` follows symlinks; `lstatSync`
  doesn't. We refuse symlinks for the scaffold dir because RFC
  precedent (rule 21, update's CWE-59 guard).
- **R-2: Race condition between probe and spawn.** Negligible — user
  process. If scaffold is deleted between probe and spawn, Node will
  surface a clear error.
- **R-3: ENV override visibility.** `FORGEPLAN_WEB_SCAFFOLD` could
  surprise users. Keep it documented in `--help start` output.
- **R-4: Inline init from start.** Tests must cover the case where
  inline init prompts for scope mid-session; ensure no double-prompt.
- **OQ-1**: Should `start` respect the `forgeplan-web.json#scope` field
  to pick a non-default order? No — the resolved root *is* the truth;
  scope-field is just metadata.

## Implementation Phases

### Phase 1: Pure resolver

- [ ] **1.1** Implement `resolveScaffold()` in
  `bin/lib/start-resolver.mjs` (or fold into `bin/lib/scope.mjs`).
- [ ] **1.2** Unit test all branches: explicit project hit, explicit
  project miss, explicit user hit, explicit user miss, implicit
  project hit, implicit user hit, implicit none.

### Phase 2: Wire into start

- [ ] **2.1** `bin/commands/start.mjs` consumes resolver; spawns
  `node <root>/index.js`.
- [ ] **2.2** Add `--scope` arg via citty.
- [ ] **2.3** Print "→ scope: <s> (<root>)" line.

### Phase 3: Empty-state UX

- [ ] **3.1** Non-TTY / `-y` path: throw clear error with
  init-flag hint.
- [ ] **3.2** TTY path: prompt-to-init confirm + scope select; reuse
  init's flow.

### Phase 4: Smoke matrix

- [ ] **4.1** Smoke: project-only, user-only, both, neither, env-
  override.
- [ ] **4.2** CI Windows: identical assertions.

## Affected Files

- `bin/commands/start.mjs`
- `bin/lib/scope.mjs` (or `bin/lib/start-resolver.mjs`)
- `scripts/test/start-resolver.test.mjs` (NEW)
- `scripts/smoke.mjs`

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-026 | PRD | based_on |
| RFC-021 | RFC | informs (consumes resolver) |
| PRD-025 | PRD | informs (scope flag) |
| PRD-027 | PRD | informs (registry stale-sweep on start) |
| GitHub #112 | Issue | implements |

---

> **Next step**: Land alongside PRD-026. PRD-027's registry hook fires inside `start` after resolution.



