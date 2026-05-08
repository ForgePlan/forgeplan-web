import { defineCommand } from "citty";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CFG_FILE,
  PKG_ROOT,
  readConfig,
  readPkgVersion,
} from "../lib/config.mjs";
import {
  ensureForgeplanBinary,
  ensureForgeplanWorkspace,
} from "../lib/forgeplan-binary.mjs";
import { ensureGitignore } from "../lib/gitignore.mjs";
import { promptScope } from "../lib/prompt.mjs";
import {
  isValidScope,
  projectScopePath,
  scopePath,
  userScopePath,
} from "../lib/scope.mjs";

const DIST_DIR_LEGACY = join(PKG_ROOT, "dist");
const DIST_DIR_EXPERIMENTAL = join(PKG_ROOT, "dist-experimental");

function fail(line, code = 1) {
  process.stderr.write(`forgeplan-web: ${line}\n`);
  process.exit(code);
}

function copyDir(src, dest, force) {
  if (!existsSync(src)) {
    fail(
      `pre-built artifact missing at ${src}.\n` +
        `       This usually means the npm package was published without a build. ` +
        `Reinstall, or build from source via \`npm run build\`.`,
    );
  }
  if (existsSync(dest) && !force) {
    cpSync(src, dest, {
      recursive: true,
      dereference: false,
      force: false,
      errorOnExist: false,
    });
  } else {
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true, dereference: false, force: true });
  }
}

export async function runInit({
  scope,
  force = false,
  quiet = false,
  skipGitignore = false,
  experimental = false,
  cwd = process.cwd(),
} = {}) {
  if (!isValidScope(scope)) {
    fail(`internal: runInit called with invalid scope "${scope}"`);
  }

  const log = (line) => {
    if (!quiet) process.stdout.write(line + "\n");
  };

  const DIST_DIR = experimental ? DIST_DIR_EXPERIMENTAL : DIST_DIR_LEGACY;

  if (scope === "project") {
    ensureForgeplanWorkspace(cwd, fail);
  }
  ensureForgeplanBinary(fail);

  if (experimental) {
    log(
      "⚠ Using experimental bundled dist (single-file server, no node_modules/).",
    );
    log(
      "  Report issues at https://github.com/ForgePlan/forgeplan-web/issues",
    );
  }

  const target = scopePath(scope, cwd);
  const fresh = !existsSync(target);
  log(fresh ? `→ creating ${target}` : `→ updating ${target}`);
  copyDir(DIST_DIR, target, force);

  const now = new Date().toISOString();
  const existing = fresh ? null : readConfig(target);
  const cfg = {
    workspaceRoot: scope === "project" ? cwd : (existing?.workspaceRoot ?? null),
    createdAt: existing?.createdAt ?? now,
    version: readPkgVersion() ?? existing?.version ?? null,
    updatedAt: now,
    experimental,
    scope,
  };
  writeFileSync(join(target, CFG_FILE), JSON.stringify(cfg, null, 2) + "\n");

  if (scope === "project") {
    ensureGitignore({ cwd, skip: skipGitignore, log });
  }

  log("");
  log(
    scope === "user"
      ? `✓ ready (scope: user — ${userScopePath()})`
      : `✓ ready (scope: project — ${projectScopePath(cwd)})`,
  );
  log("  npx @forgeplan/web start");
  if (scope === "project") {
    log("  # or: node .forgeplan-web/index.js");
  }

  return { scope, target };
}

export default defineCommand({
  meta: {
    name: "init",
    description:
      "Copy the pre-built SvelteKit app into a project- or user-scope `.forgeplan-web/`.",
  },
  args: {
    y: {
      type: "boolean",
      description:
        "non-interactive mode (defaults --scope to project for backwards compat)",
    },
    force: {
      type: "boolean",
      description: "overwrite files that already exist",
    },
    quiet: {
      type: "boolean",
      alias: "q",
      description: "suppress informational output",
    },
    gitignore: {
      type: "boolean",
      default: true,
      description:
        "append `.forgeplan-web/` to ./.gitignore (project scope only; pass --no-gitignore to skip)",
    },
    experimental: {
      type: "boolean",
      description:
        "[EXPERIMENTAL] use the bundled single-file dist (~9x smaller, no node_modules/)",
    },
    scope: {
      type: "string",
      description:
        "scope of the scaffold: user (~/.forgeplan-web/) or project (./.forgeplan-web/)",
      valueHint: "user|project",
    },
  },
  async run({ args }) {
    const QUIET = args.quiet === true;
    const FORCE = args.force === true;
    const YES = args.y === true;
    const SKIP_GITIGNORE = args.gitignore === false;
    const EXPERIMENTAL = args.experimental === true;

    let scope = null;
    if (args.scope) {
      if (!isValidScope(args.scope)) {
        fail(
          `invalid --scope value "${args.scope}"; expected "user" or "project".`,
        );
      }
      scope = args.scope;
    } else if (YES) {
      // FR-005: zero-config preservation — `init -y` (no --scope) keeps
      // writing project-scope so existing scripts and CI keep working.
      scope = "project";
    } else {
      // FR-003 / FR-004: interactive TTY → prompt with default = user.
      // FR-009: non-TTY without --scope or -y → fail fast (handled inside
      // promptScope via ENOTTY).
      try {
        scope = await promptScope({ defaultChoice: "user" });
      } catch (err) {
        if (err && err.code === "ENOTTY") {
          fail(
            `no TTY detected; pass \`--scope user|project\` explicitly (or \`-y\` for project default).`,
          );
        }
        throw err;
      }
    }

    await runInit({
      scope,
      force: FORCE,
      quiet: QUIET,
      skipGitignore: SKIP_GITIGNORE,
      experimental: EXPERIMENTAL,
    });
  },
});
