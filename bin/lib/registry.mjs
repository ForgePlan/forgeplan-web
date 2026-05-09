import net from "node:net";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { userScopePath } from "./scope.mjs";

// PRD-027 / SPEC-003 / ADR-004: instance registry helpers. Pure node:* +
// relative siblings only (rule 23). Mutations live here in bin/; the
// SvelteKit server reads via template/src/shared/server/registry.ts.

export const SCHEMA_VERSION = 1;
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_STALE_MS = 60_000;
export const REGISTRY_FILENAME = "instances.json";

export const PORT_PROBE_MAX_OFFSET = 100;

export function registryDir() {
  return userScopePath();
}

export function registryPath() {
  return join(registryDir(), REGISTRY_FILENAME);
}

function emptyRegistry() {
  return { version: SCHEMA_VERSION, instances: [] };
}

export function readRegistry() {
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
    // TODO(spec-003-v2-migration): translate older versions when schema bumps.
    return emptyRegistry();
  }
  if (!Array.isArray(parsed.instances)) return emptyRegistry();
  return { version: SCHEMA_VERSION, instances: parsed.instances };
}

function ensureNotSymlink(p) {
  if (!existsSync(p)) return;
  const st = lstatSync(p);
  if (st.isSymbolicLink()) {
    // ADR-004 R6 — symlink defence; refuse to follow.
    throw new Error(
      `forgeplan-web: refusing to write through symlink: ${p}`,
    );
  }
}

export function writeRegistryAtomic(reg) {
  const dir = registryDir();
  mkdirSync(dir, { recursive: true });
  const p = registryPath();
  ensureNotSymlink(p);
  const tmp = `${p}.tmp.${process.pid}.${Date.now()}`;
  const payload = JSON.stringify(
    { version: SCHEMA_VERSION, instances: reg.instances },
    null,
    2,
  );
  writeFileSync(tmp, payload + "\n");
  renameSync(tmp, p);
}

export function isAlive(pid, heartbeatAt) {
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
    // EPERM on Windows — process exists but is owned by another user;
    // treat as alive (conservative, RFC-023 chosen option).
    if (e && e.code === "EPERM") return true;
    return false;
  }
}

export function sweepStale(reg) {
  return {
    version: SCHEMA_VERSION,
    instances: (reg?.instances ?? []).filter((row) =>
      isAlive(row?.pid, row?.heartbeatAt),
    ),
  };
}

export function register(entry) {
  const swept = sweepStale(readRegistry());
  const without = swept.instances.filter((row) => row.id !== entry.id);
  const next = { version: SCHEMA_VERSION, instances: [...without, entry] };
  writeRegistryAtomic(next);
  return next;
}

export function deregister(id) {
  // RACE: read-modify-write window ~5ms. ADR-004 §5 acceptable for ≤10
  // instances; last-writer wins on rename. Heartbeat reconciles within 30s.
  const reg = readRegistry();
  const next = {
    version: SCHEMA_VERSION,
    instances: reg.instances.filter((row) => row.id !== id),
  };
  writeRegistryAtomic(next);
  return next;
}

export function heartbeat(id) {
  const reg = readRegistry();
  const idx = reg.instances.findIndex((row) => row.id === id);
  if (idx < 0) return reg;
  const updated = {
    ...reg.instances[idx],
    heartbeatAt: new Date().toISOString(),
  };
  const next = {
    version: SCHEMA_VERSION,
    instances: reg.instances.map((row, i) => (i === idx ? updated : row)),
  };
  writeRegistryAtomic(next);
  return next;
}

function tryBind(host, port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      try {
        srv.close(() => resolve(ok));
      } catch {
        resolve(ok);
      }
    };
    srv.once("error", () => finish(false));
    srv.once("listening", () => finish(true));
    try {
      srv.listen({ port, host, exclusive: true });
    } catch {
      finish(false);
    }
  });
}

export async function findFreePort({
  host = "127.0.0.1",
  basePort,
  maxOffset = PORT_PROBE_MAX_OFFSET,
} = {}) {
  if (typeof basePort !== "number" || basePort < 1 || basePort > 65_535) {
    throw new Error(`findFreePort: invalid basePort ${basePort}`);
  }
  for (let offset = 0; offset <= maxOffset; offset++) {
    const port = basePort + offset;
    if (port > 65_535) break;
    // eslint-disable-next-line no-await-in-loop
    const ok = await tryBind(host, port);
    if (ok) return port;
  }
  throw new Error(
    `forgeplan-web: no free port in [${basePort}, ${basePort + maxOffset}] on ${host}`,
  );
}

export function makeInstanceId(host, port) {
  return `${host}:${port}`;
}
