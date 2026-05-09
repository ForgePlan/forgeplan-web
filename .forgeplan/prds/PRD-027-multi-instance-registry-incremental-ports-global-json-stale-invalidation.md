---
depth: standard
id: PRD-027
kind: prd
links:
- target: PRD-029
  relation: informs
status: active
title: Multi-instance registry — incremental ports, global JSON, stale invalidation
---

---
id: PRD-027
title: "Multi-instance registry — incremental ports, global JSON, stale invalidation"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
priority: P1
depth: standard
domain: general
projectType: cli_tool
stepsCompleted: []
---

# PRD-027: Multi-instance registry — incremental ports, global JSON, stale invalidation

## Executive Summary

### Vision

Allow multiple `npx @forgeplan/web start` invocations to coexist on a
single machine. Each running server claims an incremental free port
starting from `PORT` (default 5174), registers itself in a global
`~/.forgeplan-web/instances.json` registry, heartbeats every 30s, and
deregisters on graceful exit. A start-time stale-sweep purges entries
whose PID is dead or whose last heartbeat is older than 60s.

### Problem

Today only one server can run at a time — the second `start` crashes
with `EADDRINUSE` on port 5174. Users with multiple forgeplan workspaces
(monorepo + side projects + research forks) must stop one server to
look at another. There's no inventory of running instances, so the
upcoming HealthBar instance switcher (#115) has nothing to read from.

**Impact**: Devs who manage ≥2 forgeplan repos lose flow-state cycles
killing/restarting; PRD-029 (instance switcher) is impossible without
a shared registry; multi-window comparison workflows are unsupported.

### Target Users

| Персона | Описание | Ключевая боль |
|---------|----------|---------------|
| Multi-repo dev | Has 2-5 forgeplan workspaces (work + side projects + experiments) | Can't run two servers; constant kill/restart cycle |
| Researcher | Compares two snapshots side-by-side | No cross-instance switcher in UI; must alt-tab terminals |
| Power user | Runs `start` from CI matrix or e2e tests | Port conflicts cascade into flaky test runs |

### Differentiators

- Atomic JSON writes (tmp+rename) survive concurrent starts.
- `process.kill(pid, 0)` liveness probe is portable (POSIX + Windows).
- Heartbeat freshness window (>60s = dead) catches Docker freezes /
  laptop sleep.
- ID format `host:port` is human-readable and naturally unique.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Two concurrent starts both succeed | Exit codes + listening sockets | 1st: ok, 2nd: EADDRINUSE | both ok, ports 5174 + 5175 | Same PR | Smoke parallel |
| SC-2 | Registry file is valid JSON after concurrent writes | `JSON.parse(instances.json)` exit 0 across 10 parallel starts | n/a | exit 0 100% | Same PR | Stress test |
| SC-3 | Stale entries are purged on `start` | After PID 12345 is dead, next start removes its row | n/a | row removed | Same PR | Smoke (kill -9 + restart) |
| SC-4 | Heartbeat freshness window | ms between heartbeats | n/a | 30000 ± 200 | Same PR | Log inspection |
| SC-5 | Registry write atomicity latency | ms per write | n/a | < 10ms p95 | Same PR | Microbench |
| SC-6 | Registry parse latency | ms to read + parse | n/a | < 5ms for ≤100 entries | Same PR | Microbench |
| SC-7 | Port allocator probe latency | ms to find first free port from base | n/a | < 100ms typical | Same PR | hyperfine |
| SC-8 | `GET /api/instances` exposes registry | Response shape `{ ok, data: { instances }, error? }` | endpoint missing | endpoint exists, returns array | Same PR | Smoke HTTP |

---

## Product Scope

### MVP (In-Scope)

- Registry file at `~/.forgeplan-web/instances.json` (locked by ADR-004).
- Schema versioned (v1) — formal contract in SPEC-003.
- Helper module `bin/lib/registry.mjs` — pure functions for read,
  write, append, remove, sweep.
- Server-side reader `template/src/shared/server/registry.ts` — same
  format, read-only.
- Endpoint `GET /api/instances` returning `{ ok, data: { instances },
  error? }` (mirrors existing envelope; rule 22 amendment in PRD-029
  documents allow-list extension).
- Port allocator: increment from `PORT` env (default 5174) until first
  free, capped at `PORT + 100` (max 100 instances).
- Liveness probe: `process.kill(pid, 0)` (no-op signal). On
  EPERM/ESRCH the entry is presumed dead.
- Heartbeat: server-side `setInterval` re-writes `heartbeatAt` every
  30s.
- Deregister: `process.on('SIGINT' | 'SIGTERM' | 'beforeExit')` removes
  the instance row.
- Stale sweep on `start`: any entry with dead PID OR `now -
  heartbeatAt > 60s` is removed before the new instance is appended.

### Out of Scope

- Cross-host federation (only same-machine).
- Authentication / auth-token in the registry.
- A "kill stale instance" CLI command (manual stop is fine for MVP).
- HTTPS / port reservation across reboots.
- Instances launched outside `npx @forgeplan/web start` (e.g. raw `node
  index.js`) registering themselves — those are invisible to the
  registry. Documented limitation.

### Growth Vision

- `forgeplan-web doctor` to inspect / clean the registry.
- Optional auth-token field for shared-tenant scenarios.

---

## User Journeys

### Journey 1: Multi-repo dev runs two servers

**Цель**: Have two forgeplan-web instances at once.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | Terminal A: `cd ~/proj-a && npx @forgeplan/web start` | Bind 5174; register in `~/.forgeplan-web/instances.json` | First instance |
| 2 | Terminal B: `cd ~/proj-b && npx @forgeplan/web start` | 5174 busy; allocator probes 5175; bind; register | Second instance |
| 3 | Browser: open `http://127.0.0.1:5174` | Sees proj-a graph | — |
| 4 | Browser: open `http://127.0.0.1:5175` | Sees proj-b graph | — |
| 5 | Ctrl-C in Terminal A | proj-a deregisters from registry | Clean exit |

**Результат**: Two simultaneous servers; registry tracks both.

### Journey 2: Stale-sweep after crash

**Цель**: Recover from a crashed instance.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | `kill -9 <pid>` on instance from Journey 1 | Instance dies; registry entry NOT removed | Crash, no SIGTERM |
| 2 | New `npx @forgeplan/web start` | Sweep finds dead PID + stale heartbeat → removes row, then appends new | Sweep cleans up |
| 3 | `cat ~/.forgeplan-web/instances.json` | Only the new instance remains | Self-healing |

**Результат**: Registry stays consistent without manual cleanup.

### Journey 3: API consumer reads registry

**Цель**: HealthBar instance switcher (PRD-029) reads the registry.

| Шаг | Действие | Ответ системы | Заметки |
|-----|----------|---------------|---------|
| 1 | Browser polls `GET /api/instances` every 5s | Returns `{ ok, data: { instances: [...] } }` | Read-only |
| 2 | UI compares response to current host:port | Shows switcher when ≥2 entries | PRD-029 |

**Результат**: Live inventory consumed by UI.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | Multiple instances of `npx @forgeplan/web start` can run concurrently on incremental ports | Journey 1 |
| FR-002 | Core | Must | Each running instance is registered with project metadata in `~/.forgeplan-web/instances.json` | Journey 1 |
| FR-003 | Core | Must | Each row contains `id, host, port, pid, scope, workspaceRoot, projectName, startedAt, heartbeatAt, webVersion, forgeplanCli` (per SPEC-003) | Journey 1 |
| FR-004 | Core | Must | Stale entries (dead PID OR `now - heartbeatAt > 60s`) are removed on every `start` | Journey 2 |
| FR-005 | Core | Must | Each instance heartbeats every 30s by re-writing its `heartbeatAt` | Journey 1 |
| FR-006 | Core | Must | Each instance deregisters on SIGINT/SIGTERM/beforeExit | Journey 1 |
| FR-007 | Core | Must | Registry writes are atomic (tmp+rename) — concurrent writes never produce invalid JSON | Journey 1 |
| FR-008 | Core | Must | Port allocator probes increment from `PORT` env (default 5174) capped at `PORT + 100` | Journey 1 |
| FR-009 | Core | Must | API endpoint `GET /api/instances` returns the current registry view | Journey 3 |
| FR-010 | Core | Must | Liveness probe uses `process.kill(pid, 0)` — works on POSIX and Windows | Journey 2 |
| FR-011 | UX | Should | When port 5174 is busy and we bind 5175, stdout reports the actual port clearly | Journey 1 |
| FR-012 | DX | Should | `bin/lib/registry.mjs` exports pure helpers (`readRegistry`, `writeRegistry`, `appendInstance`, `removeInstance`, `sweepStale`) | Journey 1, 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Performance | Registry write walltime | < 10ms p95 | tmp+rename, < 50KB file | microbench |
| NFR-002 | Performance | Registry parse walltime | < 5ms p95 | ≤ 100 entries | microbench |
| NFR-003 | Performance | Stale sweep walltime | < 50ms | 100 entries with mixed alive/dead PIDs | microbench |
| NFR-004 | Performance | Port bind probe walltime | < 100ms typical | first free port within `[PORT, PORT+100]` | hyperfine |
| NFR-005 | Reliability | Concurrent writes preserve JSON validity | 100% across 10 parallel starts | stress test | parse loop |
| NFR-006 | Reliability | Heartbeat skew | ≤ 200ms vs setInterval(30000) | normal load | log timestamps |
| NFR-007 | Safety | Registry file path locked | exact match `~/.forgeplan-web/instances.json` | resolved via `bin/lib/scope.mjs` | grep |
| NFR-008 | Read-only | `/api/instances` endpoint MUST NOT spawn forgeplan or write to disk | 0 spawns, 0 fs.write* | static review | grep |

---

## Acceptance Criteria

### AC-1: Two concurrent starts both succeed

```gherkin
Given no scaffolds running
When the user starts instance A in Terminal 1, then instance B in Terminal 2
Then instance A binds 127.0.0.1:5174
And instance B binds 127.0.0.1:5175
And ~/.forgeplan-web/instances.json contains exactly two rows
And both browsers can reach their respective servers
```

### AC-2: Stale sweep on next start

```gherkin
Given instance A is registered with PID X
And process X is killed with SIGKILL (no chance to deregister)
When the user runs `start` again (instance B)
Then ~/.forgeplan-web/instances.json contains exactly one row (instance B)
And the dead PID X row was removed
```

### AC-3: GET /api/instances returns the live registry

```gherkin
Given two instances are running
When a browser fetches GET http://127.0.0.1:5174/api/instances
Then the response is JSON with shape { ok: true, data: { instances: [...] } }
And data.instances has exactly 2 entries
And each entry has fields per SPEC-003 v1
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| PRD-026 (start chain) | Internal | Drafted | docs-eng-109 |
| PRD-025 (user-scope path) | Internal | Drafted | docs-eng-109 |
| ADR-004 (registry path & format) | Internal | Drafted (parallel) | adr-architect-109 |
| SPEC-003 (registry schema) | Internal | This PRD defines it | docs-eng-109 |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Concurrent atomic writes lose updates (last-write-wins) | Medium | Medium | Read-modify-write inside try-locked region using lockfile (e.g. `proper-lockfile`); accept "last-writer-wins for the same row" semantic for MVP since heartbeats are idempotent | dev |
| R-2 | Windows rename across drives fails | Low | Medium | tmp file in same dir as target (always) | dev |
| R-3 | PID-recycling — new process gets old PID | Very low | Low | Heartbeat freshness check catches it (>60s = dead even if PID alive) | dev |
| R-4 | `process.kill(pid, 0)` permission errors on Windows | Low | Low | Catch EPERM as "alive" (process exists, we just can't signal); document | dev |
| R-5 | `~/.forgeplan-web/` doesn't exist when first start runs | Medium | Low | Auto-create dir on first registry write | dev |
| R-6 | Heartbeat survives crashed UI but dies later → window > 60s | Low | Low | 60s window is intentional buffer; sweep on next start catches | dev |

---

## Affected Files

- `bin/lib/registry.mjs` (NEW) — pure helpers
- `bin/commands/start.mjs` — port allocator + sweep + appendInstance + signal handlers
- `template/src/shared/server/registry.ts` (NEW) — server-side reader
- `template/src/shared/server/heartbeat.ts` (NEW) — `setInterval` lifecycle
- `template/src/routes/api/instances/+server.ts` (NEW) — read-only endpoint
- `template/src/hooks.server.ts` — start the heartbeat lifecycle
- `.forgeplan/specs/SPEC-003-instance-registry-json-schema-forgeplan-web-instances-json.md` — schema
- `scripts/smoke.mjs` — concurrent start asserts
- GitHub sub-issue: #113 (109d)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-026 | Depends on (start chain) | Draft |
| PRD-025 | Depends on (`~/.forgeplan-web/`) | Draft |
| RFC-023 | Architecture | Draft |
| ADR-004 | Decision (registry path & format) | Proposed (parallel) |
| SPEC-003 | Defines (this PRD's schema) | Draft |
| PRD-029 | Consumed by (HealthBar switcher) | Draft |
| GitHub #113 | Source sub-issue | Open |

---

> **Next step**: Land alongside RFC-023 + SPEC-003. PRD-029 consumes `/api/instances`.








