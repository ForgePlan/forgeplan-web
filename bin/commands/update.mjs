import { defineCommand } from "citty";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
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
import {
  imagePath,
  isValidImageName,
  listAvailableImages,
  NIGHTLY_IMAGE,
  STABLE_IMAGE,
} from "../lib/images.mjs";
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

function resolveTargetForUpdate({ explicitScope, cwd }) {
  if (explicitScope === "user") {
    const root = userScopePath();
    if (!existsSync(root)) {
      fail(
        `--scope user: no scaffold at ${root}.\n` +
          `       Run \`npx @forgeplan/web init --scope user\` first.`,
      );
    }
    return { scope: "user", target: root };
  }
  if (explicitScope === "project") {
    const root = projectScopePath(cwd);
    if (!existsSync(root)) {
      fail(
        `--scope project: no scaffold at ${root}.\n` +
          `       Run \`npx @forgeplan/web init --scope project\` first.`,
      );
    }
    return { scope: "project", target: root };
  }
  const projectRoot = projectScopePath(cwd);
  if (existsSync(projectRoot)) {
    return { scope: "project", target: projectRoot };
  }
  const userRoot = userScopePath();
  if (existsSync(userRoot)) {
    return { scope: "user", target: userRoot };
  }
  fail(
    `no scaffold found at ${projectRoot} or ${userRoot}.\n` +
      `       Run \`npx @forgeplan/web init [--scope user|project]\` first.`,
  );
  return null;
}

function resolvePersistedImage(existingCfg) {
  if (typeof existingCfg?.image === "string" && isValidImageName(existingCfg.image)) {
    return existingCfg.image;
  }
  // FR-005: backwards-compat — older scaffolds wrote `experimental: true`
  // before the --image flag existed. Treat as `nightly` and overwrite.
  if (existingCfg?.experimental === true) {
    return NIGHTLY_IMAGE;
  }
  return STABLE_IMAGE;
}

export default defineCommand({
  meta: {
    name: "update",
    description:
      "Refresh a `.forgeplan-web/` scaffold (project- or user-scope) to the version bundled with the currently-resolved @forgeplan/web package.",
    alias: ["upgrade"],
  },
  args: {
    force: {
      type: "boolean",
      description: "re-copy even when versions match",
    },
    quiet: {
      type: "boolean",
      alias: "q",
      description: "suppress informational output",
    },
    image: {
      type: "string",
      description:
        "switch to a specific image (default: keep persisted choice; new scaffolds: stable)",
      valueHint: "stable|nightly",
    },
    experimental: {
      type: "boolean",
      description:
        "[DEPRECATED] alias for --image nightly; will be removed in 0.3.0",
    },
    scope: {
      type: "string",
      description:
        "scope of the scaffold to update: user (~/.forgeplan-web/) or project (./.forgeplan-web/)",
      valueHint: "user|project",
    },
  },
  async run({ args }) {
    const QUIET = args.quiet === true;
    const FORCE = args.force === true;

    const log = (line) => {
      if (!QUIET) process.stdout.write(line + "\n");
    };

    let explicitScope = null;
    if (args.scope) {
      if (!isValidScope(args.scope)) {
        fail(
          `invalid --scope value "${args.scope}"; expected "user" or "project".`,
        );
      }
      explicitScope = args.scope;
    }

    const cwd = process.cwd();
    const { scope, target } = resolveTargetForUpdate({
      explicitScope,
      cwd,
    });

    if (scope === "project") {
      ensureForgeplanWorkspace(cwd, fail);
    }
    ensureForgeplanBinary(fail);

    const existing = readConfig(target);
    const fromVersion = existing?.version ?? null;
    const toVersion = readPkgVersion();

    let image = resolvePersistedImage(existing);
    if (typeof args.image === "string" && args.image.length > 0) {
      if (!isValidImageName(args.image)) {
        fail(
          `invalid --image value "${args.image}"; expected lowercase kebab-case (e.g. "stable", "nightly").`,
        );
      }
      image = args.image;
    } else if (args.experimental === true) {
      // TODO(0.3.0): drop --experimental alias entirely (PRD-030 / RFC-026 FR-006).
      process.stderr.write(
        `forgeplan-web: warning: --experimental is deprecated and will be removed in 0.3.0; use --image ${NIGHTLY_IMAGE} instead.\n`,
      );
      image = NIGHTLY_IMAGE;
    }

    const sourceDir = imagePath(PKG_ROOT, image);
    if (!existsSync(sourceDir)) {
      const available = listAvailableImages(PKG_ROOT);
      fail(
        `image "${image}" not bundled in this @forgeplan/web (looked for ${sourceDir}).\n` +
          `       Available image(s): ${available.length > 0 ? available.join(", ") : "(none)"}.`,
      );
    }

    const fromImage = existing?.image ?? (existing?.experimental ? NIGHTLY_IMAGE : null);
    const sameVersion =
      !FORCE && fromVersion && toVersion && fromVersion === toVersion;
    const sameImage = !fromImage || fromImage === image;
    if (sameVersion && sameImage) {
      log(`✓ already at v${toVersion} (scope: ${scope}, image: ${image})`);
      log("  Use --force to re-copy anyway.");
      return;
    }

    const fromLabel = fromVersion ? `v${fromVersion}` : "unknown";
    const toLabel = toVersion ? `v${toVersion}` : "unknown";
    const imageNote = fromImage && fromImage !== image ? ` (image ${fromImage} → ${image})` : "";
    log(
      `→ updating ${target} (${fromLabel} → ${toLabel}, scope: ${scope}, image: ${image}${imageNote ? "" : ""})${imageNote}`,
    );

    // FR-002: rmSync follows symlinks; a symlinked .forgeplan-web would
    // delete the link's target tree (CWE-59). Refuse before destructive ops.
    const targetStat = lstatSync(target);
    if (targetStat.isSymbolicLink()) {
      fail(
        `refusing to follow symlink at ${target}.\n` +
          `       \`update\` will not rmSync through a symlinked .forgeplan-web/.\n` +
          `       Remove the symlink manually and re-run.`,
      );
    }

    // FR-003: defense-in-depth — assert the resolved target equals one of
    // the two canonical scope paths before destructive ops.
    const expected = resolve(scopePath(scope, cwd));
    if (resolve(target) !== expected) {
      fail(
        `refusing to rmSync unexpected path ${resolve(target)} (expected ${expected}).`,
      );
    }

    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    cpSync(sourceDir, target, {
      recursive: true,
      dereference: false,
      force: true,
    });

    const now = new Date().toISOString();
    const cfg = {
      workspaceRoot:
        scope === "project" ? cwd : (existing?.workspaceRoot ?? null),
      createdAt: existing?.createdAt ?? now,
      version: toVersion,
      updatedAt: now,
      image,
      scope,
    };
    writeFileSync(join(target, CFG_FILE), JSON.stringify(cfg, null, 2) + "\n");

    log("");
    log(`✓ updated to ${toLabel} (scope: ${scope}, image: ${image})`);
    log("  npx @forgeplan/web start");
  },
});
