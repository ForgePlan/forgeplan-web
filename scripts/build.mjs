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
const DIST = join(ROOT, "dist");
const DIST_EXPERIMENTAL = join(ROOT, "dist-experimental");
// PRD-014 / RFC-013: cap for the experimental bundled dist. If esbuild
// starts pulling more (svelte upgrade, accidental client-side imports),
// fail loudly instead of silently bloating the tarball.
const DIST_EXPERIMENTAL_MAX_BYTES = 3 * 1024 * 1024;

const args = new Set(process.argv.slice(2));
const CLEAN_ONLY = args.has("--clean");
const SKIP_TEMPLATE_INSTALL = args.has("--skip-template-install");
const SKIP_EXPERIMENTAL = args.has("--skip-experimental");

function log(line) {
  process.stdout.write(`[build] ${line}\n`);
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
    process.stderr.write(
      `[build] FAIL: ${cmd} ${argv.join(" ")} → exit ${r.status}\n`,
    );
    process.exit(r.status ?? 1);
  }
}

function clean() {
  for (const p of [
    DIST,
    DIST_EXPERIMENTAL,
    TEMPLATE_BUILD,
    join(TEMPLATE, ".svelte-kit"),
  ]) {
    if (existsSync(p)) {
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
    process.stderr.write(
      "[build] FAIL: template/build/index.js missing — adapter-node did not produce a server entry\n",
    );
    process.exit(1);
  }
}

function emitDistPackageJson() {
  const tplPkg = JSON.parse(
    readFileSync(join(TEMPLATE, "package.json"), "utf8"),
  );
  const distPkg = {
    name: "forgeplan-web-runtime",
    version: tplPkg.version ?? "0.0.0",
    private: true,
    type: "module",
    engines: tplPkg.engines,
    dependencies: tplPkg.dependencies ?? {},
    scripts: {
      start: "node index.js",
    },
  };
  writeFileSync(
    join(TEMPLATE_BUILD, "package.json"),
    JSON.stringify(distPkg, null, 2) + "\n",
  );
  log(
    `emitted template/build/package.json (${Object.keys(distPkg.dependencies).length} runtime deps)`,
  );
}

function installRuntimeDeps() {
  // FR-005 / CWE-1357: --ignore-scripts blocks transitive postinstall hooks
  // from baking attacker-controlled code into published dist/node_modules/.
  run(
    "npm",
    [
      "install",
      "--omit=dev",
      "--omit=peer",
      "--no-fund",
      "--no-audit",
      "--ignore-scripts",
    ],
    TEMPLATE_BUILD,
  );
}

function stripSourceMaps(root) {
  let removed = 0;
  let strippedRefs = 0;
  const SOURCEMAP_RE = /\n?\/\/# sourceMappingURL=.*$/m;

  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        walk(p);
      } else if (name.endsWith(".map")) {
        rmSync(p, { force: true });
        removed += 1;
      } else if (
        name.endsWith(".js") ||
        name.endsWith(".mjs") ||
        name.endsWith(".cjs")
      ) {
        const src = readFileSync(p, "utf8");
        if (SOURCEMAP_RE.test(src)) {
          writeFileSync(p, src.replace(SOURCEMAP_RE, ""));
          strippedRefs += 1;
        }
      }
    }
  };

  walk(root);
  log(
    `stripped sourcemaps: removed ${removed} .map file(s), cleared ${strippedRefs} sourceMappingURL ref(s)`,
  );
}

function patchHostDefault(root) {
  // adapter-node bakes `env('HOST', '0.0.0.0')` into index.js. The bin wrapper
  // sets HOST=127.0.0.1, but `node .forgeplan-web/index.js` (documented in
  // README) inherits the upstream default and binds to all interfaces. Patch
  // the literal so direct invocation matches the documented loopback default.
  const indexPath = join(root, "index.js");
  if (!existsSync(indexPath)) return;
  const src = readFileSync(indexPath, "utf8");
  // The unminified form is `env('HOST', '0.0.0.0')`. Issue #117 enabled
  // esbuild `minify: true` for dist-experimental/, which renames `env` to a
  // short identifier (e.g. `Ue`). Capture whatever identifier the minifier
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

function pruneSymlinks(root) {
  const dotBin = join(root, "node_modules", ".bin");
  if (existsSync(dotBin)) {
    rmSync(dotBin, { recursive: true, force: true });
    log(
      `removed ${dotBin.replace(ROOT, ".")} (CLI symlinks unused at runtime, often absolute → unportable)`,
    );
  }

  const stray = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isSymbolicLink()) {
        stray.push(p);
        rmSync(p, { force: true });
      } else if (name.isDirectory()) {
        walk(p);
      }
    }
  };
  walk(root);
  if (stray.length > 0) {
    log(
      `removed ${stray.length} stray symlink(s): ${stray
        .slice(0, 3)
        .map((p) => p.replace(ROOT, "."))
        .join(", ")}${stray.length > 3 ? ", …" : ""}`,
    );
  }
}

function copyToDist() {
  if (existsSync(DIST)) {
    rmSync(DIST, { recursive: true, force: true });
  }
  mkdirSync(DIST, { recursive: true });
  cpSync(TEMPLATE_BUILD, DIST, { recursive: true, dereference: false });

  stripSourceMaps(DIST);
  pruneSymlinks(DIST);
  patchHostDefault(DIST);

  const manifest = {
    name: "@forgeplan/web",
    builtAt: new Date().toISOString(),
    entry: "index.js",
  };
  writeFileSync(
    join(DIST, "forgeplan-web-build.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  log(`dist/ ready at ${DIST.replace(ROOT, ".")}`);
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

// TODO(rfc-013-graduation): once the bundled dist graduates from --experimental,
// rename this to bundleDist(), make it the only artifact emitter, drop
// emitDistPackageJson()/installRuntimeDeps()/copyToDist() from the legacy
// pipeline, and rename DIST_EXPERIMENTAL → DIST.
async function bundleExperimentalDist() {
  // PRD-014 / RFC-013: produce a self-contained ESM bundle that replaces
  // the legacy `dist/node_modules/` (≈12M). The legacy `dist/` is left
  // untouched; this is gated behind `init --experimental` until validated.
  const { build } = await import("esbuild");
  const tplPkg = JSON.parse(
    readFileSync(join(TEMPLATE, "package.json"), "utf8"),
  );

  if (existsSync(DIST_EXPERIMENTAL)) {
    rmSync(DIST_EXPERIMENTAL, { recursive: true, force: true });
  }
  mkdirSync(DIST_EXPERIMENTAL, { recursive: true });

  // Copy the parts esbuild can't (won't) inline:
  // - client/ static assets are served by sirv at runtime;
  // - env.js is loaded via SvelteKit's dynamic `$env/dynamic/*` import
  //   (string-literal `import()` that esbuild conservatively keeps external).
  cpSync(join(DIST, "client"), join(DIST_EXPERIMENTAL, "client"), {
    recursive: true,
    dereference: false,
  });
  cpSync(join(DIST, "env.js"), join(DIST_EXPERIMENTAL, "env.js"));

  const result = await build({
    entryPoints: [join(TEMPLATE_BUILD, "index.js")],
    outfile: join(DIST_EXPERIMENTAL, "index.js"),
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
    // Issue #117: post-minify the bundle. The unminified ESM bundle is ~1.4M;
    // minifying drops it to ~500–700K and shaves the published tarball
    // (refs PRD-014 SC-1: dist/ ≤ 3M cap; this brings dist-experimental/
    // closer to that target with headroom for future deps).
    // `keepNames: true` preserves function/class .name so any runtime
    // diagnostics that rely on `Error.stack` / `Function.name` still resolve
    // (sirv, polka, kit error formatters).
    minify: true,
    keepNames: true,
    metafile: false,
  });

  if (result.errors && result.errors.length > 0) {
    process.stderr.write(
      `[build] FAIL: esbuild reported ${result.errors.length} error(s)\n`,
    );
    process.exit(1);
  }
  if (result.warnings && result.warnings.length > 0) {
    // Warnings are usually about CJS/ESM interop — flag them but don't fail.
    // FIXME(rfc-013): tighten to fail-on-warning once we know the baseline is clean across upgrades.
    log(
      `bundleExperimentalDist: esbuild emitted ${result.warnings.length} warning(s) (non-fatal)`,
    );
  }

  patchHostDefault(DIST_EXPERIMENTAL);

  const distExpPkg = {
    name: "forgeplan-web-runtime-experimental",
    version: tplPkg.version ?? "0.0.0",
    private: true,
    type: "module",
    engines: tplPkg.engines,
    scripts: { start: "node index.js" },
  };
  writeFileSync(
    join(DIST_EXPERIMENTAL, "package.json"),
    JSON.stringify(distExpPkg, null, 2) + "\n",
  );

  const manifest = {
    name: "@forgeplan/web",
    builtAt: new Date().toISOString(),
    entry: "index.js",
    experimental: true,
  };
  writeFileSync(
    join(DIST_EXPERIMENTAL, "forgeplan-web-build.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  // Shape assertions — any of these failing means the bundle didn't capture
  // everything it should have, OR the bundle started silently bloating.
  if (existsSync(join(DIST_EXPERIMENTAL, "node_modules"))) {
    process.stderr.write(
      "[build] FAIL: dist-experimental/node_modules/ exists (should be inlined into index.js)\n",
    );
    process.exit(1);
  }
  if (existsSync(join(DIST_EXPERIMENTAL, "server"))) {
    process.stderr.write(
      "[build] FAIL: dist-experimental/server/ exists (chunks were not inlined; check for new dynamic imports in adapter-node output)\n",
    );
    process.exit(1);
  }
  const totalBytes = dirSizeBytes(DIST_EXPERIMENTAL);
  if (totalBytes > DIST_EXPERIMENTAL_MAX_BYTES) {
    process.stderr.write(
      `[build] FAIL: dist-experimental/ is ${(totalBytes / 1024 / 1024).toFixed(2)}M, cap is ${(DIST_EXPERIMENTAL_MAX_BYTES / 1024 / 1024).toFixed(0)}M (raise DIST_EXPERIMENTAL_MAX_BYTES if intentional)\n`,
    );
    process.exit(1);
  }
  log(
    `dist-experimental/ ready at ${DIST_EXPERIMENTAL.replace(ROOT, ".")} (${(totalBytes / 1024 / 1024).toFixed(2)}M, single-file server bundle)`,
  );
}

if (CLEAN_ONLY) {
  clean();
  process.exit(0);
}

clean();
installTemplateDeps();
buildSvelteKit();
emitDistPackageJson();
installRuntimeDeps();
copyToDist();
if (!SKIP_EXPERIMENTAL) {
  await bundleExperimentalDist();
} else {
  log("--skip-experimental: dist-experimental/ not produced");
}
log("done.");
