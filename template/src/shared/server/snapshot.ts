import { execFileSync, spawn } from "node:child_process";
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

// Sanitisation budget for stderr excerpts surfaced through /api/snapshot.
// RFC-015 §I-4 caps response stderr at ≤ 1024 chars including the ellipsis
// suffix; truncation happens at a word boundary.
const STDERR_MAX_LEN = 1023;

export type ArtifactSnapshotKind =
  | "prd"
  | "rfc"
  | "adr"
  | "spec"
  | "epic"
  | "evidence"
  | "evid"
  | "note"
  | "problem"
  | "solution";

export type ArtifactSnapshotStatus =
  | "draft"
  | "active"
  | "superseded"
  | "deprecated"
  | "stale";

export interface ArtifactSnapshot {
  id: string;
  kind: ArtifactSnapshotKind;
  status: ArtifactSnapshotStatus;
  title: string;
  // Slug-canonical identity (forgeplan ≥ 0.28). Mirrors ArtifactSummary
  // in entities/artifact/model/types.ts. All five fields are optional —
  // legacy artefacts and forgeplan 0.27 hosts simply omit them.
  // See PRD-016 / RFC-015 D-1.
  slug?: string;
  predicted_number?: number;
  assigned_number?: number | null;
  id_canonical?: string;
  id_display?: string;
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

// Structured failure codes for /api/snapshot (RFC-015 D-4). Each value
// names a concrete reconstruction step; `getSnapshot()` maps these to
// response payloads with sanitized stderr.
export type SnapshotErrorCode =
  | "host_config_missing"
  | "worktree_add_failed"
  | "reindex_failed"
  | "list_parse_failed"
  | "graph_parse_failed"
  | "commit_unreachable";

export interface SnapshotResult {
  ok: boolean;
  at: string;
  sha?: string;
  snapshot?: SnapshotData;
  fromCache?: "memory" | "disk" | null;
  // Failure-only fields. `error` is preserved as a human-readable
  // summary for legacy consumers; new consumers should switch on
  // `error_code` (RFC-015 D-4 + rollback plan).
  error?: string;
  error_code?: SnapshotErrorCode;
  stderr_excerpt?: string;
  status?: number;
}

type ReconstructResult =
  | { kind: "ok"; data: SnapshotData }
  | { kind: "err"; error_code: SnapshotErrorCode; stderr: string };

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

let gitRepoRootCache: string | null = null;

// Resolves the host git repo root once. WORKSPACE_ROOT may point at
// template/src/ in dev mode (modules loaded directly by vite) so git
// pathspec filters resolved relative to it would silently miss files.
// Detecting via `git rev-parse --show-toplevel` is the canonical fix.
export function gitRepoRoot(): string {
  if (gitRepoRootCache !== null) return gitRepoRootCache;
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: workspaceRoot(),
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      timeout: 5_000,
    });
    gitRepoRootCache = out.trim();
  } catch {
    // FIXME(git-root-detect): fall back to workspaceRoot() when not in a git
    // repo. Snapshot reconstruction will fail downstream with a clearer error.
    gitRepoRootCache = workspaceRoot();
  }
  return gitRepoRootCache;
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
  const root = gitRepoRoot();
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

function spawnForgeplanReindex(cwd: string): Promise<SpawnResult> {
  return new Promise((resolveResult) => {
    const bin = process.env.FORGEPLAN_BIN ?? "forgeplan";
    const child = spawn(bin, ["reindex"], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
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
        stderr: `forgeplan reindex timeout after ${FORGEPLAN_LIST_TIMEOUT_MS}ms`,
        code: null,
      });
    }, FORGEPLAN_LIST_TIMEOUT_MS);
    child.stdout.on("data", (c) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString("utf8");
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

// forgeplan ≥ 0.28 aborts every subcommand with `Error: No such file or
// directory (os error 2)` when `.forgeplan/config.yaml` is absent. In an
// ephemeral worktree this happens iff the host gitignored `config.yaml`
// — a legitimate but misconfigured workspace state. Distinguishing this
// case from other reindex failures gives the user a one-line remediation
// (see `guides/FORGEPLAN-GITIGNORE.md`) instead of a generic 502.
//
// @internal — exported for unit tests.
export function isHostConfigMissingError(stderr: string): boolean {
  return /os error 2/.test(stderr) && /No such file or directory/.test(stderr);
}

// Strips host-specific paths and env-style lines from stderr before the
// excerpt is surfaced through /api/snapshot. RFC-015 D-5 + I-4. Pure.
//
// @internal — exported for unit tests.
export function sanitizeStderr(raw: string): string {
  let s = raw;
  // Drop env-style lines (FOO=bar) — they may carry tokens or paths.
  s = s.replace(/^([A-Z][A-Z0-9_]+)=(\S+)/gm, "$1=<redacted>");
  // Reduce absolute paths under common roots to "<host>/...".
  s = s.replace(/\/(?:Users|home|private\/var)\/[^\s'"]+/g, "<host>/...");
  // Strip FORGEPLAN_BIN literal if it leaked.
  const bin = process.env.FORGEPLAN_BIN;
  if (bin && bin.length > 1) {
    s = s.split(bin).join("<forgeplan>");
  }
  // Truncate at a word boundary.
  if (s.length > STDERR_MAX_LEN) {
    const cut = s.slice(0, STDERR_MAX_LEN);
    const lastSpace = cut.lastIndexOf(" ");
    s = `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
  }
  return s;
}

async function reconstructFromWorktree(
  sha: string,
): Promise<ReconstructResult> {
  const root = gitRepoRoot();

  // Pre-flight: a SHA returned by `resolveCommitSha` may have become
  // unreachable since (post-rebase prune, shallow clone, force-push).
  // `git worktree add` would still fail, but with a less-specific
  // message. Surface `commit_unreachable` directly so the UI can offer
  // "snap to nearest live SHA" later (out of scope here, see RFC-015).
  const exists = await spawnGit(["cat-file", "-e", sha], root);
  if (!exists.ok) {
    return {
      kind: "err",
      error_code: "commit_unreachable",
      stderr: exists.stderr || `commit ${sha} not reachable from any ref`,
    };
  }

  const tmpBase = await mkdtemp(join(tmpdir(), WORKTREE_TMP_PREFIX));
  let worktreeAdded = false;
  try {
    const add = await spawnGit(
      ["worktree", "add", "--detach", tmpBase, sha],
      root,
    );
    if (!add.ok) {
      return {
        kind: "err",
        error_code: "worktree_add_failed",
        stderr: add.stderr,
      };
    }
    worktreeAdded = true;

    // The LanceDB index lives in `.forgeplan/lance/` which is gitignored —
    // a fresh worktree has no index, and `forgeplan list --json` fails with
    // "Table 'artifacts' was not found". Rebuild the index from markdown
    // (the source-of-truth per parent-repo ADR-003) before querying.
    // Bypasses runForgeplan's read-only allow-list because the write is
    // scoped to the ephemeral worktree, never the host workspace.
    const reindex = await spawnForgeplanReindex(tmpBase);
    if (!reindex.ok) {
      return {
        kind: "err",
        error_code: isHostConfigMissingError(reindex.stderr)
          ? "host_config_missing"
          : "reindex_failed",
        stderr: reindex.stderr,
      };
    }

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

    if (!listResult.ok || !Array.isArray(listResult.data)) {
      return {
        kind: "err",
        error_code: "list_parse_failed",
        stderr: listResult.error ?? "forgeplan list returned non-array body",
      };
    }
    const artifacts = listResult.data;

    // Graph is best-effort: a missing edges array is not a fatal error,
    // older snapshots may not have any links. We only surface
    // `graph_parse_failed` when the CLI itself errored.
    if (!graphResult.ok) {
      return {
        kind: "err",
        error_code: "graph_parse_failed",
        stderr: graphResult.error ?? "forgeplan graph returned an error",
      };
    }
    const edges = graphResult.data?.edges ?? [];

    return { kind: "ok", data: { sha, artifacts, edges } };
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

// Human-readable summaries for legacy consumers that read `error`
// instead of `error_code`. Kept short (one sentence) so they fit
// inside an error toast without truncation. RFC-015 rollback plan.
const ERROR_CODE_MESSAGES: Record<SnapshotErrorCode, string> = {
  host_config_missing:
    "host workspace gitignored .forgeplan/config.yaml — see guides/FORGEPLAN-GITIGNORE.md",
  worktree_add_failed: "git worktree add failed for the reconstruction commit",
  reindex_failed: "forgeplan reindex failed in the ephemeral worktree",
  list_parse_failed: "forgeplan list --json returned an unparseable body",
  graph_parse_failed: "forgeplan graph --json returned an error",
  commit_unreachable:
    "commit pruned from local repository (rebase, shallow clone, or force-push)",
};

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
  if (built.kind === "err") {
    return {
      ok: false,
      at,
      sha,
      error: ERROR_CODE_MESSAGES[built.error_code],
      error_code: built.error_code,
      stderr_excerpt: sanitizeStderr(built.stderr),
      status: 502,
    };
  }

  memoryCacheSet(sha, built.data);
  diskCacheSet(sha, built.data).catch(() => {
    // FIXME(disk-cache-write): persist failure silently swallowed. Acceptable
    // for cache layer (next request just retries); add ops log later.
  });

  return { ok: true, at, sha, snapshot: built.data, fromCache: null };
}

// TODO(F18-T6): export async function compareSnapshots(at1, at2):
//   parallel getSnapshot calls + diff projection (added / activated /
//   superseded / degraded). `degraded` requires R_eff via
//   `forgeplan score --json` per artifact — verify shape in T6.
