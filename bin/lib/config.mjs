import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PKG_ROOT = resolve(__dirname, "..", "..");
export const CFG_FILE = "forgeplan-web.json";

export function readConfig(target) {
  const cfgPath = join(target, CFG_FILE);
  if (!existsSync(cfgPath)) return null;
  try {
    return JSON.parse(readFileSync(cfgPath, "utf8"));
  } catch {
    return null;
  }
}

export function readWorkspaceRoot(target) {
  return readConfig(target)?.workspaceRoot ?? null;
}

export function readPkgVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(join(PKG_ROOT, "package.json"), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}
