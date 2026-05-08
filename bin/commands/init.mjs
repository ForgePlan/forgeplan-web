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

export default defineCommand({
  meta: {
    name: "init",
    description:
      "Copy the pre-built SvelteKit app to ./.forgeplan-web/ and append `.forgeplan-web/` to ./.gitignore (idempotent).",
  },
  args: {
    y: {
      type: "boolean",
      description: "accepted for compatibility (init is non-interactive)",
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
        "append `.forgeplan-web/` to ./.gitignore (default true; pass --no-gitignore to skip)",
    },
    experimental: {
      type: "boolean",
      description:
        "[EXPERIMENTAL] use the bundled single-file dist (~9x smaller, no node_modules/)",
    },
    // TODO(109b): scope flag declared, not yet consumed — see PRD-025
    scope: {
      type: "string",
      description:
        "[reserved for PRD-025] scope of the scaffold: user|project (no-op in this release)",
      valueHint: "user|project",
    },
  },
  async run({ args }) {
    const QUIET = args.quiet === true;
    const FORCE = args.force === true;
    // citty: --no-gitignore parses to args.gitignore = false; default is true.
    const SKIP_GITIGNORE = args.gitignore === false;
    const EXPERIMENTAL = args.experimental === true;

    const log = (line) => {
      if (!QUIET) process.stdout.write(line + "\n");
    };

    const DIST_DIR = EXPERIMENTAL ? DIST_DIR_EXPERIMENTAL : DIST_DIR_LEGACY;

    const cwd = process.cwd();
    ensureForgeplanWorkspace(cwd, fail);
    ensureForgeplanBinary(fail);

    if (EXPERIMENTAL) {
      log(
        "⚠ Using experimental bundled dist (single-file server, no node_modules/).",
      );
      log(
        "  Report issues at https://github.com/ForgePlan/forgeplan-web/issues",
      );
    }

    const target = join(cwd, ".forgeplan-web");
    const fresh = !existsSync(target);
    log(fresh ? `→ creating ${target}` : `→ updating ${target}`);
    copyDir(DIST_DIR, target, FORCE);

    const now = new Date().toISOString();
    const existing = fresh ? null : readConfig(target);
    const cfg = {
      workspaceRoot: cwd,
      createdAt: existing?.createdAt ?? now,
      version: readPkgVersion() ?? existing?.version ?? null,
      updatedAt: now,
      experimental: EXPERIMENTAL,
    };
    writeFileSync(join(target, CFG_FILE), JSON.stringify(cfg, null, 2) + "\n");

    ensureGitignore({ cwd, skip: SKIP_GITIGNORE, log });

    log("");
    log("✓ ready (no install needed)");
    log("  npx @forgeplan/web start");
    log("  # or: node .forgeplan-web/index.js");
  },
});
