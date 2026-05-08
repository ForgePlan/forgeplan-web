import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { printBanner } from "../banner.mjs";
import { readWorkspaceRoot } from "../lib/config.mjs";

function fail(line, code = 1) {
  process.stderr.write(`forgeplan-web: ${line}\n`);
  process.exit(code);
}

export default defineCommand({
  meta: {
    name: "start",
    description:
      "Run the SvelteKit server from ./.forgeplan-web/. Reads PORT, HOST, FORGEPLAN_CWD, FORGEPLAN_BIN env vars.",
    alias: ["serve", "run"],
  },
  args: {
    quiet: {
      type: "boolean",
      alias: "q",
      description: "suppress banner and informational output",
    },
    // TODO(109b): scope flag declared, not yet consumed — see PRD-025
    scope: {
      type: "string",
      description:
        "[reserved for PRD-025] scope of the instance: user|project (no-op in this release)",
      valueHint: "user|project",
    },
  },
  async run({ args }) {
    const QUIET = args.quiet === true;
    const log = (line) => {
      if (!QUIET) process.stdout.write(line + "\n");
    };

    const cwd = process.cwd();
    const target = join(cwd, ".forgeplan-web");

    if (!existsSync(target) || !existsSync(join(target, "index.js"))) {
      fail(
        `no scaffolded server at ${target}.\n` +
          `       Run \`npx @forgeplan/web init\` first.`,
      );
    }

    const workspaceRoot = readWorkspaceRoot(target) ?? cwd;
    const env = {
      ...process.env,
      PORT: process.env.PORT ?? "5174",
      HOST: process.env.HOST ?? "127.0.0.1",
      FORGEPLAN_CWD: process.env.FORGEPLAN_CWD ?? workspaceRoot,
    };

    printBanner({ quiet: QUIET });
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

    // Wrap in a Promise so citty's runMain awaits the child's exit
    // before terminating; otherwise process.exit in the listener races.
    return new Promise(() => {
      child.on("exit", (code, signal) => {
        if (signal) process.exit(0);
        process.exit(code ?? 0);
      });
    });
  },
});
