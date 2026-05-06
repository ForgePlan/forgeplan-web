import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// TODO(config): allow per-route timeout overrides if a CLI command becomes slow.
const DEFAULT_TIMEOUT_MS = 15_000;

const READ_ONLY_SUBCOMMANDS = new Set([
  "list",
  "health",
  "graph",
  "get",
  "order",
  "blocked",
  "claims",
  "stale",
  "log",
  "score",
  "tree",
  "blindspots",
  "journal",
]);

// FIXME(layout-coupling): brittle relative walk — refactor if file moves between segments.
// After `vite build` + adapter-node, this module is bundled to
// `<scaffold>/server/chunks/<hash>.js`. APP_ROOT must resolve to the scaffold
// directory itself (`.forgeplan-web/`) so `forgeplan-web.json` (written by
// `init`) can be read, and the parent-dir fallback points at the host project.
// `'..', '..'` walks chunks → server → scaffold.
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readWorkspaceRoot(): string {
  if (process.env.FORGEPLAN_CWD) return process.env.FORGEPLAN_CWD;
  const cfgPath = join(APP_ROOT, "forgeplan-web.json");
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as {
        workspaceRoot?: string;
      };
      if (cfg.workspaceRoot) return cfg.workspaceRoot;
    } catch {
      // FIXME(config): forgeplan-web.json malformed — falling back to parent dir.
    }
  }
  return resolve(APP_ROOT, "..");
}

// FR-001 (PRD-002): validate FORGEPLAN_BIN at module load. With shell:true on
// Windows, an unvalidated path interpolates into cmd.exe and any space or
// metacharacter in the value becomes a shell token. Allow-list anchored regex
// permits drive letters, separators (Unix + Windows), digits, dot, hyphen,
// underscore — refuse everything else.
const FORGEPLAN_BIN_RE = /^[A-Za-z0-9_./:\\-]+$/;
const FORGEPLAN_BIN_RAW = process.env.FORGEPLAN_BIN ?? "forgeplan";
const FORGEPLAN_BIN_VALID = FORGEPLAN_BIN_RE.test(FORGEPLAN_BIN_RAW);
if (!FORGEPLAN_BIN_VALID) {
  console.error(
    `[forgeplan-web] refusing to spawn: FORGEPLAN_BIN contains characters outside [A-Za-z0-9_./:\\-]: ${JSON.stringify(FORGEPLAN_BIN_RAW)}`,
  );
}
const FORGEPLAN_BIN = FORGEPLAN_BIN_VALID ? FORGEPLAN_BIN_RAW : "forgeplan";
const WORKSPACE_ROOT = readWorkspaceRoot();

// FR-004 (PRD-002): in-process concurrency cap. Without it, a loopback DoS
// (or a HOST=0.0.0.0 LAN exposure) can exhaust the Node event loop with
// queued spawns. Cap = 4 simultaneous forgeplan processes; further requests
// queue. Polling steady-state needs only 1 in flight per route, so 4 is plenty.
const SPAWN_CONCURRENCY_CAP = 4;
let spawnInFlight = 0;
const spawnQueue: Array<() => void> = [];

function acquireSpawnSlot(): Promise<void> {
  return new Promise((release) => {
    if (spawnInFlight < SPAWN_CONCURRENCY_CAP) {
      spawnInFlight += 1;
      release();
      return;
    }
    spawnQueue.push(() => {
      spawnInFlight += 1;
      release();
    });
  });
}

function releaseSpawnSlot(): void {
  spawnInFlight = Math.max(0, spawnInFlight - 1);
  const next = spawnQueue.shift();
  if (next) next();
}

export interface ForgeplanResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  raw?: string;
  cmd: string;
}

export async function runForgeplan<T = unknown>(
  args: string[],
  opts: { timeoutMs?: number; parse?: boolean } = {},
): Promise<ForgeplanResult<T>> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const parse = opts.parse ?? true;
  const cmd = [FORGEPLAN_BIN, ...args].join(" ");

  // FR-001 enforcement: if module-load validation failed, refuse every spawn.
  if (!FORGEPLAN_BIN_VALID) {
    return {
      ok: false,
      error:
        "FORGEPLAN_BIN env var contains unsafe characters; refused. See server logs.",
      cmd,
    };
  }

  const sub = args[0];
  if (!sub || !READ_ONLY_SUBCOMMANDS.has(sub)) {
    return { ok: false, error: `forbidden subcommand: ${sub ?? ""}`, cmd };
  }

  await acquireSpawnSlot();
  try {
    return await new Promise<ForgeplanResult<T>>((resolveResult) => {
      // Windows: `forgeplan` resolves to forgeplan.cmd (npm/scoop install).
      // Node spawn can't invoke .cmd without shell:true. Args are still
      // passed as an array (not concatenated into a shell string) and every
      // route validates IDs against ^[A-Z]+-[0-9]+$ before reaching here
      // (see rule 22), so shell-injection surface is bounded.
      const child = spawn(FORGEPLAN_BIN, args, {
        cwd: WORKSPACE_ROOT,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      });
      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        resolveResult({
          ok: false,
          error: `timeout after ${timeoutMs}ms`,
          cmd,
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
        clearTimeout(timer);
        resolveResult({ ok: false, error: err.message, cmd });
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          resolveResult({
            ok: false,
            error: stderr.trim() || `exit code ${code}`,
            raw: stdout,
            cmd,
          });
          return;
        }
        if (!parse) {
          resolveResult({ ok: true, raw: stdout, cmd });
          return;
        }
        try {
          const data = JSON.parse(stdout) as T;
          resolveResult({ ok: true, data, raw: stdout, cmd });
        } catch (err) {
          resolveResult({
            ok: false,
            error: `failed to parse JSON: ${(err as Error).message}`,
            raw: stdout,
            cmd,
          });
        }
      });
    });
  } finally {
    releaseSpawnSlot();
  }
}

export function workspaceRoot(): string {
  return WORKSPACE_ROOT;
}

export function forgeplanBinary(): string {
  return FORGEPLAN_BIN;
}

// PRD-012 / RFC-011: `--version` is a flag, not a subcommand, so it bypasses
// READ_ONLY_SUBCOMMANDS by design. Reuses FORGEPLAN_BIN validation and the
// shared concurrency cap. Memoized — version is fixed per process.
const VERSION_TIMEOUT_MS = 5_000;
const FORGEPLAN_VERSION_RE = /forgeplan\s+(\d+\.\d+\.\d+\S*)/i;
let forgeplanVersionPromise: Promise<string | null> | null = null;

export function getForgeplanVersion(): Promise<string | null> {
  if (forgeplanVersionPromise) return forgeplanVersionPromise;
  forgeplanVersionPromise = resolveForgeplanVersion().catch(() => null);
  return forgeplanVersionPromise;
}

async function resolveForgeplanVersion(): Promise<string | null> {
  if (!FORGEPLAN_BIN_VALID) return null;
  await acquireSpawnSlot();
  try {
    return await new Promise<string | null>((resolveResult) => {
      const child = spawn(FORGEPLAN_BIN, ['--version'], {
        cwd: WORKSPACE_ROOT,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });
      let stdout = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        resolveResult(null);
      }, VERSION_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });
      child.on('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolveResult(null);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          resolveResult(null);
          return;
        }
        const match = FORGEPLAN_VERSION_RE.exec(stdout);
        resolveResult(match?.[1] ?? null);
      });
    });
  } finally {
    releaseSpawnSlot();
  }
}
