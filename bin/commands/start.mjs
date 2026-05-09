import { defineCommand } from "citty";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { printBanner } from "../banner.mjs";
import { readConfig, readPkgVersion } from "../lib/config.mjs";
import { promptConfirm, promptScope } from "../lib/prompt.mjs";
import {
  deregister,
  findFreePort,
  HEARTBEAT_INTERVAL_MS,
  makeInstanceId,
  PORT_PROBE_MAX_OFFSET,
  register,
} from "../lib/registry.mjs";
import {
  findScaffold,
  isValidScope,
  projectScopePath,
  userScopePath,
} from "../lib/scope.mjs";
import { runInit } from "./init.mjs";

function fail(line, code = 1) {
  process.stderr.write(`forgeplan-web: ${line}\n`);
  process.exit(code);
}

function isInteractiveTTY() {
  return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

async function handleEmptyState({ cwd, log }) {
  const projPath = projectScopePath(cwd);
  const userPath = userScopePath();

  if (!isInteractiveTTY()) {
    fail(
      `no scaffold found at ${projPath} or ${userPath}.\n` +
        `       Run \`npx @forgeplan/web init [--scope user|project]\` first.`,
    );
  }

  log(`No scaffold found at ${projPath} or ${userPath}.`);
  let confirmed = false;
  try {
    confirmed = await promptConfirm({
      message: "Run `init` now?",
      defaultYes: true,
    });
  } catch (err) {
    if (err && err.code === "ENOTTY") {
      fail(
        `no scaffold found at ${projPath} or ${userPath}.\n` +
          `       Run \`npx @forgeplan/web init [--scope user|project]\` first.`,
      );
    }
    throw err;
  }
  if (!confirmed) {
    fail(
      `aborted; run \`npx @forgeplan/web init [--scope user|project]\` when ready.`,
    );
  }

  const chosenScope = await promptScope({ defaultChoice: "user" });
  const result = await runInit({ scope: chosenScope, cwd });
  return findScaffold({ cwd, scope: result.scope });
}

function probeForgeplanCliVersion() {
  // Read-only; failure → null. Mirrors ensureForgeplanBinary but cares about output.
  try {
    const r = spawnSync("forgeplan", ["--version"], {
      shell: process.platform === "win32",
      encoding: "utf8",
      timeout: 5_000,
    });
    if (r.status !== 0 || typeof r.stdout !== "string") return null;
    const m = /forgeplan\s+(\d+\.\d+\.\d+\S*)/i.exec(r.stdout);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export default defineCommand({
  meta: {
    name: "start",
    description:
      "Run the SvelteKit server from the resolved `.forgeplan-web/` (project → user → prompt). Reads PORT, HOST, FORGEPLAN_CWD, FORGEPLAN_BIN env vars.",
    alias: ["serve", "run"],
  },
  args: {
    quiet: {
      type: "boolean",
      alias: "q",
      description: "suppress banner and informational output",
    },
    scope: {
      type: "string",
      description:
        "force a specific scope: user (~/.forgeplan-web/) or project (./.forgeplan-web/); fails if absent",
      valueHint: "user|project",
    },
  },
  async run({ args }) {
    const QUIET = args.quiet === true;
    const log = (line) => {
      if (!QUIET) process.stdout.write(line + "\n");
    };

    const cwd = process.cwd();

    let explicitScope = null;
    if (args.scope) {
      if (!isValidScope(args.scope)) {
        fail(
          `invalid --scope value "${args.scope}"; expected "user" or "project".`,
        );
      }
      explicitScope = args.scope;
    }

    let scaffold;
    if (explicitScope === "project") {
      scaffold = findScaffold({ cwd, scope: "project" });
      if (!scaffold) {
        fail(
          `--scope project: no scaffold at ${projectScopePath(cwd)}.\n` +
            `       Run \`npx @forgeplan/web init --scope project\` first.`,
        );
      }
    } else if (explicitScope === "user") {
      scaffold = findScaffold({ cwd, scope: "user" });
      if (!scaffold) {
        fail(
          `--scope user: no scaffold at ${userScopePath()}.\n` +
            `       Run \`npx @forgeplan/web init --scope user\` first.`,
        );
      }
    } else {
      // implicit chain: project → user → prompt-init
      scaffold = findScaffold({ cwd });
      if (!scaffold) {
        scaffold = await handleEmptyState({ cwd, log });
        if (!scaffold) {
          // TODO(109c-empty-after-init): findScaffold returned null right
          // after a successful runInit — likely a race or path mismatch.
          fail("scaffold missing after init; please re-run `start` manually.");
        }
      }
    }

    const target = scaffold.path;
    if (!existsSync(target)) {
      fail(`internal: resolved scaffold path ${target} does not exist.`);
    }

    const cfg = readConfig(target);
    // For project-scope the workspace IS the cwd at init-time. For user-scope
    // the workspace is wherever the user is now (the user-scope dist is
    // workspace-agnostic). Env override always wins (existing contract).
    const workspaceRoot =
      scaffold.scope === "user" ? cwd : (cfg?.workspaceRoot ?? cwd);

    const host = process.env.HOST ?? "127.0.0.1";
    const requestedPort = Number(process.env.PORT ?? "5174");
    if (!Number.isFinite(requestedPort) || requestedPort < 1 || requestedPort > 65_535) {
      fail(`invalid PORT="${process.env.PORT}"; expected 1..65535.`);
    }

    let port;
    try {
      port = await findFreePort({
        host,
        basePort: requestedPort,
        maxOffset: PORT_PROBE_MAX_OFFSET,
      });
    } catch (err) {
      fail(err && err.message ? err.message : String(err));
    }
    if (port !== requestedPort) {
      log(`note: PORT ${requestedPort} busy; allocated ${port}`);
    }

    const env = {
      ...process.env,
      PORT: String(port),
      HOST: host,
      FORGEPLAN_CWD: process.env.FORGEPLAN_CWD ?? workspaceRoot,
    };

    printBanner({ quiet: QUIET });
    log(`→ scope: ${scaffold.scope} (${target})`);
    log(`→ starting forgeplan-web on http://${env.HOST}:${env.PORT}`);
    log(`  workspace: ${env.FORGEPLAN_CWD}`);

    const child = spawn(process.execPath, ["index.js"], {
      cwd: target,
      env,
      stdio: "inherit",
    });

    // Registry registration happens AFTER spawn so we record the SvelteKit
    // child's pid (the actual server). The bin script is the lifecycle owner
    // — on parent exit we deregister before the child is reaped.
    const instanceId = makeInstanceId(host, port);
    let registered = false;
    let cleanedUp = false;
    let heartbeatTimer = null;

    const startedAt = new Date().toISOString();
    const projectName = basename(env.FORGEPLAN_CWD) || "workspace";
    const webVersion = readPkgVersion() ?? "0.0.0";
    const forgeplanCli = probeForgeplanCliVersion();

    // Build once; heartbeat ticks re-use this with a fresh heartbeatAt.
    // child.pid is set synchronously after spawn returns; if missing (very
    // rare, only when spawn failed) fall back to bin pid for a sweepable row.
    const instanceEntry = {
      id: instanceId,
      host,
      port,
      pid: typeof child.pid === "number" ? child.pid : process.pid,
      scope: scaffold.scope,
      workspaceRoot: env.FORGEPLAN_CWD,
      projectName,
      startedAt,
      heartbeatAt: startedAt,
      webVersion,
      forgeplanCli,
    };

    try {
      register(instanceEntry);
      registered = true;
    } catch (err) {
      // FIXME(registry-write-failed): non-fatal — instance still serves; UI
      // switcher won't see it until next successful heartbeat.
      log(`note: registry write failed: ${err?.message ?? err}`);
    }

    if (registered) {
      heartbeatTimer = setInterval(() => {
        try {
          // Use register() instead of heartbeat() so the entry is re-added if
          // it was lost due to a concurrent write race (ADR-004 §5 known gap).
          register({ ...instanceEntry, heartbeatAt: new Date().toISOString() });
        } catch {
          // FIXME(heartbeat-write-failed): swallow; sweep on next start fixes.
        }
      }, HEARTBEAT_INTERVAL_MS);
      // Don't pin the event loop if everything else has exited.
      heartbeatTimer.unref?.();
    }

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (registered) {
        try {
          deregister(instanceId);
        } catch {
          // FIXME(deregister-failed): leaves stale row; swept on next start.
        }
      }
    };

    const forward = (sig) => {
      if (!child.killed) child.kill(sig);
    };
    process.on("SIGINT", () => {
      forward("SIGINT");
    });
    process.on("SIGTERM", () => {
      forward("SIGTERM");
    });
    process.on("exit", cleanup);

    return new Promise(() => {
      child.on("exit", (code, signal) => {
        cleanup();
        if (signal) process.exit(0);
        process.exit(code ?? 0);
      });
    });
  },
});
