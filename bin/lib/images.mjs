import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const STABLE_IMAGE = "stable";
export const NIGHTLY_IMAGE = "nightly";

const IMAGE_NAME_RE = /^[a-z][a-z0-9-]{0,31}$/;

export function isValidImageName(name) {
  return typeof name === "string" && IMAGE_NAME_RE.test(name);
}

export function imageDirName(imageName) {
  if (!isValidImageName(imageName)) {
    throw new Error(`invalid image name "${imageName}"`);
  }
  return imageName === STABLE_IMAGE ? "dist" : `dist-${imageName}`;
}

export function imagePath(pkgRoot, imageName) {
  return join(pkgRoot, imageDirName(imageName));
}

export function listAvailableImages(pkgRoot) {
  let entries;
  try {
    entries = readdirSync(pkgRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "dist") {
      seen.add(STABLE_IMAGE);
    } else if (entry.name.startsWith("dist-")) {
      const candidate = entry.name.slice("dist-".length);
      if (isValidImageName(candidate)) seen.add(candidate);
    }
  }
  const ordered = [];
  if (seen.has(STABLE_IMAGE)) {
    ordered.push(STABLE_IMAGE);
    seen.delete(STABLE_IMAGE);
  }
  for (const name of [...seen].sort()) ordered.push(name);
  return ordered;
}

export function resolveImageDir(pkgRoot, imageName) {
  const dir = imagePath(pkgRoot, imageName);
  if (!existsSync(dir)) return null;
  return dir;
}
