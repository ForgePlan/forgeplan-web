# `bin/` zero runtime dependencies

`bin/forgeplan-web.mjs` is invoked by `npx @forgeplan/web init` and
`npx @forgeplan/web start`. The bin script itself MUST run with Node
built-ins only — it does its job (copy `dist/` into `.forgeplan-web/`,
spawn `node .forgeplan-web/index.js`) without needing any third-party
import.

## Allowed in `bin/`

- `node:*` modules (`node:fs`, `node:child_process`, `node:path`,
  `node:url`, `node:os`, `node:crypto`, `node:util`).
- Relative imports of sibling `.mjs` files **inside `bin/`** (e.g.
  `import { … } from "./banner.mjs"`). These are first-party code that
  ships in the `bin/` folder of the published tarball; they introduce
  no third-party resolution at `npx` time. Each such sibling file is
  itself bound by this rule (zero `node_modules/` imports, `node:*`-only).
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
# bin/* must only import node:* modules or relative sibling .mjs files.
# Allowed:   from 'node:fs', from "./banner.mjs", from "../bin/x.mjs"
# Forbidden: from 'chalk', from 'figlet', from any bare specifier.
# Also handles multi-line `import { … } from "node:fs";` because we match
# the `from "…"` line itself, regardless of where the `import` keyword sits.
for f in bin/*.mjs; do
  hits=$(grep -E "(from|require\()\s*['\"]" "$f" \
    | grep -vE "(from|require\()\s*['\"]node:" \
    | grep -vE "(from|require\()\s*['\"]\\.{1,2}/" || true)
  if [ -z "$hits" ]; then
    echo "OK ($f): no third-party deps"
  else
    echo "FAIL ($f): third-party imports found:"
    echo "$hits"
    exit 1
  fi
done

# root package must not declare runtime deps
node -e "const p=require('./package.json'); if (p.dependencies && Object.keys(p.dependencies).length) { console.error('FAIL: runtime deps present', p.dependencies); process.exit(1)} else { console.log('OK: no runtime deps') }"
```
