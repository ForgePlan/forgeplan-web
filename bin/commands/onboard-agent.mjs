import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// RFC-034 (Pillar C, Phase 3a) / ADR-010: this subcommand is SPAWN-ONLY. It
// never imports `@forgeplan/web-agent` — only `child_process.spawn`s its
// binary once resolved. The heavy Agent SDK dependency tree lives entirely
// in that separate, optional package (rule 23 / ADR-003 invariant: bin/
// stays `node:*` + citty + relative siblings only).

const AGENT_PKG = "@forgeplan/web-agent";
const AGENT_BIN_NAME = "forgeplan-web-agent";
const DEFAULT_PORT = 7431;

function fail(line, code = 1) {
  process.stderr.write(`forgeplan-web: ${line}\n`);
  process.exit(code);
}

function printInstallHint() {
  process.stderr.write(
    "forgeplan-web: the onboarding agent is an optional package.\n" +
      `       Install it with: npx ${AGENT_PKG}\n` +
      `       (or: npm i -g ${AGENT_PKG})\n`,
  );
}

function localBinCandidates(cwd) {
  const base = join(cwd, "node_modules", ".bin", AGENT_BIN_NAME);
  return process.platform === "win32"
    ? [`${base}.cmd`, `${base}.ps1`, base]
    : [base];
}

/**
 * Resolves an already-installed `@forgeplan/web-agent` binary without ever
 * loading the package's code. Two lookup strategies, in order:
 *   1. Node's own module resolution (`require.resolve`) walking up from
 *      `cwd` — resolves the package's `package.json#bin` entry to a real
 *      filesystem path and invokes it as `node <resolvedPath>`. This is the
 *      preferred strategy: it always launches via a fully-resolved path
 *      regardless of how the package was linked into `node_modules`, so it
 *      is robust to `node_modules/.bin` being a symlink (the standard npm
 *      layout on POSIX). It only resolves a filesystem PATH; it never
 *      executes or imports the package itself (rule 23).
 *   2. `node_modules/.bin/<bin-name>` next to `cwd` — a plain fallback for
 *      the (rare) case where module resolution above fails to locate the
 *      package's `package.json` even though a `.bin` entry exists.
 * Returns `null` when the package cannot be found locally at all — callers
 * fall back to `npx` on-demand resolution.
 */
function resolvePackageBin(cwd) {
  try {
    // createRequire's argument only anchors the resolution directory; it
    // does not need to exist on disk.
    const requireFromCwd = createRequire(join(cwd, "noop.cjs"));
    const pkgJsonPath = requireFromCwd.resolve(`${AGENT_PKG}/package.json`);
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    const binField = pkgJson.bin;
    const binRelative =
      typeof binField === "string" ? binField : binField?.[AGENT_BIN_NAME];
    if (binRelative) {
      const resolvedBin = join(dirname(pkgJsonPath), binRelative);
      if (existsSync(resolvedBin)) {
        return { cmd: process.execPath, args: [resolvedBin] };
      }
    }
  } catch {
    // Not resolvable via node module resolution — fall through to the
    // node_modules/.bin check, then to the npx fallback in run().
  }

  for (const candidate of localBinCandidates(cwd)) {
    if (existsSync(candidate)) return { cmd: candidate, args: [] };
  }

  return null;
}

export default defineCommand({
  meta: {
    name: "onboard-agent",
    description:
      "Launch the optional @forgeplan/web-agent daemon (RFC-034 Pillar C / ADR-010): a localhost-only live onboarding agent the web chat upgrades to when present. Spawn-only — never imports the agent package.",
  },
  args: {
    port: {
      type: "string",
      default: String(DEFAULT_PORT),
      description: "port the daemon binds on 127.0.0.1",
      valueHint: String(DEFAULT_PORT),
    },
    cwd: {
      type: "string",
      description:
        "project root the agent reads from (default: current directory)",
      valueHint: "/path/to/project",
    },
  },
  async run({ args }) {
    const cwd =
      typeof args.cwd === "string" && args.cwd.length > 0
        ? args.cwd
        : process.cwd();

    const portNum = Number(args.port);
    if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65_535) {
      fail(`invalid --port value "${args.port}"; expected 1..65535.`);
    }
    const port = String(portNum);
    const agentArgs = ["--cwd", cwd, "--port", port];

    const resolved = resolvePackageBin(cwd);

    let cmd;
    let cmdArgs;
    if (resolved) {
      cmd = resolved.cmd;
      cmdArgs = [...resolved.args, ...agentArgs];
    } else {
      // Not installed locally — fall back to on-demand resolution via npx.
      // npx performs its own "is it published/cached" check; we only guard
      // the spawn() boundary below against ENOENT (e.g. npx itself missing
      // from PATH), never surfacing a raw ENOENT to the user.
      cmd = "npx";
      cmdArgs = ["--yes", AGENT_PKG, ...agentArgs];
    }

    const isDirectNodeInvocation = cmd === process.execPath;
    const useShell = process.platform === "win32" && !isDirectNodeInvocation;

    const child = spawn(cmd, cmdArgs, {
      stdio: "inherit",
      shell: useShell,
    });

    const forward = (sig) => {
      if (!child.killed) child.kill(sig);
    };
    process.on("SIGINT", () => forward("SIGINT"));
    process.on("SIGTERM", () => forward("SIGTERM"));

    return new Promise((resolvePromise) => {
      child.on("error", (err) => {
        if (err && err.code === "ENOENT") {
          printInstallHint();
          process.exit(1);
        } else {
          fail(`failed to launch onboarding agent: ${err?.message ?? err}`);
        }
        resolvePromise();
      });
      child.on("exit", (code, signal) => {
        if (signal) {
          process.exit(1);
        } else {
          process.exit(code ?? 0);
        }
      });
    });
  },
});
