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
  // implicit: prefer project-scope in cwd; fall back to user-scope.
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
  return null; // unreachable; fail() exits
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
    experimental: {
      type: "boolean",
      description:
        "switch to the experimental bundled dist (overrides persisted choice)",
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

    // PRD-014 / RFC-013: pick the same dist shape the user opted into at
    // init-time. CLI flag overrides the persisted choice (lets users migrate
    // both directions without rm -rf). Falls back to legacy default.
    // citty auto-handles `--no-experimental` by setting `args.experimental = false`.
    const experimentalFlagPassed = args.experimental !== undefined;
    const useExperimental = experimentalFlagPassed
      ? args.experimental === true
      : existing?.experimental === true;
    const sourceDir = useExperimental
      ? DIST_DIR_EXPERIMENTAL
      : DIST_DIR_LEGACY;

    if (!FORCE && fromVersion && toVersion && fromVersion === toVersion) {
      log(`✓ already at v${toVersion} (scope: ${scope})`);
      log("  Use --force to re-copy anyway.");
      return;
    }

    const fromLabel = fromVersion ? `v${fromVersion}` : "unknown";
    const toLabel = toVersion ? `v${toVersion}` : "unknown";
    log(`→ updating ${target} (${fromLabel} → ${toLabel}, scope: ${scope})`);

    if (!existsSync(sourceDir)) {
      fail(
        `pre-built artifact missing at ${sourceDir}.\n` +
          `       Reinstall @forgeplan/web or build from source via \`npm run build\`.`,
      );
    }

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
    // the two canonical scope paths before destructive ops, so any future
    // refactor cannot widen the rmSync blast radius.
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
      experimental: useExperimental,
      scope,
    };
    writeFileSync(join(target, CFG_FILE), JSON.stringify(cfg, null, 2) + "\n");

    log("");
    log(`✓ updated to ${toLabel} (scope: ${scope})`);
    log("  npx @forgeplan/web start");
  },
});
