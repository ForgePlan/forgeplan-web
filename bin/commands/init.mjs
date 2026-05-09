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
import {
  imagePath,
  isValidImageName,
  listAvailableImages,
  NIGHTLY_IMAGE,
  STABLE_IMAGE,
} from "../lib/images.mjs";
import { promptScope } from "../lib/prompt.mjs";
import {
  isValidScope,
  projectScopePath,
  scopePath,
  userScopePath,
} from "../lib/scope.mjs";

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
  image = STABLE_IMAGE,
  force = false,
  quiet = false,
  skipGitignore = false,
  cwd = process.cwd(),
} = {}) {
  if (!isValidScope(scope)) {
    fail(`internal: runInit called with invalid scope "${scope}"`);
  }
  if (!isValidImageName(image)) {
    fail(
      `invalid --image value "${image}"; expected one of: ${
        listAvailableImages(PKG_ROOT).join(", ") || "stable"
      }.`,
    );
  }

  const log = (line) => {
    if (!quiet) process.stdout.write(line + "\n");
  };

  const sourceDir = imagePath(PKG_ROOT, image);
  if (!existsSync(sourceDir)) {
    const available = listAvailableImages(PKG_ROOT);
    fail(
      `image "${image}" not bundled in this @forgeplan/web (looked for ${sourceDir}).\n` +
        `       Available image(s): ${available.length > 0 ? available.join(", ") : "(none)"}.`,
    );
  }

  if (scope === "project") {
    ensureForgeplanWorkspace(cwd, fail);
  }
  ensureForgeplanBinary(fail);

  if (image !== STABLE_IMAGE) {
    log(
      `⚠ Using image "${image}" (non-stable). Behaviour may change between releases.`,
    );
  }

  const target = scopePath(scope, cwd);
  const fresh = !existsSync(target);
  log(fresh ? `→ creating ${target}` : `→ updating ${target}`);
  copyDir(sourceDir, target, force);

  const now = new Date().toISOString();
  const existing = fresh ? null : readConfig(target);
  const cfg = {
    workspaceRoot: scope === "project" ? cwd : (existing?.workspaceRoot ?? null),
    createdAt: existing?.createdAt ?? now,
    version: readPkgVersion() ?? existing?.version ?? null,
    updatedAt: now,
    image,
    scope,
  };
  writeFileSync(join(target, CFG_FILE), JSON.stringify(cfg, null, 2) + "\n");

  if (scope === "project") {
    ensureGitignore({ cwd, skip: skipGitignore, log });
  }

  log("");
  log(
    scope === "user"
      ? `✓ ready (scope: user — ${userScopePath()}, image: ${image})`
      : `✓ ready (scope: project — ${projectScopePath(cwd)}, image: ${image})`,
  );
  log("  npx @forgeplan/web start");
  if (scope === "project") {
    log("  # or: node .forgeplan-web/index.js");
  }

  return { scope, target, image };
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
    image: {
      type: "string",
      description: `image name (default: ${STABLE_IMAGE}); see config/IMAGES.md`,
      valueHint: "stable|nightly",
    },
    experimental: {
      type: "boolean",
      description: `[DEPRECATED] alias for --image ${NIGHTLY_IMAGE}; will be removed in 0.3.0`,
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

    let image = STABLE_IMAGE;
    if (typeof args.image === "string" && args.image.length > 0) {
      if (!isValidImageName(args.image)) {
        fail(
          `invalid --image value "${args.image}"; expected lowercase kebab-case (e.g. "stable", "nightly").`,
        );
      }
      image = args.image;
    } else if (EXPERIMENTAL) {
      // TODO(0.3.0): drop --experimental alias entirely (PRD-030 / RFC-026 FR-006).
      process.stderr.write(
        `forgeplan-web: warning: --experimental is deprecated and will be removed in 0.3.0; use --image ${NIGHTLY_IMAGE} instead.\n`,
      );
      image = NIGHTLY_IMAGE;
    }

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
      image,
      force: FORCE,
      quiet: QUIET,
      skipGitignore: SKIP_GITIGNORE,
    });
  },
});
