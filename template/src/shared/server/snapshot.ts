import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm as fsRm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runForgeplan, workspaceRoot } from "./forgeplan";

// FIXME(F18-T1): `forgeplan journal --json --until=ISO` does not exist in CLI
// 0.28.0 — RFC-007 Path D pivots to git-based reconstruction. See RFC-007
// "Snapshot reconstruction algorithm" for the full rationale.

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const SHA_RE = /^[0-9a-f]{40}$/;

const SNAPSHOT_CACHE_TTL_MS = 60_000;
const SNAPSHOT_CACHE_MAX_ENTRIES = 32;
const SNAPSHOT_DISK_CACHE_DIR = ".forgeplan-web/.snapshots";
const WORKTREE_TMP_PREFIX = "fpw-snap-";
const GIT_TIMEOUT_MS = 10_000;
const FORGEPLAN_LIST_TIMEOUT_MS = 15_000;

export interface ArtifactSnapshot {
  id: string;
  kind: string;
  status: string;
  title: string;
  [extra: string]: unknown;
}

export interface EdgeSnapshot {
  from: string;
  to: string;
  relation: string;
}

export interface SnapshotData {
  sha: string;
  artifacts: ArtifactSnapshot[];
  edges: EdgeSnapshot[];
}

export interface SnapshotResult {
  ok: boolean;
  at: string;
  sha?: string;
  snapshot?: SnapshotData;
  error?: string;
  status?: number;
  fromCache?: "memory" | "disk" | null;
}

interface MemoryCacheEntry {
  data: SnapshotData;
  storedAt: number;
}

const memoryCache = new Map<string, MemoryCacheEntry>();

interface SpawnResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

function spawnGit(
  args: string[],
  cwd: string,
  timeoutMs = GIT_TIMEOUT_MS,
): Promise<SpawnResult> {
  return new Promise((resolveResult) => {
    const child = spawn("git", args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolveResult({
        ok: false,
        stdout,
        stderr: `${stderr}\ngit timeout after ${timeoutMs}ms`.trim(),
        code: null,
      });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolveResult({ ok: false, stdout, stderr: err.message, code: null });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolveResult({ ok: code === 0, stdout, stderr, code });
    });
  });
}

function isValidIso(at: string): boolean {
  if (!ISO_RE.test(at)) return false;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  if (t > Date.now()) return false;
  return true;
}

async function resolveCommitSha(at: string): Promise<string | null> {
  const root = workspaceRoot();
  const r = await spawnGit(
    [
      "rev-list",
      "-1",
      `--before=${at}`,
      "--first-parent",
      "HEAD",
      "--",
      ".forgeplan/",
    ],
    root,
  );
  if (!r.ok) return null;
  const sha = r.stdout.trim();
  if (!sha || !SHA_RE.test(sha)) return null;
  return sha;
}

function memoryCacheGet(sha: string): SnapshotData | null {
  const entry = memoryCache.get(sha);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > SNAPSHOT_CACHE_TTL_MS) {
    memoryCache.delete(sha);
    return null;
  }
  memoryCache.delete(sha);
  memoryCache.set(sha, entry);
  return entry.data;
}

function memoryCacheSet(sha: string, data: SnapshotData): void {
  if (memoryCache.size >= SNAPSHOT_CACHE_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(sha, { data, storedAt: Date.now() });
}

async function diskCacheGet(sha: string): Promise<SnapshotData | null> {
  const path = join(workspaceRoot(), SNAPSHOT_DISK_CACHE_DIR, `${sha}.json`);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as SnapshotData;
  } catch {
    // FIXME(disk-cache): malformed cache file silently ignored. Should log + delete.
    return null;
  }
}

async function diskCacheSet(sha: string, data: SnapshotData): Promise<void> {
  const dir = join(workspaceRoot(), SNAPSHOT_DISK_CACHE_DIR);
  await mkdir(dir, { recursive: true });
  const finalPath = join(dir, `${sha}.json`);
  const tmpPath = `${finalPath}.tmp.${process.pid}`;
  await writeFile(tmpPath, JSON.stringify(data), "utf8");
  await rename(tmpPath, finalPath);
}

async function reconstructFromWorktree(
  sha: string,
): Promise<SnapshotData | null> {
  const root = workspaceRoot();
  const tmpBase = await mkdtemp(join(tmpdir(), WORKTREE_TMP_PREFIX));
  let worktreeAdded = false;
  try {
    const add = await spawnGit(
      ["worktree", "add", "--detach", tmpBase, sha],
      root,
    );
    if (!add.ok) {
      // FIXME(worktree-add): surface specific failure modes (shallow clone, lock,
      // disk full) to caller — currently collapses to a generic null.
      return null;
    }
    worktreeAdded = true;

    const [listResult, graphResult] = await Promise.all([
      runForgeplan<ArtifactSnapshot[]>(["list", "--json"], {
        cwd: tmpBase,
        timeoutMs: FORGEPLAN_LIST_TIMEOUT_MS,
      }),
      runForgeplan<{ edges?: EdgeSnapshot[] }>(["graph", "--json"], {
        cwd: tmpBase,
        timeoutMs: FORGEPLAN_LIST_TIMEOUT_MS,
      }),
    ]);

    if (!listResult.ok || !Array.isArray(listResult.data)) return null;
    const artifacts = listResult.data;
    const edges = graphResult.ok ? (graphResult.data?.edges ?? []) : [];

    return { sha, artifacts, edges };
  } finally {
    if (worktreeAdded) {
      const removed = await spawnGit(
        ["worktree", "remove", "--force", tmpBase],
        root,
      );
      if (!removed.ok) {
        // FIXME(worktree-leak): `git worktree prune` cleans these on next git op.
        // Surface this via an ops counter / log line in a future iteration.
      }
    } else {
      try {
        await fsRm(tmpBase, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    }
  }
}

export async function getSnapshot(at: string): Promise<SnapshotResult> {
  if (!isValidIso(at)) {
    return {
      ok: false,
      at,
      error: "invalid 'at' parameter — expected ISO 8601, not in the future",
      status: 400,
    };
  }

  const sha = await resolveCommitSha(at);
  if (!sha) {
    // No commit before `at` touches `.forgeplan/` — workspace was empty then.
    return {
      ok: true,
      at,
      snapshot: { sha: "", artifacts: [], edges: [] },
      fromCache: null,
    };
  }

  const mem = memoryCacheGet(sha);
  if (mem) {
    return { ok: true, at, sha, snapshot: mem, fromCache: "memory" };
  }

  const disk = await diskCacheGet(sha);
  if (disk) {
    memoryCacheSet(sha, disk);
    return { ok: true, at, sha, snapshot: disk, fromCache: "disk" };
  }

  const built = await reconstructFromWorktree(sha);
  if (!built) {
    return {
      ok: false,
      at,
      sha,
      error: "snapshot reconstruction failed (git worktree or forgeplan list)",
      status: 502,
    };
  }

  memoryCacheSet(sha, built);
  diskCacheSet(sha, built).catch(() => {
    // FIXME(disk-cache-write): persist failure silently swallowed. Acceptable
    // for cache layer (next request just retries); add ops log later.
  });

  return { ok: true, at, sha, snapshot: built, fromCache: null };
}

// TODO(F18-T6): export async function compareSnapshots(at1, at2):
//   parallel getSnapshot calls + diff projection (added / activated /
//   superseded / degraded). `degraded` requires R_eff via
//   `forgeplan score --json` per artifact — verify shape in T6.
