import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CFG_FILE } from "./config.mjs";

export const SCAFFOLD_DIRNAME = ".forgeplan-web";

export function userScopePath() {
  return join(homedir(), SCAFFOLD_DIRNAME);
}

export function projectScopePath(cwd) {
  return join(cwd, SCAFFOLD_DIRNAME);
}

export function scopePath(scope, cwd) {
  if (scope === "user") return userScopePath();
  if (scope === "project") return projectScopePath(cwd);
  throw new Error(`unknown scope: ${scope}`);
}

export function isValidScope(s) {
  return s === "user" || s === "project";
}

export function probeScaffold(root) {
  if (!root || !existsSync(root)) return null;
  if (!existsSync(join(root, "index.js"))) return null;
  return {
    path: root,
    configPath: join(root, CFG_FILE),
  };
}

export function findScaffold({ cwd, scope }) {
  if (scope === "project") {
    const p = projectScopePath(cwd);
    const hit = probeScaffold(p);
    return hit ? { ...hit, scope: "project" } : null;
  }
  if (scope === "user") {
    const p = userScopePath();
    const hit = probeScaffold(p);
    return hit ? { ...hit, scope: "user" } : null;
  }
  const proj = probeScaffold(projectScopePath(cwd));
  if (proj) return { ...proj, scope: "project" };
  const usr = probeScaffold(userScopePath());
  if (usr) return { ...usr, scope: "user" };
  return null;
}

export function resolveScope({ explicit, yes }) {
  if (explicit !== undefined && explicit !== null && explicit !== "") {
    if (!isValidScope(explicit)) {
      throw new Error(
        `invalid --scope value "${explicit}"; expected "user" or "project"`,
      );
    }
    return explicit;
  }
  if (yes) return "project";
  return null;
}
