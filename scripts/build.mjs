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

const args = new Set(process.argv.slice(2));
const CLEAN_ONLY = args.has("--clean");
const SKIP_TEMPLATE_INSTALL = args.has("--skip-template-install");

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
  for (const p of [DIST, TEMPLATE_BUILD, join(TEMPLATE, ".svelte-kit")]) {
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
  const PATTERN = /env\(\s*['"]HOST['"]\s*,\s*['"]0\.0\.0\.0['"]\s*\)/;
  if (!PATTERN.test(src)) {
    log(
      "patchHostDefault: HOST literal not found — adapter-node may have changed; review build",
    );
    return;
  }
  writeFileSync(indexPath, src.replace(PATTERN, "env('HOST', '127.0.0.1')"));
  log("patched HOST default 0.0.0.0 → 127.0.0.1 in dist/index.js");
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
log("done.");
