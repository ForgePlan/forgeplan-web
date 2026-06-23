import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function ensureForgeplanWorkspace(cwd, fail) {
  const fpDir = join(cwd, ".forgeplan");
  if (!existsSync(fpDir)) {
    fail(
      `no .forgeplan/ directory found in ${cwd}.\n` +
        `       Run \`forgeplan init -y\` here first, then re-run \`npx @forgeplan/web init\`.`,
    );
  }
}

export function ensureForgeplanBinary(fail) {
  // Windows: `forgeplan` resolves to forgeplan.cmd (npm/scoop install).
  // Node spawnSync can't invoke .cmd without shell:true — fails with
  // status=null and the error mimics "binary missing", confusing users.
  const probe = spawnSync("forgeplan", ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  if (probe.status !== 0) {
    fail(
      `\`forgeplan\` binary is not on PATH.\n` +
        `       Install it from https://github.com/ForgePlan/forgeplan and re-run.`,
    );
  }
}
