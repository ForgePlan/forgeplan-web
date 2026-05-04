---
created: 2026-05-04
depth: tactical
id: EVID-005
kind: evidence
links:
- target: PRD-001
  relation: informs
status: active
title: 'safety hardening (init --force hook + RED LINE #8) + Windows CI fully green for the first time'
updated: 2026-05-04
---

# EVID-005: safety hardening + cross-platform CI green

| Field       | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| Status      | Draft                                                            |
| Created     | 2026-05-04                                                       |
| Valid Until | 2026-08-04 (3 months — re-verify if hooks or CI workflow change) |
| Target      | PRD-001                                                          |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Measurement

Two-part follow-up to EVID-004. Part A formalises the safety hardening
that closed PRD-001 FR-007 ("RED LINES warns about destructive forgeplan
commands"). Part B documents the cross-platform CI fix that turned a
silently-broken Windows matrix green for the first time since the
workflow was created.

### Part A — safety hardening (commits `bb136d6` + `ae08bfb`)

| Commit  | Surface                              | Verification                                                                                                                                                                                                                                                                                       |
| ------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bb136d6 | `.claude/hooks/forge-safety-hook.sh` | New case for the destructive `forgeplan init` flag. Override env: `FORGE_ALLOW_INIT_FORCE=1`. Also added text-only-command early-exit (`git commit`, `git log`, `git show`, `echo`, `printf`, `cat <<`) so dangerous-looking strings inside commit messages and HEREDOCs no longer false-positive. |
| ae08bfb | `CLAUDE.md`                          | RED LINE #8: documents the trap, references the hook, and gives the safe recovery path (`rmdir .forgeplan/lance && forgeplan reindex`).                                                                                                                                                            |

Self-validating regression: my own commit message during this session
contained the literal trigger string — the new hook caught it as a
false positive, which both **proved** the pattern works and **motivated**
the text-only-command skip immediately added in the same hook commit.

### Part B — Windows CI green (PR #3, merge commit `ac8ac04`)

The smoke workflow had been red on `windows-latest` for **9/9** runs
since creation, including releases `0.1.1` and `0.1.2` — meaning the
published npm tarball was advertised as cross-platform but in practice
ran only on Linux/macOS. PR #3 stacked four root-cause fixes:

| Commit  | File                                                             | Defect on Windows                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9030501 | `scripts/build.mjs`                                              | `spawnSync('npm', ...)` without `shell: true` cannot invoke `npm.cmd` (batch); `CreateProcess` fails fast, status=null. + bumped actions checkout/setup-node v4 to v5.                                     |
| e2f5d7e | `bin/forgeplan-web.mjs` + `template/src/lib/server/forgeplan.ts` | Same root cause in **production** code: the binary probe and the live `/api/*` driver could not spawn `forgeplan.cmd`. Without this fix the published package never actually worked on Windows end-to-end. |
| 89851af | `scripts/smoke.mjs`                                              | `rmSync` on scratch dir tripped EBUSY (Windows holds open handles). Added `maxRetries: 20` / `retryDelay: 100`.                                                                                            |
| 9ae23d8 | `scripts/smoke.mjs`                                              | Retries alone weren't enough: the server child holds `scratch` as its `cwd`. Made cleanup async, `await`s server `exit` event before `rmSync`.                                                             |

## Result

### Part A

Hook syntax check (`bash -n .claude/hooks/forge-safety-hook.sh`) → ok.
Functional check on the same session: hook blocked the literal
destructive command issued by my testing harness, exited with status 2
and the documented error message including the override hint. Commit
messages containing the same string in `git commit -m "..."` or
HEREDOCs no longer trigger the block.

### Part B

PR #3 final CI matrix (`gh pr checks 3`):

| Job                      | Status   | Duration  |
| ------------------------ | -------- | --------- |
| ubuntu-latest / node 22  | pass     | 24s       |
| macos-latest / node 22   | pass     | 21s       |
| windows-latest / node 22 | **pass** | **1m30s** |

All API assertions pass on Windows (`/api/health`, `/api/list`, `GET /`),
proving the SvelteKit server actually serves traffic when scaffolded
into a host project on Windows — a path that had silently been broken
in every published release until this PR.

PR merged via merge commit `ac8ac04` on `main`. Local `main` is at the
merge commit, branch `fix/ci-windows-rollup-optional-deps` deleted.

## Interpretation

PR #3 + the two safety commits push PRD-001 from `R_eff = 1.00` /
1-evidence (insufficient confidence) to `R_eff = 1.00` /
2-evidence (sufficient confidence). They also widen the validated
surface: EVID-004 covered documentation acceptance and the macOS smoke;
EVID-005 covers the _cross-platform_ CI matrix and the safety net that
prevents recurrence of this session's destructive-init incident.

The published `@forgeplan/web` package is now genuinely cross-platform
for the first time since 0.1.0. The next release tag will cut a
cross-platform-validated version (no extra changes needed beyond a
version bump).

## Congruence Level Justification

**CL3 (same-context, penalty 0.0)**:

- Part B verification = the actual GitHub-hosted runner matrix that the
  release workflow uses. Not a proxy, not a local emulator. As close to
  "what will run when a user installs the package" as we can get
  without reaching into npm post-install hooks.
- Part A verification = exercising the hook against an actual
  PreToolUse:Bash event in this very session. The hook caught a real
  command issued by an LLM agent (me) — the exact agent population the
  hook is designed to protect.
- `evidence_type: test` rather than `measurement` because both parts are
  pass/fail assertions with binary outcomes (CI green/red, hook
  block/pass), not numeric measurements.

## Related Artifacts

| Artifact | Relation  | Notes                                                            |
| -------- | --------- | ---------------------------------------------------------------- |
| PRD-001  | informs   | Closes FR-007 (was Pending) and validates SC-5 across all 3 OSes |
| EVID-004 | builds-on | Extends EVID-004's macOS-only smoke to ubuntu/macos/windows      |


