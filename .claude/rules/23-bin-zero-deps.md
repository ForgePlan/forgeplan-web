# `bin/` zero runtime dependencies

`bin/forgeplan-web.mjs` is invoked by `npx @forgeplan/web init` and
`npx @forgeplan/web start`. The bin script itself MUST run with Node
built-ins only — it does its job (copy `dist/` into `.forgeplan-web/`,
spawn `node .forgeplan-web/index.js`) without needing any third-party
import.

## Allowed in `bin/`

- `node:*` modules (`node:fs`, `node:child_process`, `node:path`,
  `node:url`, `node:os`, `node:crypto`, `node:util`).
- Synchronous I/O (`mkdirSync`, `cpSync`, …) — the script is short and
  CLI-bound; readability beats event-loop nicety.

## Forbidden in `bin/`

- Any `import` from a third-party package.
- Any `require()` from `node_modules/` at the package root.
- Spawning `node_modules/.bin/*` binaries from the package root (root
  has no `node_modules`).
- Adding entries to the root `package.json#dependencies` to support the
  bin script.

## Note on `dist/`

`dist/` (the pre-built SvelteKit app) ships its **own** `node_modules/`,
populated by the build pipeline with `--omit=dev`. Those deps are runtime
needs of the SvelteKit server (`node dist/index.js`), not of the bin
script. The bin script only `spawn()`s `node` against `dist/index.js` —
it never imports anything from `dist/node_modules/`. This rule is about
the bin script staying zero-dep; `dist/` is governed by rule 21.

## Required

- The root `package.json` must keep `dependencies` empty (or absent). It
  may have `devDependencies` for repo tooling. The published tarball
  ships `bin/` (zero-dep), `dist/` (with its own `node_modules/`), and
  `README.md`.
- `package.json#engines` pins Node ≥ `^20.19.0 || >=22.12.0`. Any change
  needs an ADR.

## Rationale

`npx @forgeplan/web init` is the user's first contact with the package.
The package itself is pre-built — `init` is a `cp -r` of `dist/` into
`.forgeplan-web/`, and `start` is a `spawn(node, dist/index.js)`. The bin
must not pull in third-party code that npm would have to resolve before
invocation; doing so would re-introduce the exact latency we removed by
shipping a pre-built artifact.

## Verification

```bash
# bin must not reference anything outside node:* in its imports
grep -E "^import |^const .*= require\\(" bin/forgeplan-web.mjs | \
  grep -v "from 'node:" | grep -v "require('node:" || echo "OK: no third-party deps"

# root package must not declare runtime deps
node -e "const p=require('./package.json'); if (p.dependencies && Object.keys(p.dependencies).length) { console.error('FAIL: runtime deps present', p.dependencies); process.exit(1)} else { console.log('OK: no runtime deps') }"
```
