---
created: 2026-05-04
depth: standard
id: PRD-002
kind: prd
priority: P1
status: active
title: 'Security tactical PR S1: FORGEPLAN_BIN validation, update symlink-guard, log rate-limit, build ignore-scripts'
updated: 2026-05-04
---

# PRD-002: Security tactical PR S1

## Problem

The multi-expert code audit run on `@forgeplan/web@0.1.5` (security-auditor
domain) surfaced **1 HIGH and 3 MEDIUM** findings on the npm-package
runtime + build path. None are CRITICAL — package is publishable as-is —
but each opens a narrow window that compounds with future feature work.

The four findings:

- **CWE-78 (HIGH)** — `FORGEPLAN_BIN` command injection on Windows.
  `template/src/shared/server/forgeplan.ts:38,68` reads `FORGEPLAN_BIN`
  from env and passes it to `spawn(..., { shell: process.platform === "win32" })`.
  On Windows with `shell: true`, the executable path is interpolated into
  a `cmd.exe` string; spaces / metacharacters in `FORGEPLAN_BIN` interpret
  as shell tokens. Threat: hostile env -> code execution as the user.

- **CWE-59 (MEDIUM)** — `update` rmSync follows symlink.
  `bin/forgeplan-web.mjs:195` calls `rmSync(target, { recursive, force })`.
  If `.forgeplan-web` is a symlink, rmSync removes the target tree.

- **CWE-770 (MEDIUM)** — `/api/log?limit=` no rate-limit.
  No per-IP rate limit, no concurrency cap on `runForgeplan`. Loopback by
  default but `HOST=0.0.0.0` opens LAN DoS.

- **CWE-1357 (MEDIUM)** — supply-chain via transitive postinstall.
  `scripts/build.mjs:100-106` runs `npm install --omit=dev --omit=peer`
  without `--ignore-scripts`. Future tampered dep could inject postinstall
  into published `dist/node_modules/`.

**Impact**: combined, an attacker with local write to host project plus
knowledge of FORGEPLAN_BIN could execute code; LAN-bound instance is
DoSable. None remotely exploitable today, but each violates defense-in-depth.

## Target Users

| Persona                                         | Description                             | Pain                                                                           |
| ----------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| End-user developer                              | Runs `npx @forgeplan/web init && start` | Inherits security posture; cannot inspect every spawn                          |
| Repo contributor                                | Hacks on this codebase                  | Wants audit findings closed before next dep bump grows new postinstall surface |
| Security reviewer (CI / Dependabot / npm audit) | Scans the published artifact            | Wants `--ignore-scripts` + validator at every spawn boundary                   |

## Goals

| ID   | Criterion                                              | Metric                                     | Target                      | How to measure |
| ---- | ------------------------------------------------------ | ------------------------------------------ | --------------------------- | -------------- |
| SC-1 | `FORGEPLAN_BIN` regex-validated at module load         | grep `FORGEPLAN_BIN_RE` in `forgeplan.ts`  | regex anchored `^...$`      | shell          |
| SC-2 | `update` refuses symlinked `.forgeplan-web`            | `lstat` + `isSymbolicLink()` branch in bin | present, with `fail()` exit | grep           |
| SC-3 | `runForgeplan` capped by in-process semaphore          | semaphore impl                             | concurrency cap = 4         | grep + manual  |
| SC-4 | `scripts/build.mjs` passes `--ignore-scripts`          | grep                                       | exact match                 | shell          |
| SC-5 | Smoke matrix green on 3 OS x Node 22                   | `gh pr checks`                             | 3/3 pass                    | CI             |
| SC-6 | `npm audit --omit=dev` template/ unchanged or improved | `npm audit --json`                         | not worse than 0/0/0/2      | shell          |

## Non-Goals

- Do **not** add zod / valibot runtime validators yet (that is PR T1).
- Do **not** add `hooks.server.ts` with CSP — defense-in-depth, no `{@html}` sinks today; can wait for markdown-rendering feature.
- Do **not** bump `@sveltejs/kit` to fix cookie GHSA — separate dep-bump PR.
- Do **not** introduce per-IP rate-limit middleware — concurrency cap is minimum viable.
- Do **not** refactor unrelated code. Surgical only.

## Functional Requirements

| ID     | Category            | Priority | Requirement                                                                                                              | Acceptance                                                       |
| ------ | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| FR-001 | Spawn safety        | Must     | `FORGEPLAN_BIN` regex-validated `^[A-Za-z0-9_./:\\-]+$` at module load; if fails, refuse spawn with clear error envelope | grep regex; manual `FORGEPLAN_BIN=";rm -rf /"` -> 502            |
| FR-002 | Filesystem safety   | Must     | `update` `lstat`s target before `rmSync`; if `isSymbolicLink()`, fail with «refusing to follow symlink»                  | grep `lstat` + `isSymbolicLink`; manual symlink test fail-fast   |
| FR-003 | Filesystem safety   | Must     | `update` asserts target equals `${cwd}/.forgeplan-web` (path-resolve equality, not endsWith)                             | grep `resolve` equality check                                    |
| FR-004 | Resource exhaustion | Must     | `runForgeplan` enforces in-process concurrency cap of 4; further requests queue                                          | grep semaphore; manual 10 concurrent curls show queueing         |
| FR-005 | Supply chain        | Must     | `scripts/build.mjs#installRuntimeDeps` passes `--ignore-scripts`                                                         | grep `--ignore-scripts`                                          |
| FR-006 | Documentation       | Should   | CHANGELOG.md entry under `[Unreleased]` describes each CWE fix                                                           | grep CWE-78, CWE-59, CWE-770, CWE-1357 in CHANGELOG              |
| FR-007 | Observability       | Could    | Validation rejection emits `console.error` with failing input                                                            | grep `console.error.*FORGEPLAN_BIN` and `console.error.*symlink` |

## Non-Functional Requirements

| ID      | Category      | Requirement                                                           | Metric                                   |
| ------- | ------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| NFR-001 | Compatibility | All 4 fixes work on ubuntu / macos / windows x Node 22                | smoke matrix 3/3 green                   |
| NFR-002 | Performance   | Concurrency cap does not raise polling p95 latency by more than 10 ms | local benchmark                          |
| NFR-003 | Reversibility | Each FR is independently revertable                                   | 4+ commits in PR, each `git revert`-able |
| NFR-004 | Tarball drift | `npm pack --dry-run` file count unchanged                             | diff before/after                        |

## Affected Files

- `template/src/shared/server/forgeplan.ts` — FR-001 + FR-004 + FR-007
- `bin/forgeplan-web.mjs` — FR-002 + FR-003 + FR-007
- `scripts/build.mjs` — FR-005
- `CHANGELOG.md` — FR-006

## Related Artifacts

| Artifact | Relation                                   | Status  |
| -------- | ------------------------------------------ | ------- |
| PRD-001  | Parent methodology bootstrap               | active  |
| EVID-005 | Prior safety hardening (init --force hook) | active  |
| RFC-S1   | Architectural shape of the 4 fixes         | planned |
| EVID-S1  | Smoke matrix + per-CWE acceptance          | planned |

## Risks & Mitigations

| ID  | Risk                                                                 | Probability | Impact | Mitigation                                                        |
| --- | -------------------------------------------------------------------- | ----------- | ------ | ----------------------------------------------------------------- |
| R-1 | FR-005 breaks a transitive dep relying on postinstall                | Low         | High   | Smoke matrix on 3 OS validates; if fail, narrow to dep allow-list |
| R-2 | FR-001 regex blocks legitimate Windows paths (spaces, drive letters) | Medium      | Medium | Regex permits `[A-Za-z0-9_./:\\-]`; widen if smoke fails          |
| R-3 | FR-004 semaphore introduces deadlock if route waits on another       | Low         | Medium | Routes don't fan out; semaphore is leaky bucket not lock          |
| R-4 | FR-002 symlink-guard breaks dev workflows that intentionally symlink | Low         | Low    | Document override env `FORGE_ALLOW_SYMLINK_TARGET=1` if requested |


