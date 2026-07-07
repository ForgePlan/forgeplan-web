#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TEMPLATE = join(ROOT, "template");
const TEMPLATE_BUILD = join(TEMPLATE, "build");
const CONFIG_DIR = join(ROOT, "config");
const IMAGES_FILE = join(CONFIG_DIR, "images.json");
const FEATURES_FILE = join(CONFIG_DIR, "features.json");
const PKG_FILE = join(ROOT, "package.json");

// PRD-030 / RFC-026 / ADR-005: every emitted image directory is bound by the
// same size cap. The bundle alone is ~600K-1M; keeping headroom for client/
// + future small additions, while alarming on accidental bloat.
// Raised 3M -> 3.5M to accommodate the lazy-loaded 3D Map minimap
// (three.js + Threlte, ~808K client chunk, loaded only when the Map view
// opens). TODO(iso-adr): record the deliberate bump in an ADR amending
// PRD-030 NFR-005 before this ships.
const IMAGE_DIST_MAX_BYTES = 3.5 * 1024 * 1024;

// Lifecycle policy (PRD-030 NFR-005, RFC-026 Phase 1): a flag's expiresIn
// must not be more than this many minor versions past addedIn (within the
// same major). Major bumps reset the clock.
const FLAG_MAX_MINOR_LIFETIME = 3;

const args = new Set(process.argv.slice(2));
const CLEAN_ONLY = args.has("--clean");
const SKIP_TEMPLATE_INSTALL = args.has("--skip-template-install");
const ONLY_IMAGE = (() => {
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--only=")) return a.slice("--only=".length);
  }
  return null;
})();

function log(line) {
  process.stdout.write(`[build] ${line}\n`);
}

function failBuild(line, code = 1) {
  process.stderr.write(`[build] FAIL: ${line}\n`);
  process.exit(code);
}

function run(cmd, argv, cwd) {
  log(`$ ${cmd} ${argv.join(" ")}  (cwd=${cwd.replace(ROOT, ".")})`);
  // Windows: `npm` resolves to `npm.cmd` (batch script). Node's spawnSync
  // can't invoke .cmd/.bat without a shell — fails fast with exit=null.
  // shell:true is safe here: argv is hardcoded by this build pipeline,
  // never user input. macOS/Linux keep the no-shell fast path.
  const r = spawnSync(cmd, argv, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    failBuild(`${cmd} ${argv.join(" ")} → exit ${r.status}`, r.status ?? 1);
  }
}

// ---- semver ---------------------------------------------------------------

function parseSemver(v) {
  if (typeof v !== "string") return null;
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(v);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    raw: v,
  };
}

function semverGTE(a, b) {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

// ---- config + lifecycle validator ----------------------------------------

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readPkg() {
  return readJsonFile(PKG_FILE);
}

function readImages() {
  return readJsonFile(IMAGES_FILE);
}

function readFeatures() {
  return readJsonFile(FEATURES_FILE);
}

function validateConfig({ images, features, currentVersion }) {
  const errors = [];
  const featureById = new Map();

  const featureList = features.features ?? [];
  if (!Array.isArray(featureList)) {
    errors.push(
      `config/features.json: \`features\` must be an array, got ${typeof featureList}`,
    );
    return errors;
  }

  for (const feat of featureList) {
    if (!feat || typeof feat !== "object") {
      errors.push("config/features.json: feature entry must be an object");
      continue;
    }
    if (typeof feat.id !== "string" || feat.id.length === 0) {
      errors.push(
        "config/features.json: feature `id` must be a non-empty string",
      );
      continue;
    }
    if (featureById.has(feat.id)) {
      errors.push(`config/features.json: duplicate feature id "${feat.id}"`);
      continue;
    }
    featureById.set(feat.id, feat);

    const added = parseSemver(feat.addedIn);
    const expires = parseSemver(feat.expiresIn);
    if (!added) {
      errors.push(
        `config/features.json: feature "${feat.id}" has invalid addedIn "${feat.addedIn}"`,
      );
      continue;
    }
    if (!expires) {
      errors.push(
        `config/features.json: feature "${feat.id}" has invalid expiresIn "${feat.expiresIn}"`,
      );
      continue;
    }
    if (!semverGTE(expires, added) || expires.raw === added.raw) {
      errors.push(
        `config/features.json: feature "${feat.id}" has expiresIn (${expires.raw}) <= addedIn (${added.raw})`,
      );
    }
    if (
      added.major === expires.major &&
      expires.minor - added.minor > FLAG_MAX_MINOR_LIFETIME
    ) {
      errors.push(
        `config/features.json: feature "${feat.id}" lifetime ${expires.raw}-${added.raw} exceeds ${FLAG_MAX_MINOR_LIFETIME} minor versions; graduate or drop it (rule: PRD-030 NFR-005)`,
      );
    }
    if (currentVersion && semverGTE(currentVersion, expires)) {
      errors.push(
        `config/features.json: feature "${feat.id}" expired (expiresIn=${expires.raw}, currentVersion=${currentVersion.raw}); remove from features.json + every image's features array`,
      );
    }
  }

  if (
    !images ||
    typeof images !== "object" ||
    !images.images ||
    typeof images.images !== "object"
  ) {
    errors.push("config/images.json: missing or malformed `images` object");
    return errors;
  }

  const imageNameRe = /^[a-z][a-z0-9-]{0,31}$/;
  for (const [name, image] of Object.entries(images.images)) {
    if (!imageNameRe.test(name)) {
      errors.push(`config/images.json: invalid image name "${name}"`);
    }
    if (!image || typeof image !== "object") {
      errors.push(`config/images.json: image "${name}" must be an object`);
      continue;
    }
    if (!Array.isArray(image.features)) {
      errors.push(
        `config/images.json: image "${name}".features must be an array`,
      );
      continue;
    }
    for (const flagId of image.features) {
      if (!featureById.has(flagId)) {
        errors.push(
          `config/images.json: image "${name}" references unknown flag "${flagId}" (declare it in config/features.json first)`,
        );
      }
    }
  }

  if (!images.images.stable) {
    errors.push(
      'config/images.json: image "stable" must always be defined (PRD-030 FR-007)',
    );
  }

  return errors;
}

function ensurePackageFilesCoverage({ pkg, imageNames }) {
  const filesArr = pkg.files ?? [];
  const needed = imageNames.map((n) => (n === "stable" ? "dist" : `dist-${n}`));
  const missing = needed.filter((dir) => !filesArr.includes(dir));
  if (missing.length > 0) {
    failBuild(
      `package.json#files is missing image directories: ${missing.join(", ")}.\n` +
        `       Add them to "files" in package.json so the npm tarball ships them.`,
    );
  }
}

// ---- common build helpers (shared by all images) -------------------------

function clean() {
  for (const p of [
    join(TEMPLATE_BUILD),
    join(TEMPLATE, ".svelte-kit"),
    join(ROOT, "dist"),
  ]) {
    if (existsSync(p)) {
      log(`rm -rf ${p.replace(ROOT, ".")}`);
      rmSync(p, { recursive: true, force: true });
    }
  }
  // Sweep dist-<name>/ siblings too — we recreate them on every build.
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      entry.name.startsWith("dist-") &&
      // Don't touch unrelated dirs that happen to share the prefix; only
      // delete `dist-<image-name>/` shapes (lowercase, kebab-case).
      /^dist-[a-z][a-z0-9-]*$/.test(entry.name)
    ) {
      const p = join(ROOT, entry.name);
      log(`rm -rf ${p.replace(ROOT, ".")}`);
      rmSync(p, { recursive: true, force: true });
    }
  }
}

function installTemplateDeps() {
  if (SKIP_TEMPLATE_INSTALL && existsSync(join(TEMPLATE, "node_modules"))) {
    log("template/node_modules exists — skipping install");
    return;
  }
  run("npm", ["install", "--no-fund", "--no-audit"], TEMPLATE);
}

function buildSvelteKit() {
  run("npm", ["run", "build"], TEMPLATE);
  if (!existsSync(join(TEMPLATE_BUILD, "index.js"))) {
    failBuild(
      "template/build/index.js missing — adapter-node did not produce a server entry",
    );
  }
}

function patchHostDefault(root) {
  // adapter-node bakes `env('HOST', '0.0.0.0')` into index.js. The bin wrapper
  // sets HOST=127.0.0.1, but `node .forgeplan-web/index.js` (documented in
  // README) inherits the upstream default and binds to all interfaces. Patch
  // the literal so direct invocation matches the documented loopback default.
  const indexPath = join(root, "index.js");
  if (!existsSync(indexPath)) return;
  const src = readFileSync(indexPath, "utf8");
  // The unminified form is `env('HOST', '0.0.0.0')`. esbuild minify renames
  // `env` to a short identifier (e.g. `Ue`); capture whatever the minifier
  // chose and reuse it in the replacement so both shapes work.
  const PATTERN =
    /([A-Za-z_$][A-Za-z0-9_$]*)\(\s*['"]HOST['"]\s*,\s*['"]0\.0\.0\.0['"]\s*\)/;
  const m = src.match(PATTERN);
  if (!m) {
    log(
      "patchHostDefault: HOST literal not found — adapter-node may have changed; review build",
    );
    return;
  }
  writeFileSync(
    indexPath,
    src.replace(PATTERN, `${m[1]}('HOST', '127.0.0.1')`),
  );
  log(
    `patched HOST default 0.0.0.0 → 127.0.0.1 in ${indexPath.replace(ROOT, ".")} (env=${m[1]})`,
  );
}

function dirSizeBytes(dir) {
  let total = 0;
  const walk = (d) => {
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.isFile()) total += statSync(p).size;
    }
  };
  walk(dir);
  return total;
}

// ---- bundle + per-image emission -----------------------------------------

// Build one bundle per build run. The bundle bytes are identical across every
// image that shares the same flag set; today every image ships an empty flag
// set, so we bundle exactly once and copy. Once a flag actually affects the
// bundle bytes, this function will need to grow a per-image rebuild path.
async function bundleBaseDist(baseDir) {
  const { build } = await import("esbuild");
  const tplPkg = readJsonFile(join(TEMPLATE, "package.json"));

  if (existsSync(baseDir)) {
    rmSync(baseDir, { recursive: true, force: true });
  }
  mkdirSync(baseDir, { recursive: true });

  // Copy the parts esbuild can't (won't) inline:
  // - client/ static assets are served by sirv at runtime;
  // - env.js is loaded via SvelteKit's `$env/dynamic/*` import (string-literal
  //   `import()` that esbuild conservatively keeps external).
  cpSync(join(TEMPLATE_BUILD, "client"), join(baseDir, "client"), {
    recursive: true,
    dereference: false,
  });
  cpSync(join(TEMPLATE_BUILD, "env.js"), join(baseDir, "env.js"));

  const result = await build({
    entryPoints: [join(TEMPLATE_BUILD, "index.js")],
    outfile: join(baseDir, "index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "bundle",
    // adapter-node bundle uses `require()` in places (sirv, polka shims).
    // ESM bundles need an injected createRequire to keep those paths working.
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
    logLevel: "warning",
    legalComments: "none",
    treeShaking: true,
    minify: true,
    keepNames: true,
    metafile: false,
  });

  if (result.errors && result.errors.length > 0) {
    failBuild(`esbuild reported ${result.errors.length} error(s)`);
  }
  if (result.warnings && result.warnings.length > 0) {
    log(
      `bundleBaseDist: esbuild emitted ${result.warnings.length} warning(s) (non-fatal)`,
    );
  }

  patchHostDefault(baseDir);

  const distPkg = {
    name: "forgeplan-web-runtime",
    version: tplPkg.version ?? "0.0.0",
    private: true,
    type: "module",
    engines: tplPkg.engines,
    scripts: { start: "node index.js" },
  };
  writeFileSync(
    join(baseDir, "package.json"),
    JSON.stringify(distPkg, null, 2) + "\n",
  );

  // Shape assertions — the bundle must NEVER contain node_modules/ or
  // server/ chunks. Both indicate a regression in `packages: "bundle"`.
  if (existsSync(join(baseDir, "node_modules"))) {
    failBuild(
      `${baseDir.replace(ROOT, ".")}/node_modules/ exists (should be inlined into index.js)`,
    );
  }
  if (existsSync(join(baseDir, "server"))) {
    failBuild(
      `${baseDir.replace(ROOT, ".")}/server/ exists (chunks were not inlined; check for new dynamic imports in adapter-node output)`,
    );
  }
}

function emitImageDist({ imageName, features, baseDir, pkgVersion }) {
  const targetName = imageName === "stable" ? "dist" : `dist-${imageName}`;
  const target = join(ROOT, targetName);

  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  mkdirSync(target, { recursive: true });
  cpSync(baseDir, target, {
    recursive: true,
    dereference: false,
    force: true,
  });

  const manifest = {
    name: "@forgeplan/web",
    version: pkgVersion ?? "0.0.0",
    builtAt: new Date().toISOString(),
    entry: "index.js",
    image: imageName,
    features,
  };
  writeFileSync(
    join(target, "forgeplan-web-build.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const totalBytes = dirSizeBytes(target);
  if (totalBytes > IMAGE_DIST_MAX_BYTES) {
    failBuild(
      `${targetName}/ is ${(totalBytes / 1024 / 1024).toFixed(2)}M, cap is ${(IMAGE_DIST_MAX_BYTES / 1024 / 1024).toFixed(0)}M (raise IMAGE_DIST_MAX_BYTES if intentional)`,
    );
  }
  log(
    `${targetName}/ ready (${(totalBytes / 1024 / 1024).toFixed(2)}M, image=${imageName}, features=${features.length})`,
  );
}

// ---- top-level pipeline --------------------------------------------------

if (CLEAN_ONLY) {
  clean();
  process.exit(0);
}

const pkg = readPkg();
const currentVersion = parseSemver(pkg.version);
if (!currentVersion) {
  failBuild(
    `package.json#version "${pkg.version}" is not a valid semver — feature lifecycle validator needs a parseable version`,
  );
}

const images = readImages();
const features = readFeatures();

const validationErrors = validateConfig({
  images,
  features,
  currentVersion,
});
if (validationErrors.length > 0) {
  for (const err of validationErrors) {
    process.stderr.write(`[build] config error: ${err}\n`);
  }
  process.exit(1);
}

const allImageNames = Object.keys(images.images);
const imagesToBuild = ONLY_IMAGE
  ? allImageNames.filter((n) => n === ONLY_IMAGE)
  : allImageNames;
if (ONLY_IMAGE && imagesToBuild.length === 0) {
  failBuild(
    `--only=${ONLY_IMAGE} did not match any image in config/images.json. Available: ${allImageNames.join(", ")}`,
  );
}

ensurePackageFilesCoverage({ pkg, imageNames: allImageNames });

if (!ONLY_IMAGE) clean();
installTemplateDeps();
buildSvelteKit();

const BASE_DIR = join(ROOT, ".dist-base");
await bundleBaseDist(BASE_DIR);

for (const imageName of imagesToBuild) {
  emitImageDist({
    imageName,
    features: images.images[imageName].features,
    baseDir: BASE_DIR,
    pkgVersion: pkg.version,
  });
}

// .dist-base/ is an internal staging dir — not shipped, not gitted.
rmSync(BASE_DIR, { recursive: true, force: true });

log(`done. images built: ${imagesToBuild.join(", ")}`);
