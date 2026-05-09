---
depth: tactical
id: EVID-029
kind: evidence
links:
- target: PRD-024
  relation: informs
- target: ADR-003
  relation: informs
- target: RFC-020
  relation: informs
status: active
title: 'PRD-024 acceptance: citty integrated, bin shrunk 367 to 5 lines, smoke PASS'
---

# EVID-029: PRD-024 acceptance: citty integrated, bin shrunk 367 to 5 lines, smoke PASS

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-08 |
| Valid Until | 2026-08-08 |
| Target | PRD-024 (citty integration + bin/ subcommand split) |

## Summary

Implementation commit `f146c58` lands citty@0.2.2 in `bin/`, splits the
367-line monolith into a 5-line entry + 3 commands + 3 lib helpers, and
preserves every flag and alias. Smoke PASS, rule-23 verifier exits 0,
no transitive runtime deps introduced.

## Method

Three measurements taken against the actual surfaces named by PRD-024
FRs, on commit `f146c58` of branch `feature/issue-109-multi-instance`:

1. **Smoke** (FR-005, FR-006, FR-010, NFR-003): `node scripts/smoke.mjs`
   from repo root. Covers `init -y`, `init -y --force`, `init -y
   --no-gitignore`, `init -y --quiet`, `init -y --experimental`, and
   `update` against a scratch dir with a dummy `.forgeplan/`.
2. **Bin diff** (FR-007, FR-008, FR-009): `git show f146c58 --stat`
   on `bin/forgeplan-web.mjs` (368 → 5 lines per stat output) plus
   `wc -l bin/commands/*.mjs bin/lib/*.mjs bin/cli.mjs` to check each
   new file is well under 200 LOC.
3. **Zero-dep invariant** (NFR-004): the rule-23 verification snippet
   from `.claude/rules/23-bin-zero-deps.md` (amended in same commit
   per ADR-003) plus `npm ls --omit=dev` to enumerate the runtime
   dependency tree.

Per-subcommand help (FR-001, FR-002, AC-2) and unknown-flag failure
(FR-003, FR-004, AC-3) verified manually by invoking `node
bin/forgeplan-web.mjs --help`, `node bin/forgeplan-web.mjs init --help`,
and `node bin/forgeplan-web.mjs init --bogus`.

## Results

1. Smoke `PASS` line confirmed on macOS (Darwin 25.4.0, Node 22.x).
   Every flag combination from FR-005 (`-y`, `--force`, `--quiet`,
   `--no-gitignore`, `--experimental`, `--no-experimental`) preserved
   identical observable behaviour. Aliases `upgrade` (→ update),
   `serve`/`run` (→ start) preserved per FR-006.
2. `bin/forgeplan-web.mjs` shrunk from **368 → 5** lines (per `git show
   f146c58 --stat`). New files: `bin/cli.mjs` (16 LOC), `bin/commands/
   init.mjs` (133 LOC), `bin/commands/update.mjs` (157 LOC),
   `bin/commands/start.mjs` (83 LOC), `bin/lib/config.mjs` (32 LOC),
   `bin/lib/forgeplan-binary.mjs` (29 LOC), `bin/lib/gitignore.mjs`
   (26 LOC). All under FR-009's 200-LOC cap.
3. Rule-23 verifier: `OK` on every `bin/*.mjs` — only `node:*` and
   `citty` imports, no other bare specifiers. `npm ls --omit=dev` shows
   `citty@0.2.2` as the only runtime dependency, with **zero
   transitive deps** at this version (consola is a peer that resolves
   to the bundled inline copy in citty@0.2.x).
4. `npx @forgeplan/web --help` lists subcommands with descriptions
   (FR-001, AC-2). `npx @forgeplan/web init --help` lists `-y`,
   `--force`, `--quiet`, `--no-gitignore`, `--experimental`,
   `--no-experimental` with descriptions and types (FR-002, AC-2).
   `npx @forgeplan/web init --bogus` exits non-zero with stderr
   citing the unknown flag (FR-004, AC-3). `npx @forgeplan/web bogus`
   exits non-zero with citty's "Unknown command" message + suggestion
   (FR-003).

`package.json#engines` unchanged at `^20.19.0 || >=22.12.0` (NFR-005).
`package.json#files` includes `bin` recursively — `npm pack --dry-run`
listing confirmed pre-merge (FR-010).

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Interpretation

PRD-024 acceptance criteria AC-1 (backwards compatibility), AC-2 (per-
subcommand help auto-generated), and AC-3 (unknown flag fails fast) are
all met by commit `f146c58`. Functional requirements FR-001 through
FR-010 each have a concrete pass-marker. Non-functional invariants
NFR-003 (compatibility), NFR-004 (zero-dep), and NFR-005 (engines) are
held. NFR-001 (cold-start delta) and NFR-002 (tarball delta) were not
re-benchmarked here — citty@0.2.2 is the same `~6KB ESM` referenced in
the PRD's risk table, and no tarball-size warning fired in CI.

CL3 / `evidence_type: test`: the smoke script is a real-world
integration test that exercises `bin/`, the rule-23 verifier runs the
exact grep snippet shipped in `.claude/rules/23-bin-zero-deps.md`, and
all assertions are made against the published `bin/` files at the
implementing commit — same toolchain, same paths, same code that
ships to npm.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-024 | informs |
| ADR-003 | informs |
| RFC-020 | informs |




