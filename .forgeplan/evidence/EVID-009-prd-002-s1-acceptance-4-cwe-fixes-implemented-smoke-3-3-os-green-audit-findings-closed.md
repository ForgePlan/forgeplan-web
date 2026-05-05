---
created: 2026-05-04
depth: tactical
id: EVID-009
kind: evidence
links:
- target: PRD-002
  relation: informs
status: active
title: 'PRD-002 S1 acceptance: 4 CWE fixes implemented, smoke 3/3 OS green, audit findings closed'
updated: 2026-05-04
---

# EVID-009: PRD-002 S1 acceptance — 4 CWE fixes shipped to develop

| Field       | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| Status      | Draft                                                             |
| Created     | 2026-05-04                                                        |
| Valid Until | 2026-08-04 (3 months — re-verify if any of the 3 surfaces change) |
| Target      | PRD-002                                                           |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Measurement

PR #18 (`feature/security-tactical-s1-pr-s1 -> develop`, merge commit
`0bc5cf8`) lands four CWE fixes against the audit findings that drove
PRD-002. This evidence pack verifies each FR/SC against the merged
artefact via three layers: source code review, compiled `dist/` review,
and the cross-platform CI smoke matrix.

### Part A — source code (FR-001..FR-005 + FR-007)

| FR     | Surface                                                 | Verification                                                                                                                                            |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001 | `template/src/shared/server/forgeplan.ts:38-46`         | `FORGEPLAN_BIN_RE = /^[A-Za-z0-9_./:\\-]+$/` at module load. `console.error` on reject. Safe-default fallback to literal `forgeplan`.                   |
| FR-004 | `template/src/shared/server/forgeplan.ts:55-83`         | `SPAWN_CONCURRENCY_CAP = 4` + `acquireSpawnSlot` / `releaseSpawnSlot` queue. Slot released in `finally` so timeout / error / close all return capacity. |
| FR-007 | `template/src/shared/server/forgeplan.ts:43-45,113-118` | Both rejection sites emit `console.error` with the offending input string.                                                                              |
| FR-002 | `bin/forgeplan-web.mjs:196-205`                         | `lstatSync(target)` + `isSymbolicLink()` branch; `fail()` with «refusing to follow symlink».                                                            |
| FR-003 | `bin/forgeplan-web.mjs:207-216`                         | `resolve(target) === resolve(join(cwd, ".forgeplan-web"))` equality assert; `fail()` on mismatch.                                                       |
| FR-005 | `scripts/build.mjs:101-114`                             | `installRuntimeDeps` argv ends with `--ignore-scripts`. Comment cites FR-005 + CWE-1357.                                                                |
| FR-006 | `CHANGELOG.md` `## [Unreleased]` `### Security`         | Four bullets, one per CWE, with file paths and short rationale. Existing release sections untouched.                                                    |

### Part B — compiled artefact (`dist/` post-build)

After `npm run clean && npm run build`, `dist/server/chunks/server-*.js`
contains the regex literal, the `console.error` warning string, and the
`refused: FORGEPLAN_BIN env var contains unsafe characters` early-return.
Compiled surface matches the source.

### Part C — cross-platform smoke matrix (PR #18 CI)

| Job                      | Status   | Duration  |
| ------------------------ | -------- | --------- |
| ubuntu-latest / node 22  | pass     | 29s       |
| macos-latest / node 22   | pass     | 35s       |
| windows-latest / node 22 | **pass** | **1m23s** |

All three jobs ran on the post-merge `develop` push as well
(run id `25345587756`, success in 1m6s) — no regression.

### Part D — local smoke spot-checks

`npm run clean && npm run smoke` on macOS at branch HEAD before push:

```
[smoke] init -y (run 1)              → ✓ ready (no install needed)
[smoke] gitignore: 1 match (preserved user content)
[smoke] init -y --force (run 2)      → ✓ ready (idempotent)
[smoke] gitignore: still 1 match     (idempotent)
[smoke] start (PORT=15825)           → Listening on http://127.0.0.1:15825
[smoke] /api/health: ok (project=shim)
[smoke] /api/list: ok (0 entries)
[smoke] GET /: ok (HTML returned)
[smoke] PASS (11.46s wall-clock)
```

## Result

| ID   | Target                                                 | Measured                                                 | Verdict             |
| ---- | ------------------------------------------------------ | -------------------------------------------------------- | ------------------- |
| SC-1 | `FORGEPLAN_BIN` regex-validated at module load         | regex anchored `^...$` present on line 38                | ✅ pass             |
| SC-2 | `update` refuses symlinked `.forgeplan-web`            | `lstat` + `isSymbolicLink()` + `fail()` on lines 196-205 | ✅ pass             |
| SC-3 | Spawn concurrency cap = 4                              | `SPAWN_CONCURRENCY_CAP = 4` semaphore in forgeplan.ts    | ✅ pass             |
| SC-4 | `--ignore-scripts` in `installRuntimeDeps`             | argv contains the flag (build.mjs:111)                   | ✅ pass             |
| SC-5 | Smoke matrix 3/3 OS × Node 22 green                    | ubuntu pass / macos pass / windows pass                  | ✅ pass             |
| SC-6 | `npm audit --omit=dev` template/ unchanged or improved | 0/0/0/2 (cookie GHSA, separate dep-bump PR)              | ✅ pass (not worse) |

## Interpretation

PRD-002 acceptance is fully met across all 6 SC and 4 NFR. Six commits
landed on `develop` via PR #18, each git-revert-able per NFR-003. None of
the four CWE fixes broke the publishable surface (compiled `dist/`,
3-OS smoke, 14 read-only routes, allow-list integrity).

The shipped `@forgeplan/web@0.1.5` on npm **does not yet contain these
fixes** — they sit on `develop` waiting for the next `release/v0.1.6` cut.
That release is the recommended next step.

## Congruence Level Justification

**CL3 (same-context, penalty 0.0)**:

- Source verification = the actual files merged into `develop` (read at
  branch HEAD post-merge). No proxy.
- Compiled verification = `dist/server/chunks/server-*.js` produced by
  the same `scripts/build.mjs` that ships in the npm tarball. Same code
  path users execute when they run `npx @forgeplan/web start`.
- CI verification = the 3-OS matrix that gates every PR. Identical
  surface to what the release workflow uses.
- `evidence_type: test` because every SC is a binary pass/fail assertion
  with concrete artefacts to grep, not a numeric measurement.

## Related Artifacts

| Artifact | Relation  | Notes                                                                            |
| -------- | --------- | -------------------------------------------------------------------------------- |
| PRD-002  | informs   | Closes all 6 SC and 4 NFR. Activates PRD-002 (R_eff > 0).                        |
| EVID-005 | builds-on | Prior safety hardening (init --force hook + Windows CI).                         |
| PRD-001  | informs   | Methodology baseline that mandates the audit→PRD→evidence flow this PR followed. |


