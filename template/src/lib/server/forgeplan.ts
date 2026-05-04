import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// TODO(config): allow per-route timeout overrides if a CLI command becomes slow.
const DEFAULT_TIMEOUT_MS = 15_000;

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

const FORGEPLAN_BIN = process.env.FORGEPLAN_BIN ?? "forgeplan";
const WORKSPACE_ROOT = readWorkspaceRoot();

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

  return new Promise((resolveResult) => {
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
      resolveResult({ ok: false, error: `timeout after ${timeoutMs}ms`, cmd });
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
}

export function workspaceRoot(): string {
  return WORKSPACE_ROOT;
}

export function forgeplanBinary(): string {
  return FORGEPLAN_BIN;
}
