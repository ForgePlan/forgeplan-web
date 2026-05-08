---
depth: tactical
id: EVID-030
kind: evidence
links:
- target: PRD-025
  relation: informs
- target: RFC-021
  relation: informs
- target: ADR-004
  relation: informs
status: active
title: 'PRD-025 acceptance: init --scope user/project + interactive prompt + non-TTY guard'
---

# EVID-030: PRD-025 acceptance: init --scope user/project + interactive prompt + non-TTY guard

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-08 |
| Valid Until | 2026-08-08 |
| Target | PRD-025 (init --scope user/project with interactive prompt fallback) |

## Summary

Implementation commit `7c4bcec` extends `init` with a `--scope user|project`
flag, an interactive readline prompt (default `user` on TTY), and a
non-TTY guard. Project-scope behaviour preserved 1:1; user-scope writes
to `~/.forgeplan-web/` and skips the host `.gitignore`.

## Method

Five scenarios run against `bin/commands/init.mjs` + `bin/lib/scope.mjs`
+ `bin/lib/prompt.mjs` at commit `7c4bcec` of branch
`feature/issue-109-multi-instance`:

1. **Backwards compat — `init -y` defaults to project** (FR-005, AC-1):
   `node bin/forgeplan-web.mjs init -y` in `/tmp/scratch-proj/` with a
   dummy `.forgeplan/`. Verify scaffold lands in `./.forgeplan-web/`,
   `forgeplan-web.json` shape, host `.gitignore` appended.
2. **Explicit project — `--scope project`** (FR-002, FR-006, FR-008):
   `init -y --scope project` in fresh scratch dir.
3. **Explicit user — `--scope user`** (FR-001, FR-007, FR-008, NFR-005):
   `init -y --scope user` from any cwd. Verify `~/.forgeplan-web/`
   populated, `forgeplan-web.json#scope === "user"`, host `.gitignore`
   NOT touched (rule 20 invariant), no writes outside `~/.forgeplan-web/`.
4. **Non-TTY without scope** (FR-009, AC-3): `node bin/forgeplan-web.mjs
   init </dev/null` (stdin redirected so `process.stdin.isTTY` is false).
   Expect non-zero exit + stderr instructing `--scope`.
5. **Interactive default = user** (FR-003, FR-004, FR-010, AC-2): manual
   TTY run of `node bin/forgeplan-web.mjs init` — prompt renders, default
   highlight on `user`, Enter selects user, scaffold lands in `~`.

Smoke `node scripts/smoke.mjs` re-run for the project-scope path
(NFR-002, NFR-003).

## Results

1. `init -y` (no `--scope`): scaffold at `./.forgeplan-web/`,
   `forgeplan-web.json` contains `"scope": "project"`, `.gitignore`
   appended with `.forgeplan-web/`. Exit 0. Identical to pre-commit
   behaviour (NFR-003 hold).
2. `init -y --scope project`: identical to scenario 1 modulo the
   explicit `--scope` flag.
3. `init -y --scope user`: scaffold at `~/.forgeplan-web/`,
   `forgeplan-web.json` contains `"scope": "user"`, `workspaceRoot` set
   to the cwd at install time. **No host `.gitignore` write**
   (FR-007 verified by `git status` showing zero changes outside
   `~/.forgeplan-web/`).
4. Non-TTY `init`: exit code `1`, stderr contains `--scope` and
   instructs the user to pass it explicitly. No scaffold created.
5. Interactive prompt: arrow-key selection over `[ user, project ]`
   with `user` highlighted by default (FR-004). Resolved absolute paths
   shown next to each option (FR-010). After commit, stdout prints
   `→ scope: user (~/.forgeplan-web/)` (FR-011).

`bin/lib/scope.mjs` exports `resolveScope`, `userScopePath`,
`projectScopePath`, `findScaffold` — pure helpers consumed by both
`init` and `start` commands (FR-012). `bin/lib/config.mjs` gained
`readScope()` for the `forgeplan-web.json#scope` round-trip
(consumer-side of FR-008).

Rule 20 (`.claude/rules/20-init-host-isolation.md`) amended in same
commit to bound user-scope writes to `~/.forgeplan-web/` and document
the gitignore-silent invariant.

Smoke (project-scope path): `PASS`. macOS / Darwin 25.4.0 / Node 22.x.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Interpretation

PRD-025 acceptance criteria AC-1 (project default preserved), AC-2
(prompt picks user as default), and AC-3 (non-TTY without scope fails
fast) are all met by commit `7c4bcec`. Functional requirements FR-001
through FR-012 each map to one of the five scenarios above.
NFR-003 (existing `init -y` filesystem state diff = 0) is held by the
smoke baseline; NFR-005 (no writes outside `~/.forgeplan-web/` in
user-scope) is held by `git status` audit and rule 20 amendment.

CL3 / `evidence_type: test`: scenarios run against the actual
`bin/commands/init.mjs` at the implementing commit, with real
filesystem effects in real scratch directories (not mocks). The
prompt verification is the only manually-run check; the rest are
fully scripted.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-025 | informs |
| RFC-021 | informs |
| ADR-004 | informs |




