// RFC-035 (Wave 2, FR-6) — a minimal writer for the shared instance
// registry at `~/.forgeplan-web/instances.json` (PRD-027 / SPEC-003 /
// ADR-004). This module reuses that registry's WIRE FORMAT (schema
// version, atomic tmp+rename write, read-modify-write, heartbeat-driven
// liveness) WITHOUT importing the core package's `bin/lib/registry.mjs` —
// `@forgeplan/web-agent` is a SEPARATE npm package and cannot depend on the
// core package's `bin/` at the user's runtime (rule 23 / ADR-010: the SDK
// dependency lives only in this package; the inverse also holds — this
// package cannot reach back into the core package's files).
//
// Every row this module writes carries an additive `kind: "agent"` field
// (and `scope: "agent"`, distinct from the core registry's `"user"` /
// `"project"` scopes) so a reader can tell an onboard-agent daemon row
// apart from a forgeplan-web instance row. node:*-only (fs, path, os) — no
// new runtime deps (agent/package.json is otherwise unaffected).
//
// Fail-open by design: every exported function swallows its own fs/parse
// errors and logs to stderr instead of throwing. The daemon's core job
// (serving the onboarding WS chat) must never go down because this
// diagnostics side-channel is unwritable (e.g. a read-only home dir).

import { homedir } from "node:os";
import { basename, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";

const SCHEMA_VERSION = 1;
const REGISTRY_DIRNAME = ".forgeplan-web";
const REGISTRY_FILENAME = "instances.json";
const HEARTBEAT_STALE_MS = 60_000;
const HOST = "127.0.0.1";

/**
 * This process's own registered row(s), keyed by id, minus `heartbeatAt`
 * (always refreshed at write time). Populated by `registerAgent`, read by
 * `heartbeatAgent` to re-insert a full row if a concurrent writer's
 * read-modify-write raced it out of the file, cleared by
 * `deregisterAgent`. Deliberately in-memory-only — this module never reads
 * it back from disk, matching the core registry's own documented
 * best-effort reconcile behaviour (bin/lib/registry.mjs#heartbeat).
 */
const lastKnownRow = new Map();

function registryDir() {
  return join(homedir(), REGISTRY_DIRNAME);
}

function registryPath() {
  return join(registryDir(), REGISTRY_FILENAME);
}

function emptyRegistry() {
  return { version: SCHEMA_VERSION, instances: [] };
}

function readRegistry() {
  const p = registryPath();
  if (!existsSync(p)) return emptyRegistry();
  let raw;
  try {
    raw = readFileSync(p, "utf8");
  } catch {
    return emptyRegistry();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // FIXME(corrupt-registry): unreadable JSON treated as empty; next write replaces.
    return emptyRegistry();
  }
  if (!parsed || typeof parsed !== "object") return emptyRegistry();
  if (parsed.version !== SCHEMA_VERSION) {
    // TODO(registry-schema-migration): translate older versions when schema bumps.
    return emptyRegistry();
  }
  if (!Array.isArray(parsed.instances)) return emptyRegistry();
  return { version: SCHEMA_VERSION, instances: parsed.instances };
}

function writeRegistryAtomic(reg) {
  const dir = registryDir();
  mkdirSync(dir, { recursive: true });
  const p = registryPath();
  const tmp = `${p}.tmp.${process.pid}.${Date.now()}`;
  const payload = JSON.stringify(
    { version: SCHEMA_VERSION, instances: reg.instances },
    null,
    2,
  );
  writeFileSync(tmp, payload + "\n");
  renameSync(tmp, p);
}

function isAlive(pid, heartbeatAt) {
  if (typeof pid !== "number" || !Number.isFinite(pid) || pid <= 0) {
    return false;
  }
  if (typeof heartbeatAt === "string") {
    const t = Date.parse(heartbeatAt);
    if (Number.isFinite(t) && Date.now() - t > HEARTBEAT_STALE_MS) {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM — process exists but is owned by another user; treat as alive
    // (matches the core registry's conservative choice, RFC-023).
    if (e && e.code === "EPERM") return true;
    return false;
  }
}

function sweepStale(reg) {
  return {
    version: SCHEMA_VERSION,
    instances: (reg?.instances ?? []).filter((row) =>
      isAlive(row?.pid, row?.heartbeatAt),
    ),
  };
}

export function makeAgentId(port) {
  return `agent:${HOST}:${port}`;
}

/**
 * Registers this daemon in the shared registry (after sweeping stale
 * rows) and returns the row's `id` for later `heartbeatAgent` /
 * `deregisterAgent` calls. Fail-open — a write fault is logged to stderr
 * and swallowed; callers get the id back regardless so `ready` frames can
 * still reference it (a subsequent `readOtherLiveInstances` call simply
 * won't find this row on disk if the write failed).
 */
export function registerAgent({ port, cwd, protocolVersion }) {
  const id = makeAgentId(port);
  const now = new Date().toISOString();
  const row = {
    id,
    host: HOST,
    port,
    pid: process.pid,
    kind: "agent",
    scope: "agent",
    workspaceRoot: cwd,
    projectName: basename(cwd),
    startedAt: now,
    heartbeatAt: now,
    webVersion: null,
    forgeplanCli: null,
    protocolVersion,
  };
  lastKnownRow.set(id, row);
  try {
    const swept = sweepStale(readRegistry());
    const without = swept.instances.filter((r) => r.id !== id);
    writeRegistryAtomic({
      version: SCHEMA_VERSION,
      instances: [...without, row],
    });
  } catch (err) {
    process.stderr.write(
      `onboard-agent: registry register failed (non-fatal): ${err?.message ?? err}\n`,
    );
  }
  return id;
}

/**
 * Refreshes this daemon's `heartbeatAt` so `isAlive`/`sweepStale` (here and
 * on any reader) keep treating it as live. If the row was lost — e.g. a
 * concurrent writer's read-modify-write raced it out — re-inserts the full
 * row captured at `registerAgent` time (with a fresh `heartbeatAt`) rather
 * than silently no-opping, since this module knows its own row shape and
 * the core registry's simplicity budget doesn't need to apply here.
 */
export function heartbeatAgent(id) {
  try {
    const reg = readRegistry();
    const idx = reg.instances.findIndex((r) => r.id === id);
    const now = new Date().toISOString();
    let instances;
    if (idx >= 0) {
      instances = reg.instances.map((r, i) =>
        i === idx ? { ...r, heartbeatAt: now } : r,
      );
    } else {
      const known = lastKnownRow.get(id);
      if (!known) return; // nothing to re-add from — never registered, or already deregistered
      instances = [...reg.instances, { ...known, heartbeatAt: now }];
    }
    writeRegistryAtomic({ version: SCHEMA_VERSION, instances });
  } catch (err) {
    process.stderr.write(
      `onboard-agent: registry heartbeat failed (non-fatal): ${err?.message ?? err}\n`,
    );
  }
}

/**
 * Removes this daemon's row from the shared registry. Safe to call even if
 * the row was never successfully written (e.g. `registerAgent` failed) or
 * was already removed — a missing id is simply not found by the filter.
 */
export function deregisterAgent(id) {
  lastKnownRow.delete(id);
  try {
    const reg = readRegistry();
    const instances = reg.instances.filter((r) => r.id !== id);
    writeRegistryAtomic({ version: SCHEMA_VERSION, instances });
  } catch (err) {
    process.stderr.write(
      `onboard-agent: registry deregister failed (non-fatal): ${err?.message ?? err}\n`,
    );
  }
}

/**
 * Reads every OTHER live instance in the shared registry (any `kind` — web
 * or agent), sweeping stale rows via `process.kill(pid,0)` + 60s heartbeat
 * freshness (same liveness contract as the web instance switcher), mapped
 * to the Info-tab-friendly shape `{ projectName, port, kind }`. Rows
 * without a `kind` field (pre-RFC-035 web rows) default to `"web"`.
 * Fail-open — any fs/parse error yields `[]`.
 */
export function readOtherLiveInstances(selfId) {
  try {
    const swept = sweepStale(readRegistry());
    return swept.instances
      .filter((r) => r?.id !== selfId)
      .map((r) => ({
        projectName: typeof r.projectName === "string" ? r.projectName : "?",
        port: typeof r.port === "number" ? r.port : 0,
        kind: typeof r.kind === "string" ? r.kind : "web",
      }));
  } catch (err) {
    process.stderr.write(
      `onboard-agent: registry read failed (non-fatal): ${err?.message ?? err}\n`,
    );
    return [];
  }
}
