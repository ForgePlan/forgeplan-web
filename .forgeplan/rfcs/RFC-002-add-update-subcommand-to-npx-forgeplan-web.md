---
depth: standard
id: RFC-002
kind: rfc
status: active
title: add update subcommand to npx @forgeplan/web
---

# RFC-002: add `update` subcommand to npx @forgeplan/web

## Summary

Add `npx @forgeplan/web update` — refresh the scaffolded `.forgeplan-web/`
to the version bundled in the currently-resolved `@forgeplan/web` package,
preserving the workspace pointer written by `init`.

## Motivation

Today `init` is the only way to lay down `.forgeplan-web/`. It uses
`cpSync` with `force: false, errorOnExist: false` when the target already
exists, so files that exist are *kept* — meaning a user who upgrades the
npm package and re-runs `init` does NOT actually pick up the new server,
client bundle, or shipped runtime deps. Their only recourse is `init
--force`, which is a sledgehammer that overwrites without telling them
which version they're on or what's changing.

There's no reliable way for a user to answer: "is my `.forgeplan-web/`
current?" or "did the last `npm i -g @forgeplan/web@latest` actually
take effect?". We need a first-class refresh path with version visibility.

## Goals

- One-shot upgrade: `npx @forgeplan/web update` makes `.forgeplan-web/`
  match the bundled `dist/` exactly (additions, modifications, removals).
- Version visibility: print `from X → to Y` (the bundled package version,
  read from the `@forgeplan/web` package.json that owns the running bin).
- Idempotent: running `update` when already current is a no-op (still
  exits 0; no diff printed beyond a "already at vX" line) unless `--force`.
- Preserve `forgeplan-web.json#workspaceRoot` and `createdAt`; bump a new
  `version` and `updatedAt` field.
- Stay zero-dep (rule 23) and host-isolated (rule 20: only writes inside
  `.forgeplan-web/`; never touches the host `package.json` or
  `.gitignore`).

## Non-Goals

- Self-updating the npm package itself. Users keep using their package
  manager (`npm i -g @forgeplan/web@latest`, or `npx @forgeplan/web@latest
  update`). We just refresh the *scaffold* from whatever bin is running.
- Migrating user data. `.forgeplan-web/` is generated; there is no user
  data inside it. The workspace pointer is the only thing we preserve.
- Changing `init` semantics. `init` continues to be "create if absent,
  skip existing files" so people running it twice don't get surprise
  overwrites. `update` is the explicit refresh.

## Options Considered

### Option A: `update` = `rm -rf .forgeplan-web/ && init --force` shortcut

**Description**: Trivial implementation — alias to existing init code path.

**Pros**: ~5 lines of code; reuses tested logic.

**Cons**: Loses `forgeplan-web.json#createdAt`; no version diffing; can't
distinguish "already current" from "successfully upgraded"; doesn't write
`updatedAt`. Worst: it would re-run the `.gitignore` append logic, which
is `init`'s concern, not refresh's.

### Option B: dedicated `update()` that snapshots config, wipes, re-copies, re-writes config

**Description**: Read `forgeplan-web.json` first → record `workspaceRoot`,
`createdAt`. Read bundled package version from `<PKG_ROOT>/package.json`.
Read installed version from `forgeplan-web.json#version` (fallback: treat
as unknown). `rm -rf .forgeplan-web/` then `cpSync(dist, target, { force:
true })`. Re-write `forgeplan-web.json` with preserved fields + new
`version` + `updatedAt`. Skip `.gitignore`.

**Pros**: Clean removal of stale files; full version visibility;
preserves provenance; doesn't touch host `.gitignore`. Behaviour matches
the user's mental model of "refresh".

**Cons**: Slightly more code (~40 lines). Has to read the bin's own
`package.json` to know the bundled version — but `PKG_ROOT` is already
computed in the script, so this is a one-liner.

### Option C: in-place `cpSync(dist, target, { force: true })` without wipe

**Description**: Just overwrite, no rm. Cheaper.

**Pros**: One fewer syscall.

**Cons**: Stale files from the old `dist/` (e.g. files renamed/removed in
a new build) linger forever inside `.forgeplan-web/`. This is exactly
why `update` exists — Option C silently fails the headline goal.

## Trade-off Analysis

| Criterion | Option A | Option B | Option C |
|---|---|---|---|
| Cleans stale files | yes (init --force does) | yes (explicit rm) | **no** |
| Preserves `createdAt` | no | yes | yes |
| Version diff visible | no | yes | no |
| Touches `.gitignore` | yes (bug) | no (correct) | no |
| Code added | ~5 LOC | ~40 LOC | ~10 LOC |
| Matches user mental model | partial | yes | partial |

## Proposed Direction

**Option B.** It's the only one that satisfies all goals. The extra ~30
lines buy provenance (`createdAt`/`updatedAt`/`version` in
`forgeplan-web.json`), correct stale-file removal, and host isolation
(no `.gitignore` recursion).

Also: backfill the `version` field in `init()` so that the *first*
`update` after this ships has a baseline to diff against. Without that,
the first post-upgrade `update` reports `from unknown → to X`, which is
acceptable but ugly.

## Risks & Open Questions

- **Risk:** user has manually edited a file inside `.forgeplan-web/` (e.g.
  patched a server route). `update` will silently overwrite it. Mitigation:
  the rules already declare `.forgeplan-web/` to be generated, and it's
  in `.gitignore`. We document the overwrite behaviour in `--help`.
- **Risk:** `PKG_ROOT/package.json` not found at runtime (tarball corruption).
  Mitigation: fall back to `dist/forgeplan-web-build.json#builtAt` for
  diagnostics; never crash the refresh just because we can't print a version.
- **Open question:** should `update` also re-run `ensureForgeplanBinary()`
  / `ensureForgeplanWorkspace()` checks? **Yes** — same preconditions as
  `init`; refusing to refresh into a host that no longer has `.forgeplan/`
  is correct behaviour and surfaces drift early.
- **Open question:** flag for downgrade protection? Not in v1. The bundled
  version is whatever the user invoked; downgrade is a user choice
  (`npx @forgeplan/web@0.1.0 update`).

## Implementation Phases

### Phase 1: `update()` function + dispatcher wiring

- [ ] **1.1** Read bundled package version from `<PKG_ROOT>/package.json`.
- [ ] **1.2** Add `readPkgVersion()` helper (zero-dep, sync `readFileSync`).
- [ ] **1.3** Backfill `version` write in existing `init()` so future
  updates can diff.
- [ ] **1.4** Implement `update()`: snapshot config, wipe, copy, restore
  config + version + `updatedAt`.
- [ ] **1.5** Wire `case 'update':` into the dispatcher; reject unknown
  flags except `--force` / `-q` / `--quiet`.
- [ ] **1.6** Update `help()` text.

### Phase 2: docs + smoke

- [ ] **2.1** README: add `update` to usage block; document overwrite
  behaviour.
- [ ] **2.2** Smoke test against a scratch dir: init → mutate a dist
  file → update → assert restored + `forgeplan-web.json#version` written.
- [ ] **2.3** Evidence pack with structured fields, link to RFC, score.

## Affected Files

- `bin/forgeplan-web.mjs`
- `README.md`

## Related Artifacts

| Artifact | Type | Relation |
|---|---|---|
| RFC-001 | RFC | informs (sibling — pre-built artifact shipping) |
| ADR-001 | ADR | informs (host-isolation rule applies to `update` too) |
| EVID-004 | Evidence | proves (smoke test, this RFC) |

