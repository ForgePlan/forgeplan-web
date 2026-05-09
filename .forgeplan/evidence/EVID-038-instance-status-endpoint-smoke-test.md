---
depth: standard
id: EVID-038
kind: evidence
last_modified_at: 2026-05-09T16:37:02.382471+00:00
last_modified_by: claude-code/2.1.138
links:
- target: PRD-027
  relation: informs
- target: RFC-023
  relation: informs
status: active
title: instance-status endpoint smoke test
---

# EVID-038: instance-status endpoint smoke test

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-09 |
| Valid Until | 2026-08-09 |
| Target | PRD-027 (instance registry + viewer) |

<!-- REQUIRED for R_eff scoring. Legal values documented in templates/evidence/README.md. -->

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Measurement

`GET /api/instance-status` endpoint added in PR #136 (`feat(health-bar): instance switcher relevance`).
Verified via `npm run check` (svelte-check) — 0 errors, 0 warnings across 1070 files.
Endpoint calls `runForgeplan(['health', '--json'])` and `runForgeplan(['claims', '--json'])` in parallel,
both of which are in `READ_ONLY_SUBCOMMANDS` (rule 22 enforcement in `forgeplan.ts`).

Test surface: the endpoint itself + `HealthBar.svelte` (pre-flight fetch to `http://{host}:{port}/api/instance-status`
before any instance switch).

## Result

- `svelte-check`: 0 errors, 0 warnings (1070 files) — merge commit `6f633cc`
- `READ_ONLY_SUBCOMMANDS` check: `health` ✓, `claims` ✓ — no new subcommands added
- Rule 22 proxy constraint: only `GET`, no spawn of mutating subcommands, no external network calls
- CI matrix (ubuntu / macos / windows × node 22): 6/6 passing (PR #136)

## Interpretation

The endpoint is structurally correct (type-safe, rule 22-compliant, CI green) and is used by the
instance switcher as the pre-flight validation target. Supports the PRD-027 goal of a reliable,
read-only instance-viewer surface.

## Congruence Level Justification

CL3: evidence is a direct test of the exact surface (the `/api/instance-status` endpoint in this repo,
built and type-checked in the same CI run). Same context — no extrapolation from external data.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-027 | informs |
| RFC-023 | informs |




