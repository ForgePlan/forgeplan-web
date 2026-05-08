import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { printBanner } from "../banner.mjs";
import { readConfig } from "../lib/config.mjs";
import { promptConfirm, promptScope } from "../lib/prompt.mjs";
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
      scaffold.scope === "user"
        ? cwd
        : (cfg?.workspaceRoot ?? cwd);

    const env = {
      ...process.env,
      PORT: process.env.PORT ?? "5174",
      HOST: process.env.HOST ?? "127.0.0.1",
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

    const forward = (sig) => {
      if (!child.killed) child.kill(sig);
    };
    process.on("SIGINT", () => forward("SIGINT"));
    process.on("SIGTERM", () => forward("SIGTERM"));

    return new Promise(() => {
      child.on("exit", (code, signal) => {
        if (signal) process.exit(0);
        process.exit(code ?? 0);
      });
    });
  },
});
