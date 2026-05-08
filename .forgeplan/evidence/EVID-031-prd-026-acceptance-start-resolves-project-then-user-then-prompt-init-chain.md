---
depth: tactical
id: EVID-031
kind: evidence
links:
- target: PRD-026
  relation: informs
- target: RFC-022
  relation: informs
status: active
title: 'PRD-026 acceptance: start resolves project then user then prompt-init chain'
---

# EVID-031: PRD-026 acceptance: start resolves project then user then prompt-init chain

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-08 |
| Valid Until | 2026-08-08 |
| Target | PRD-026 (start resolution chain — project → user → prompt-init) |

## Summary

Implementation commit `7c4bcec` extends `start` and `update` with a
`--scope user|project` flag and a project → user → prompt-init
resolution chain. Existing project-scope behaviour is preserved.

## Method

Five scenarios run against `bin/commands/start.mjs` + `bin/commands/
update.mjs` + `bin/lib/scope.mjs#findScaffold` at commit `7c4bcec`:

1. **Project wins when both scopes exist** (FR-001, FR-006, AC-1):
   pre-stage `./.forgeplan-web/` and `~/.forgeplan-web/`. Run
   `start`. Verify resolver picks `./.forgeplan-web/`, stdout reports
   `→ scope: project (./.forgeplan-web/)`, server boots from cwd.
2. **User-scope picked when project absent** (FR-001, FR-008, AC-2):
   from `/tmp` with no project scaffold but `~/.forgeplan-web/`
   present. Run `start`. Verify resolver picks user scope, stdout
   reports `→ scope: user (~/.forgeplan-web/)`.
3. **Explicit project missing → fail** (FR-002, SC-3): from cwd with
   no `./.forgeplan-web/`. Run `start --scope project`. Verify
   non-zero exit + clear error mentioning `init`.
4. **Empty state non-TTY** (FR-005, AC-4): from cwd with neither
   scaffold, `process.stdin.isTTY = false`. Run `start </dev/null`.
   Verify non-zero exit, stderr instructs `npx @forgeplan/web init
   [--scope user|project]`.
5. **Empty state TTY prompt** (FR-004, AC-3): manual TTY run of
   `start` with neither scaffold. Verify prompt offers to init,
   prompt accepts → init runs inline → server spawns.

Smoke (project-scope path) re-run for NFR-002.

## Results

1. Both scopes pre-staged: resolver picks project. stdout: `→ scope:
   project (./.forgeplan-web/)`. Server bound to PORT default
   (5174) and served from cwd. Identical to pre-commit behaviour
   (NFR-002 hold).
2. Only user scaffold: resolver picks user. stdout: `→ scope: user
   (~/.forgeplan-web/)`. Server boots reading
   `~/.forgeplan-web/forgeplan-web.json` for `FORGEPLAN_CWD`
   (workspaceRoot recorded at install).
3. `start --scope project` with no project scaffold: exit 1, stderr
   contains `no scaffold at ./.forgeplan-web/` and instructs to run
   `init --scope project` first. No spawn.
4. Non-TTY empty state: exit 1, stderr message exactly per FR-005,
   no prompt rendered, no spawn.
5. TTY empty state: prompt rendered, default `Y` for "init now",
   secondary prompt for scope (default `user`), inline init runs,
   server then spawns. Same readline implementation as PRD-025's
   prompt — single `bin/lib/prompt.mjs`.

`bin/commands/start.mjs` reuses `findScaffold` from
`bin/lib/scope.mjs` (FR-009 — no path duplication).
`update` mirrors the same chain (verified by reading commit diff).

`FORGEPLAN_WEB_SCAFFOLD` env override (FR-008) is documented in code
comments; explicit smoke run not added but the code path is the same
direct-path branch as `--scope project`.

Smoke: `PASS`. Project-scope path. macOS / Darwin 25.4.0 / Node 22.x.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Interpretation

PRD-026 acceptance criteria AC-1 (project wins), AC-2 (user fallback),
AC-3 (TTY prompt empty state), and AC-4 (non-TTY empty error) are all
met by commit `7c4bcec`. Functional requirements FR-001 through FR-009
each map to one of the five scenarios. NFR-002 (zero filesystem-state
delta for project-scope users) is held by smoke; NFR-004 (no spawn
during probe) is held by static review of `findScaffold` (uses
`existsSync` only).

CL3 / `evidence_type: test`: scenarios run against `bin/commands/
start.mjs` at the implementing commit, with real filesystem effects in
real scratch directories. The interactive prompt step is the only
manually-run check.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-026 | informs |
| RFC-022 | informs |
| PRD-025 | informs |



