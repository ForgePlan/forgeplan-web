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

const DIST_DIR_LEGACY = join(PKG_ROOT, "dist");
const DIST_DIR_EXPERIMENTAL = join(PKG_ROOT, "dist-experimental");

function fail(line, code = 1) {
  process.stderr.write(`forgeplan-web: ${line}\n`);
  process.exit(code);
}

export default defineCommand({
  meta: {
    name: "update",
    description:
      "Refresh ./.forgeplan-web/ to the version bundled with the currently-resolved @forgeplan/web package.",
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

    const log = (line) => {
      if (!QUIET) process.stdout.write(line + "\n");
    };

    const cwd = process.cwd();
    ensureForgeplanWorkspace(cwd, fail);
    ensureForgeplanBinary(fail);

    const target = join(cwd, ".forgeplan-web");
    if (!existsSync(target)) {
      fail(
        `no scaffold at ${target}.\n` +
          `       Run \`npx @forgeplan/web init\` first.`,
      );
    }

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
      log(`✓ already at v${toVersion}`);
      log("  Use --force to re-copy anyway.");
      return;
    }

    const fromLabel = fromVersion ? `v${fromVersion}` : "unknown";
    const toLabel = toVersion ? `v${toVersion}` : "unknown";
    log(`→ updating ${target} (${fromLabel} → ${toLabel})`);

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

    // FR-003: defense-in-depth — even though target is constructed from
    // join(cwd, '.forgeplan-web'), assert post-resolve equality so any
    // future refactor (env override, alias) cannot widen the rmSync blast
    // radius beyond the canonical path.
    const expected = resolve(join(cwd, ".forgeplan-web"));
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
      workspaceRoot: existing?.workspaceRoot ?? cwd,
      createdAt: existing?.createdAt ?? now,
      version: toVersion,
      updatedAt: now,
      experimental: useExperimental,
    };
    writeFileSync(join(target, CFG_FILE), JSON.stringify(cfg, null, 2) + "\n");

    log("");
    log(`✓ updated to ${toLabel}`);
    log("  npx @forgeplan/web start");
  },
});
