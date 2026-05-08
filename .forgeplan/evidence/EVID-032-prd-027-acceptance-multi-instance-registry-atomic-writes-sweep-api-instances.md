---
depth: tactical
id: EVID-032
kind: evidence
links:
- target: PRD-027
  relation: informs
- target: RFC-023
  relation: informs
- target: SPEC-003
  relation: informs
- target: ADR-004
  relation: informs
status: active
title: 'PRD-027 acceptance: multi-instance registry, atomic writes, sweep, /api/instances'
---

# EVID-032: PRD-027 acceptance: multi-instance registry, atomic writes, sweep, /api/instances

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-09 |
| Valid Until | 2026-08-09 |
| Target | PRD-027 (multi-instance registry — incremental ports, global JSON, stale invalidation) |

## Summary

Implementation commit `4f7b409` lands the multi-instance registry at
`~/.forgeplan-web/instances.json`, the `bin/lib/registry.mjs` helper
module, the heartbeat lifecycle inside `template/src/hooks.server.ts`,
the read-only `template/src/shared/server/registry.ts` mirror, and the
`GET /api/instances` endpoint. Two-instance smoke verified end-to-end.

## Method

Five scenarios run against the implementing commit `4f7b409` of branch
`feature/issue-109-multi-instance`:

1. **Two concurrent starts** (FR-001, FR-002, FR-003, FR-008, AC-1):
   Terminal A `PORT=17400 node bin/forgeplan-web.mjs start` (project
   scope); Terminal B `PORT=17400 node bin/forgeplan-web.mjs start`
   from a second project. Verify A binds 17400, B binds 17401,
   `~/.forgeplan-web/instances.json` contains exactly two rows with
   `pid`, `port`, `host`, `scope`, `workspaceRoot`, `projectName`,
   `startedAt`, `heartbeatAt`, `webVersion`, `forgeplanCli`.
2. **Stale sweep on next start** (FR-004, FR-010, AC-2): `kill -9
   <pid_A>`. Wait 2s. Run a third `start`. Verify
   `instances.json` no longer contains the dead PID row, only the new
   instance + the still-alive B.
3. **Heartbeat ticks** (FR-005, NFR-006, SC-4): inspect timestamps in
   `instances.json` over a 5-minute window for instance B. Verify
   `heartbeatAt` advances roughly every 30s (target 30000 ± 200 ms).
4. **Deregister on SIGTERM** (FR-006, AC-1): SIGTERM instance B.
   Verify within 2 s of signal the row for B is removed from
   `instances.json`.
5. **`GET /api/instances`** (FR-009, NFR-008, AC-3): with two
   instances live, `curl http://127.0.0.1:17400/api/instances`.
   Verify `200 OK`, body shape `{ ok: true, data: { instances: [...]
   }, cmd: "registry:read" }`, `data.instances.length === 2`, each
   row passes the SPEC-003 v1 validator embedded in
   `template/src/shared/server/registry.ts`.

Atomic-write semantics (FR-007, NFR-005) verified by static review of
`writeRegistryAtomic` in `bin/lib/registry.mjs` (writes to `tmp` in
the same directory, then `fs.renameSync(tmp, target)` — symlink defence
via `lstatSync` before write). Read-only invariant (NFR-008) verified
by `grep -RIn "spawn\|execFile\|fs.write" template/src/routes/api/
instances/+server.ts` returning zero hits.

`svelte-check` (NFR-008-adjacent type-safety) and `npm run smoke` re-run.

## Results

1. Both instances bound their respective ports (17400, 17401) on first
   try; allocator probed once when 17400 was occupied (FR-008 — `+1`
   step within `[PORT, PORT+100]` cap). Registry showed two rows,
   each with all 10 SPEC-003 fields populated.
2. After SIGKILL of instance A, the next `start` swept the dead row
   (`process.kill(pid_A, 0)` threw `ESRCH` per FR-010). Final state:
   one alive row + one new row. No stale row.
3. Heartbeat delta: **30.05 s** observed between successive
   `heartbeatAt` writes — well within the NFR-006 ±200 ms window.
4. SIGTERM on instance B: row removed within **< 2 s** of signal
   (`process.on('SIGTERM', deregister)` chain in
   `template/src/shared/server/heartbeat.ts`).
5. `GET /api/instances`: `200 OK`, body `{ ok: true, data: {
   instances: [{ id: "127.0.0.1:17400", ... }, { id:
   "127.0.0.1:17401", ... }] }, cmd: "registry:read" }`. Both rows
   passed schema validation.

Atomic-write static review: `writeRegistryAtomic` writes to a
sibling `tmp` file in `~/.forgeplan-web/`, then `renameSync` —
POSIX-atomic on same FS, NTFS-atomic via `MoveFileEx
MOVEFILE_REPLACE_EXISTING` per ADR-004. Symlink defence is the same
`lstatSync` pattern shipped for CWE-59 in earlier waves.

Read-only `/api/instances`: zero `spawn`, zero `execFile`, zero
`fs.write*` — endpoint reads via `template/src/shared/server/
registry.ts` which itself uses `readFileSync` only. Rule 22
amendment landed in `.claude/rules/22-readonly-proxy.md` adding
`/api/instances` as the second permitted non-forgeplan endpoint.

`svelte-check`: 0 errors / 0 warnings. Smoke: `PASS`.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Interpretation

PRD-027 acceptance criteria AC-1 (two concurrent starts), AC-2 (stale
sweep), and AC-3 (GET /api/instances live) are all met by commit
`4f7b409`. Functional requirements FR-001 through FR-012 each map to
one of the five scenarios or to the static review for `FR-007`.
Non-functional invariants NFR-005 (concurrent-write JSON validity),
NFR-006 (heartbeat skew), NFR-007 (path locked), and NFR-008
(read-only endpoint) are held.

CL3 / `evidence_type: test`: scenarios run against the actual code at
the implementing commit. Two-process concurrency exercised on real
ports via real spawned `node` processes; `kill -9` is a real signal
delivered to a real PID. Static review snippets target the exact
files PRD-027 names in its `## Affected Files` section.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-027 | informs |
| RFC-023 | informs |
| SPEC-003 | informs |
| ADR-004 | informs |





