---
depth: standard
id: RFC-023
kind: rfc
links:
- target: PRD-027
  relation: based_on
status: draft
title: Port allocator, pid-liveness probe, atomic registry writes
---

---
id: RFC-023
title: "Port allocator, pid-liveness probe, atomic registry writes"
status: Draft
author: docs-eng-109
created: 2026-05-08
updated: 2026-05-08
prd: PRD-027
depth: standard
---

# RFC-023: Port allocator, pid-liveness probe, atomic registry writes

## Summary

Specify the three load-bearing algorithms for PRD-027: (1) port
allocator that walks `[PORT, PORT+100]` until first free; (2) PID
liveness probe via `process.kill(pid, 0)` plus heartbeat freshness
window (>60s = dead); (3) atomic registry writes via tmp+rename in the
same directory. Plus the heartbeat lifecycle and signal-handler
deregister flow.

## Motivation

PRD-027 lists multiple load-bearing primitives. Each has alternative
implementations with different trade-offs (random port vs incremental;
PID-only vs PID+heartbeat; lockfile vs tmp+rename). Locking the choice
in an RFC prevents drift during implementation and gives reviewers a
stable target.

## Goals

- Port allocator: deterministic, bounded, fast.
- Liveness: portable across POSIX and Windows.
- Writes: never produce invalid JSON under concurrency.
- Heartbeat: cheap, periodic, side-effect-bounded.

## Non-Goals

- Cross-host coordination.
- Auth / capability tokens.
- TLS / HTTPS port handling.

## Options Considered

### Port allocator

#### Option A: Increment from PORT (CHOSEN)

**Description**: Try `PORT`, then `PORT+1`, …, `PORT+100`. Use
`net.createServer().listen({port, host}, ...)` and listen for
`error.code === 'EADDRINUSE'` to advance.

**Pros**:
- Predictable port numbers (humans like 5174, 5175, 5176).
- Easy to debug ("the third instance is on 5176").

**Cons**:
- Sequential probes can take up to 100× the bind latency in the worst
  case (~100ms total).

#### Option B: Random in range

**Description**: Pick random in `[PORT, PORT+1000)`.

**Pros**:
- Lower collision probability under bursty starts.

**Cons**:
- Unpredictable port numbers — bad UX.
- Still needs collision retry.

#### Option C: External allocator service

**Description**: Coordinator process hands out ports.

**Pros**:
- No collisions.

**Cons**:
- Massive overkill; introduces a long-running daemon.

### PID liveness

#### Option A: `process.kill(pid, 0)` + heartbeat freshness (CHOSEN)

**Description**: Send signal 0 (no-op probe) — throws ESRCH if dead,
EPERM if alive but unsignal-able. Combined with `now - heartbeatAt > 60s`
to detect frozen processes that still own a PID.

**Pros**:
- POSIX-standard; Node implements it on Windows too.
- Catches PID recycling via heartbeat.
- No third-party dep.

**Cons**:
- EPERM on Windows for processes from other users — treat as alive
  (conservative).

#### Option B: PID-only probe

**Description**: Just `process.kill(pid, 0)` without heartbeat freshness.

**Pros**:
- Simpler.

**Cons**:
- Misses PID-recycled rows.
- Misses frozen-but-alive processes.

#### Option C: Health-ping on the registered HTTP port

**Description**: Try to fetch `/api/health` on `host:port` from each row.

**Pros**:
- Authoritative.

**Cons**:
- Requires HTTP timeout; sweep becomes slow (50ms × 100 = 5s).
- HTTP could fail for non-liveness reasons (firewall, GC pause).

### Atomic writes

#### Option A: tmp+rename in same dir (CHOSEN)

**Description**: Write to `instances.json.tmp.<pid>` then
`fs.renameSync` to `instances.json`. Same directory ensures atomic
rename even on Windows.

**Pros**:
- POSIX `rename(2)` is atomic at the syscall level.
- Same-dir tmp avoids cross-fs ENOTSUP on Windows.

**Cons**:
- Two writes (one to tmp, one rename).

#### Option B: Lockfile

**Description**: `proper-lockfile` package wraps RW with a separate
.lock file.

**Pros**:
- Provides true mutex semantics (read-modify-write).

**Cons**:
- New runtime dep (rule 23 — server side, but still an extra dep).
- Stale lock recovery is its own problem.

#### Option C: Append-only log with periodic compaction

**Description**: Each instance appends one JSON line; reader fold-
reduces.

**Pros**:
- No write conflicts ever.

**Cons**:
- Compaction is its own consistency problem.
- File grows unbounded between compactions.

## Trade-off Analysis

### Port allocator

| Критерий | A: increment (chosen) | B: random | C: service |
|----------|-----------------------|-----------|------------|
| Predictability | High | Low | High |
| Probe latency (worst) | ~100ms | ~5ms | ~5ms |
| Implementation cost | Low | Low | Very high |
| Operational burden | None | None | High (daemon) |

### PID liveness

| Критерий | A: kill(pid,0)+heartbeat (chosen) | B: PID-only | C: HTTP ping |
|----------|----------------------------------|-------------|--------------|
| Accuracy | High | Medium | High |
| Sweep latency (100 entries) | ~10ms | ~5ms | ~5000ms |
| Cross-platform | High | High | Medium |
| Implementation cost | Low | Lowest | Medium |

### Atomic writes

| Критерий | A: tmp+rename (chosen) | B: lockfile | C: append-log |
|----------|------------------------|-------------|---------------|
| Implementation cost | Low | Medium (new dep) | Medium |
| Concurrency safety | High (atomic rename) | High (mutex) | Highest |
| Write latency | < 10ms | ~20ms | < 5ms |
| Read latency | < 5ms | < 5ms | Medium (fold) |
| File-size growth | Bounded | Bounded | Unbounded |

## Proposed Direction

**Port allocator**: Option A (increment). **Liveness**: Option A
(kill+heartbeat). **Writes**: Option A (tmp+rename).

```js
// bin/lib/registry.mjs
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveUserScopeRoot } from './scope.mjs';

const SCHEMA_VERSION = 1;
const HEARTBEAT_STALE_MS = 60_000;

function registryPath() {
  return join(resolveUserScopeRoot(), 'instances.json');
}

export function readRegistry() {
  const p = registryPath();
  if (!existsSync(p)) return { version: SCHEMA_VERSION, instances: [] };
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    if (raw?.version !== SCHEMA_VERSION) {
      // TODO(spec-003-v2-migration): migrate older versions when schema bumps.
      return { version: SCHEMA_VERSION, instances: [] };
    }
    return raw;
  } catch {
    // Corrupt file; treat as empty. Next write replaces.
    return { version: SCHEMA_VERSION, instances: [] };
  }
}

export function writeRegistry(reg) {
  const p = registryPath();
  mkdirSync(resolveUserScopeRoot(), { recursive: true });
  const tmp = `${p}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(reg, null, 2) + '\n');
  renameSync(tmp, p);
}

export function isAlive(pid, heartbeatAt) {
  if (typeof pid !== 'number' || pid <= 0) return false;
  const stale = Date.now() - new Date(heartbeatAt).getTime() > HEARTBEAT_STALE_MS;
  if (stale) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e.code === 'EPERM') return true; // exists, can't signal
    return false; // ESRCH or other
  }
}

export function sweepStale(reg) {
  return {
    version: reg.version,
    instances: reg.instances.filter((i) => isAlive(i.pid, i.heartbeatAt)),
  };
}

export function appendInstance(instance) {
  const reg = sweepStale(readRegistry());
  reg.instances = [...reg.instances.filter((i) => i.id !== instance.id), instance];
  writeRegistry(reg);
}

export function removeInstance(id) {
  const reg = readRegistry();
  reg.instances = reg.instances.filter((i) => i.id !== id);
  writeRegistry(reg);
}
```

Port allocator:

```js
// bin/lib/port-allocator.mjs
import net from 'node:net';

export async function findFreePort({ host, basePort, maxOffset = 100 }) {
  for (let offset = 0; offset <= maxOffset; offset++) {
    const port = basePort + offset;
    if (await tryBind(host, port)) return port;
  }
  throw new Error(`no free port in [${basePort}, ${basePort + maxOffset}]`);
}

function tryBind(host, port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen({ port, host });
  });
}
```

Heartbeat lifecycle (server-side):

```ts
// template/src/shared/server/heartbeat.ts
import { writeRegistry, readRegistry } from './registry';
const HEARTBEAT_MS = 30_000;

export function startHeartbeat(instanceId: string) {
  const tick = () => {
    const reg = readRegistry();
    const idx = reg.instances.findIndex((i) => i.id === instanceId);
    if (idx >= 0) {
      reg.instances[idx].heartbeatAt = new Date().toISOString();
      writeRegistry(reg);
    }
  };
  const handle = setInterval(tick, HEARTBEAT_MS);
  handle.unref?.(); // don't block exit
  return () => clearInterval(handle);
}
```

Deregister on signals (in `bin/commands/start.mjs`):

```js
const cleanup = () => removeInstance(instanceId);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('beforeExit', cleanup);
```

## Risks & Open Questions

- **R-1: Race in append-time sweep.** Two starts may both read+sweep+
  write concurrently; the later write overwrites the earlier. Same-PID
  rows are idempotent (sweep already filters dead). For different-PID
  concurrent starts, the rare loss-of-row is recovered on next start.
  Acceptable for MVP. Lockfile is the upgrade path.
- **R-2: PID recycling on long-uptime hosts.** Heartbeat freshness
  catches it; 60s window is conservative.
- **R-3: SIGKILL leaves stale row** until next start. Documented;
  sweep handles.
- **R-4: Heartbeat fights atomic-write contention** if 100 instances
  all heartbeat at the same time. Cap concurrent instances at 100
  (port allocator already does this). 100 writes / 30s = 3.3 writes/s
  globally — well within fs throughput.
- **OQ-1**: Should we expose `forgeplan-web doctor` to manually clean
  the registry? Out of scope for MVP; growth.
- **OQ-2**: Should heartbeat skip when registry file is missing
  (deleted by hand)? Yes — re-create on next tick.

## Implementation Phases

### Phase 1: Pure helpers

- [ ] **1.1** `bin/lib/registry.mjs` with read/write/append/remove/sweep.
- [ ] **1.2** `bin/lib/port-allocator.mjs` with `findFreePort`.
- [ ] **1.3** Unit tests covering: parse-corrupt, atomic-write, sweep
  with mixed alive/dead PIDs, port allocator hits/misses.

### Phase 2: Wire start

- [ ] **2.1** `start.mjs` resolves scaffold → calls `findFreePort` →
  builds instance row → `appendInstance` → spawns server with `PORT`
  set to allocated port.
- [ ] **2.2** Signal handlers in `start.mjs` call `removeInstance`.

### Phase 3: Wire server

- [ ] **3.1** `template/src/hooks.server.ts` calls `startHeartbeat()`
  with the instance ID passed via env (`FORGEPLAN_WEB_INSTANCE_ID`).
- [ ] **3.2** `template/src/routes/api/instances/+server.ts` reads
  registry and returns envelope.

### Phase 4: Stress + smoke

- [ ] **4.1** Stress: 10 parallel starts → assert all rows valid JSON,
  no duplicates, no port collisions.
- [ ] **4.2** Smoke: SIGKILL → next start sweeps.
- [ ] **4.3** Smoke: SIGINT → row removed gracefully.

## Affected Files

- `bin/lib/registry.mjs` (NEW)
- `bin/lib/port-allocator.mjs` (NEW)
- `bin/commands/start.mjs`
- `template/src/shared/server/registry.ts` (NEW)
- `template/src/shared/server/heartbeat.ts` (NEW)
- `template/src/routes/api/instances/+server.ts` (NEW)
- `template/src/hooks.server.ts`
- `scripts/test/registry.test.mjs` (NEW)
- `scripts/smoke.mjs`

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| PRD-027 | PRD | based_on |
| ADR-004 | ADR | decided_by (path & format) |
| SPEC-003 | Spec | implements |
| RFC-022 | RFC | informs (start integrates here) |
| PRD-029 | PRD | informs (consumes /api/instances) |
| GitHub #113 | Issue | implements |

---

> **Next step**: Land alongside PRD-027 + SPEC-003.


