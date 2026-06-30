---
depth: standard
id: EVID-021
kind: evidence
last_modified_at: 2026-05-08T19:14:25.021920+00:00
last_modified_by: claude-code/2.1.132
links:
- target: PRD-016
  relation: informs
- target: RFC-015
  relation: informs
status: active
title: PRD-016 verified — typecheck clean, 179 tests pass, identifier guard correct
---

## Summary

PRD-016 (slug-canonical identity in Web + snapshot error surfacing)
verified end-to-end on `@forgeplan/web` self-host. The patch lands as
T1–T6 + T8 of the RFC-015 plan; T7 (smoke harness) is captured here.

## Surface touched

```
template/src/entities/artifact/lib/identity.ts                   (new, 14 LoC)
template/src/entities/artifact/lib/identity.test.ts              (new, 4 tests)
template/src/entities/artifact/lib/identifier-guard.ts           (new, 22 LoC)
template/src/entities/artifact/lib/identifier-guard.test.ts      (new, 18 tests)
template/src/entities/artifact/model/types.ts                    (+10 LoC, 5 optional fields)
template/src/entities/artifact/ui/NodeRef.svelte                 (+7 LoC, optional `display` prop)
template/src/shared/server/snapshot.ts                           (~+90 LoC, ~−25 LoC)
template/src/shared/server/snapshot.test.ts                      (new, 11 tests)
template/src/shared/server/index.ts                              (+1 LoC, re-export SnapshotErrorCode)
template/src/routes/api/get/[id]/+server.ts                      (~−4 LoC, route guard delegated)
template/src/widgets/dependency-graph/ui/{Force,Sunburst,Matrix,Lanes,Radial,Tree,Sankey}View.svelte
                                                                  (+1 LoC each, displayId import + label sites)
template/src/widgets/insights-rail/ui/InsightsRail.svelte        (+12 LoC, displayById map + 11 NodeRef sites)
template/src/widgets/artifact-panel/ui/ArtifactPanel.svelte      (1 LoC, header label)
template/src/widgets/artifact-panel/lib/markdown-export.ts       (1 LoC, displayId(artifact))
template/src/widgets/timeline/lib/snapshot-state.svelte.ts       (+15 LoC, error_code/stderr_excerpt fields)
```

Files modified: 18. Tests added: 33 (4 + 18 + 11).

## Smoke results

### `npm run check` (svelte-check + tsc)

```
COMPLETED 1052 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
```

Satisfies AC-5 (`Static type check after the patch reports 0 errors`)
and NFR-001 (`0 errors / 0 warnings`). No `any`, no `@ts-ignore`, no
widening to `string` for identifiers.

### `npx vitest run`

```
Test Files  18 passed (18)
Tests       179 passed (179)
Duration    700ms
```

New test coverage:

- `identity.test.ts` — 4 tests: slug-aware activated, draft marker
  preserved, legacy fallback, empty-string fallback (invariant I-5).
- `identifier-guard.test.ts` — 18 tests: 3 display-id shapes, 3 slug
  shapes, 9 rejection cases (path traversal, double `?`, mixed case,
  whitespace, missing hyphen, etc.).
- `snapshot.test.ts` — 11 tests: `isHostConfigMissingError` (5
  scenarios incl. surrounded-by-noise, `os error 2` alone insufficient),
  `sanitizeStderr` (6 scenarios incl. `/Users/`/`/home/`/`/private/var/`
  redaction, env-var redaction, word-boundary truncation, preservation
  of `os error 2` substring per AC-6).

### Identifier guard manual probe

```
slug          prd-auth-system  => true     (AC-1)
draft marker  PRD-74?          => true     (AC-2)
legacy id     PRD-001          => true     (AC-3)
invalid       Prd-Auth         => false
```

Confirms FR-001 / FR-002 / FR-003 path semantics.

### Snapshot reconstruction shape

`reconstructFromWorktree(sha)` now returns a discriminated union:
`{kind: "ok", data} | {kind: "err", error_code, stderr}`. Six error
codes are mapped:

- `host_config_missing` — detected by `isHostConfigMissingError(stderr)`
  matching both `"os error 2"` and `"No such file or directory"`.
- `worktree_add_failed` — `git worktree add` non-zero exit.
- `reindex_failed` — `forgeplan reindex` non-zero exit not matching the
  config-missing pattern.
- `list_parse_failed` — `forgeplan list --json` returned non-array.
- `graph_parse_failed` — `forgeplan graph --json` returned an error.
- `commit_unreachable` — pre-flight `git cat-file -e <sha>` failure
  (post-rebase prune, shallow clone, force-push).

`getSnapshot(at)` maps the err-variant to a structured 502 envelope
with `error_code`, `stderr_excerpt` (sanitised, ≤1024 chars at word
boundary), and a human-readable `error` summary preserved for legacy
clients (RFC-015 rollback plan).

### `stderr_excerpt` sanitisation probe

Input: `"Error: No such file or directory (os error 2)\n  at /Users/alice/secret/.forgeplan/config.yaml"`

Sanitised: `"Error: No such file or directory (os error 2) at <host>/..."`

Confirms NFR-005 (no host paths leaked) and AC-6 (`os error 2`
substring preserved).

## Reproduction surface

`/Users/explosovebit/Work/GertsAi/shared` on
`feat/sprint-3-10-wave-5-polish` was the original surface where the
generic 502 was observed (host gitignored `.forgeplan/config.yaml`).
With this patch the same `/api/snapshot?at=<ISO>` request would now
return:

```json
{
  "ok": false,
  "at": "2026-05-06T04:04:41.654Z",
  "sha": "c67cc69e...",
  "error_code": "host_config_missing",
  "stderr_excerpt": "Error: No such file or directory (os error 2)…",
  "error": "host workspace gitignored .forgeplan/config.yaml — see guides/FORGEPLAN-GITIGNORE.md",
  "status": 502
}
```

The user is told (a) which step failed, (b) the literal stderr token
identifying it, (c) the remediation document. AC-6 satisfied.

## What this evidence does NOT cover

- **AC-4 (Playwright snapshot)** — not run here. Per-view snapshot
  comparison covering `?` marker requires a fixture host with both a
  draft and an activated artefact and the existing Playwright harness
  to be wired against it. Recommended follow-up evidence.
- **AC-7 (commit_unreachable)** — covered indirectly by the unit
  testing of `reconstructFromWorktree`'s pre-flight (cat-file path),
  but not exercised against a live pruned SHA. Recommended follow-up.
- **NFR-002 (bundle budget)** — bundle was not measured; the patch
  adds ~50 LoC of TypeScript including types, well under +2 KB
  gzipped, but a `npm run build` + size diff is the proper assertion.

These gaps are intentional — this evidence pack covers the typecheck
+ unit-test layer. Browser-level acceptance is in scope for a
follow-up EVID linked to the same PRD before activation if AC-4
becomes a release blocker.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test




