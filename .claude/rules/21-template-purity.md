# Template purity

`template/` is the SvelteKit source the dev pipeline builds. Its **output**
(`dist/`) is what `bin/forgeplan-web.mjs` copies verbatim to
`<cwd>/.forgeplan-web/`. `template/` itself is repo-internal and is NOT
shipped in the npm tarball (`files: [bin, dist, README.md]`). The template
must remain *transport-safe* under `cp -r` so the build pipeline produces
a self-contained scaffold.

## Forbidden inside `template/`

- Symlinks.
- Absolute paths in any source file (use relative paths or a runtime config
  read from `forgeplan-web.json`).
- References to this repo's root `package.json` / `node_modules/` /
  `.git/` / `.forgeplan/`.
- A committed `node_modules/` or build output (`.svelte-kit/`, `build/`,
  `dist/`).
- Files that depend on this repo's tooling being installed (e.g.
  workspace-relative `pnpm` paths).

## Required

- `template/package.json` is **the SvelteKit app's own package** — its
  `name`, `version`, and deps are independent of the root package. Do not
  merge them.
- Runtime deps (used by `node build/index.js` after `vite build`) live in
  `dependencies`. Build-only tooling (vite, adapter-node, svelte-check,
  typescript, types) lives in `devDependencies`. The build pipeline
  (PRD-030 / RFC-026 / ADR-005):
  - Runs esbuild on `template/build/index.js` with
    `--bundle --packages=bundle` to inline every reachable runtime dep
    into a single ESM file. The output has no `node_modules/` and no
    `server/` chunks.
  - Materialises one **image** per entry in `config/images.json#images`.
    `dist/` for `stable`, `dist-<name>/` for every other image (e.g.
    `dist-nightly/`). Each image directory is byte-identical except for
    its `forgeplan-web-build.json` manifest (records `image` + `features`).
  - Each emitted `dist*/` is capped at 3M (assertion in `scripts/build.mjs`).
  - The legacy `dist/node_modules/`-shaped pipeline is removed (graduates
    PRD-014 / RFC-013).
- `template/package.json#scripts.dev` must boot SvelteKit on a deterministic
  port (currently `5174`) so the README's quick-start link is correct.
- Every server route that needs the workspace path MUST read it from
  `forgeplan-web.json` (written by `init`) or from `FORGEPLAN_CWD` env —
  never hard-code.
- Every server route that needs the binary MUST read `FORGEPLAN_BIN` env
  (default `forgeplan` from `PATH`).

## Rationale

The init script is intentionally a `cp -r` of pre-built `dist/`. Anything
in `template/` that requires preprocessing, path rewriting, or workspace
resolution will silently break the build pipeline or the runtime in
`.forgeplan-web/`. Keep the template inert.

## Verification

```bash
# from a scratch dir that contains a dummy .forgeplan/
cd /tmp/scratch && mkdir -p .forgeplan && \
  node /path/to/forgeplan-web/bin/forgeplan-web.mjs init -y && \
  test -f .forgeplan-web/index.js && \
  test -d .forgeplan-web/node_modules && \
  ! grep -RIn "/Users/" .forgeplan-web/server 2>/dev/null && \
  ! find .forgeplan-web -type l | grep .
```
