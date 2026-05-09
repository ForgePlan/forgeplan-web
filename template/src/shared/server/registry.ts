import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// PRD-027 / SPEC-003 / ADR-004 / RFC-023 — server-side READ-ONLY view of the
// instance registry at `~/.forgeplan-web/instances.json`. Mutations live in
// `bin/lib/registry.mjs`; this module never writes. The two implementations
// must stay in sync on schema/path/sweep semantics — they do not share a
// module because bin/* is JS, template/* is TS bundled by vite.

const SCHEMA_VERSION = 1 as const;
const HEARTBEAT_STALE_MS = 60_000;
const REGISTRY_DIR = ".forgeplan-web";
const REGISTRY_FILENAME = "instances.json";
const CACHE_TTL_MS = 500;
const CMD_LABEL = "registry:read";

export type InstanceScope = "user" | "project";

export interface Instance {
  id: string;
  host: string;
  port: number;
  pid: number;
  scope: InstanceScope;
  workspaceRoot: string;
  projectName: string;
  startedAt: string;
  heartbeatAt: string;
  webVersion: string;
  forgeplanCli: string | null;
}

export interface RegistryFile {
  version: typeof SCHEMA_VERSION;
  instances: Instance[];
}

export interface RegistryReadResult {
  ok: true;
  data: { instances: Instance[] };
  cmd: typeof CMD_LABEL;
}

function registryPath(): string {
  return join(homedir(), REGISTRY_DIR, REGISTRY_FILENAME);
}

function emptyRegistry(): RegistryFile {
  return { version: SCHEMA_VERSION, instances: [] };
}

function isInstance(raw: unknown): raw is Instance {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.host === "string" &&
    typeof r.port === "number" &&
    typeof r.pid === "number" &&
    (r.scope === "user" || r.scope === "project") &&
    typeof r.workspaceRoot === "string" &&
    typeof r.projectName === "string" &&
    typeof r.startedAt === "string" &&
    typeof r.heartbeatAt === "string" &&
    typeof r.webVersion === "string" &&
    (r.forgeplanCli === null || typeof r.forgeplanCli === "string")
  );
}

function readRegistryRaw(): RegistryFile {
  const p = registryPath();
  if (!existsSync(p)) return emptyRegistry();
  let raw: string;
  try {
    raw = readFileSync(p, "utf8");
  } catch {
    return emptyRegistry();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // FIXME(corrupt-registry): unreadable JSON treated as empty; bin/ rewrites on next register.
    return emptyRegistry();
  }
  if (!parsed || typeof parsed !== "object") return emptyRegistry();
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== SCHEMA_VERSION) {
    // Unknown / future schema → treat as empty (forward-only migration).
    return emptyRegistry();
  }
  if (!Array.isArray(obj.instances)) return emptyRegistry();
  const instances: Instance[] = [];
  for (const row of obj.instances) {
    if (isInstance(row)) instances.push(row);
    // FIXME(schema-violation): silently dropping malformed rows; SPEC-003 says log.
  }
  return { version: SCHEMA_VERSION, instances };
}

function isAlive(pid: number, heartbeatAt: string): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  const t = Date.parse(heartbeatAt);
  if (Number.isFinite(t) && Date.now() - t > HEARTBEAT_STALE_MS) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EPERM") return true; // exists, owned by another user (Win)
    return false;
  }
}

function sweep(reg: RegistryFile): Instance[] {
  return reg.instances.filter((row) => isAlive(row.pid, row.heartbeatAt));
}

let cache: { ts: number; instances: Instance[] } | null = null;
let inflight: Promise<Instance[]> | null = null;

function readInstancesFresh(): Instance[] {
  return sweep(readRegistryRaw());
}

export async function readInstances(): Promise<Instance[]> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) return cache.instances;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const instances = readInstancesFresh();
      cache = { ts: Date.now(), instances };
      return instances;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const REGISTRY_CMD_LABEL = CMD_LABEL;
