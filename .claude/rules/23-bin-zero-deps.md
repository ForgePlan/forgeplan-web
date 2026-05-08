# `bin/` near-zero runtime dependencies (amended by ADR-003)

`bin/forgeplan-web.mjs` is invoked by `npx @forgeplan/web init`,
`npx @forgeplan/web update`, and `npx @forgeplan/web start`. The bin
script does its job (copy `dist/` into `.forgeplan-web/`, spawn
`node .forgeplan-web/index.js`) with Node built-ins plus exactly **one**
allow-listed CLI library: `citty` (per ADR-003).

ADR-003 amended the historical "zero-dep" rule to a **named-allowlist**
rule: `citty` (and any of its transitive deps) is the **only** named
exception. Adding any other third-party import to `bin/` requires a new
ADR — not an amendment to this one.

## Allowed in `bin/` (amended by ADR-003)

- `node:*` modules (`node:fs`, `node:child_process`, `node:path`,
  `node:url`, `node:os`, `node:crypto`, `node:util`).
- Relative imports of sibling `.mjs` files inside `bin/` (e.g.
  `import { … } from "./banner.mjs"`, `from "./lib/config.mjs"`,
  `from "./commands/init.mjs"`). These are first-party code that ships
  in the `bin/` folder of the published tarball; they introduce no
  third-party resolution at `npx` time. Each such sibling file is
  itself bound by this rule (`node:*` + `citty` only, plus relative
  siblings).
- **`citty`** — CLI framework providing `defineCommand`, `runMain`,
  `parseArgs`, typed args, auto-help, and subcommand routing. Pinned
  to `^0.2.2` (caret-minor). Bumping major/minor requires re-evaluating
  ADR-003. As of `citty@0.2.2` the package has zero runtime
  `dependencies` (it bundles its own helpers and uses
  `node:util.parseArgs`); should a future version reintroduce
  transitive deps, those are covered by this rule too as long as they
  are pulled by `citty` and not declared at the root.
- Synchronous I/O (`mkdirSync`, `cpSync`, …) — the script is short and
  CLI-bound; readability beats event-loop nicety.

## Forbidden in `bin/`

- Any third-party import OTHER than `citty` (and any transitive deps
  it pulls). E.g. `chalk`, `commander`, `yargs`, `figlet`, `prompts`,
  `ora`, `kleur` are all forbidden. If you think one is needed, open a
  new ADR.
- Any `require()` from `node_modules/` at the package root that is not
  resolved through citty.
- Spawning `node_modules/.bin/*` binaries from the package root.
- Adding any other entry to root `package.json#dependencies` to support
  the bin script. Currently allowed: `{ "citty": "^0.2.2" }` — and
  nothing else.

## Note on `dist/` and `dist-experimental/`

The published tarball ships **two** pre-built artifacts (PRD-014 / RFC-013):

- `dist/` (legacy default) — SvelteKit app with its own `node_modules/`,
  populated by the build pipeline with `--omit=dev`. Those deps are
  runtime needs of the SvelteKit server (`node dist/index.js`), not of
  the bin script.
- `dist-experimental/` (opt-in via `init --experimental`) — single-file
  ESM bundle (`dist-experimental/index.js`), emitted by esbuild. No
  `node_modules/`, no `server/` chunks; everything reachable from the
  entry is inlined. The bundle ships with its own minimal `package.json`
  (no `dependencies`).

In both cases the bin script only `spawn()`s `node` against the
artifact's `index.js` — it never imports anything from the artifact's
internals. This rule is about the bin script itself staying bound to
the citty + node:* allow-list; the artifacts are governed by rule 21.

After the bundled shape graduates from `--experimental` (see
`TODO(rfc-013-graduation)` in `bin/forgeplan-web.mjs` and
`scripts/build.mjs`), the legacy `dist/` will be dropped from the
tarball and this section will collapse to one paragraph.

## Required

- The root `package.json` must keep `dependencies` to **exactly** the
  citty entry: `{ "citty": "^0.2.2" }` (caret-minor pin per ADR-003).
  No other runtime deps allowed at the root. `devDependencies` for
  repo tooling are unconstrained by this rule (currently: `esbuild`).
- The published tarball ships `bin/` (incl. `bin/cli.mjs`,
  `bin/commands/*.mjs`, `bin/lib/*.mjs`, `bin/banner.mjs`,
  `bin/forgeplan-web.mjs`), `dist/` (with its own `node_modules/`),
  `dist-experimental/` (single bundle, no `node_modules/`), and
  `README.md`.
- `package.json#engines` pins Node ≥ `^20.19.0 || >=22.12.0`. Any change
  needs an ADR.

## Rationale

`npx @forgeplan/web init` is the user's first contact with the package.
The package itself is pre-built — `init` is a `cp -r` of `dist/` into
`.forgeplan-web/`, and `start` is a `spawn(node, dist/index.js)`. The bin
must not pull in arbitrary third-party code that npm would have to
resolve before invocation; doing so would re-introduce the exact latency
we removed by shipping a pre-built artifact. The citty exception is
ADR-003's deliberate trade-off: ~5KB / ~50ms for subcommand routing,
typed args, auto-help, and a future prompt hook (#111).

## Verification

```bash
# bin/* must only import node:* modules, citty, or relative sibling .mjs files.
# Allowed:   from 'node:fs', from 'citty', from "./banner.mjs",
#            from "./lib/config.mjs", from "./commands/init.mjs"
# Forbidden: from 'chalk', from 'commander', from any other bare specifier.
# Also handles multi-line `import { … } from "node:fs";` because we match
# the `from "…"` line itself, regardless of where the `import` keyword sits.
fail=0
for f in $(find bin -name '*.mjs' -type f); do
  hits=$(grep -E "(from|require\()\s*['\"]" "$f" \
    | grep -vE "(from|require\()\s*['\"](node:|citty['\"])" \
    | grep -vE "(from|require\()\s*['\"]\\.{1,2}/" || true)
  if [ -z "$hits" ]; then
    echo "OK ($f): bin allow-list (node:*, citty, relative)"
  else
    echo "FAIL ($f): non-allow-listed imports found:"
    echo "$hits"
    fail=1
  fi
done
[ "$fail" -eq 0 ] || exit 1

# root package may declare ONLY citty as runtime dep
node -e "
const p = require('./package.json');
const deps = p.dependencies || {};
const keys = Object.keys(deps).sort();
const allowed = ['citty'];
const extra = keys.filter((k) => !allowed.includes(k));
if (extra.length) {
  console.error('FAIL: unexpected runtime deps', extra);
  process.exit(1);
}
if (!deps.citty) {
  console.error('FAIL: citty missing from dependencies (ADR-003 invariant I3)');
  process.exit(1);
}
console.log('OK: root deps = { citty:', deps.citty, '}');
"
```
