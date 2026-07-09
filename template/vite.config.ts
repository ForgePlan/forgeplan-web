import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// PRD-012 / RFC-011: bake @forgeplan/web's package version at build time so the
// UI footer can render it without runtime I/O. Read from template/package.json
// (the only authoritative version source for the published app).
const TEMPLATE_PKG_VERSION = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "package.json"), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    // FIXME(build): template/package.json unreadable — falling back to 0.0.0
    return "0.0.0";
  }
})();

export default defineConfig(({ command, mode }) => {
  // TODO(dev-only): `npm run dev:playground` (vite --mode playground)
  // points at the repo-local playground/ workspace. Plain `npm run dev`
  // leaves FORGEPLAN_CWD untouched — the server then falls back to the
  // repo root's .forgeplan/ via runForgeplan's default resolution.
  // `dist/` (shipped via init) never executes this file (rule 21).
  if (
    command === "serve" &&
    mode === "playground" &&
    !process.env.FORGEPLAN_CWD
  ) {
    process.env.FORGEPLAN_CWD = resolve(__dirname, "..", "playground");
  }

  return {
    plugins: [sveltekit()],
    define: {
      __FORGEPLAN_WEB_VERSION__: JSON.stringify(TEMPLATE_PKG_VERSION),
    },
    resolve: {
      alias: {
        // widgets/iso-map (Threlte/three) never calls useDraco/useGltf/
        // useKtx2 from @threlte/extras, but the barrel re-exports them and
        // the package has no deep-import subpaths + no sideEffects:false —
        // DRACOLoader.js/KTX2Loader.js each emit a ~700KB/~500KB WASM asset
        // the moment Vite's import graph reaches them, whether or not the
        // class is ever instantiated. See vite/stubs/three-loaders.ts.
        // TODO(iso-draco-basis): this alias is load-bearing (RFC-036 Risk
        // R-4) — if a future @threlte/extras feature needs the REAL
        // draco/basis loaders, this stub silently breaks it. Any real
        // loader need re-opens this decision (ADR-011 revisit trigger).
        "three/examples/jsm/loaders/DRACOLoader.js": resolve(
          __dirname,
          "vite/stubs/three-loaders.ts",
        ),
        "three/examples/jsm/loaders/KTX2Loader.js": resolve(
          __dirname,
          "vite/stubs/three-loaders.ts",
        ),
      },
    },
    // FIXME(prd-015-css-minify): lightningcss tree-shakes the
    // `:root[data-theme='light']` block + the new `--canvas-*` tokens
    // because they're only referenced from component-scoped CSS in
    // separate chunks. Force esbuild for CSS minify until lightningcss
    // gains cross-chunk custom-property awareness.
    css: {
      transformer: "postcss",
    },
    build: {
      cssMinify: "esbuild",
      sourcemap: false,
    },
    server: {
      port: 5174,
      strictPort: false,
      fs: {
        strict: false,
      },
    },
  };
});
