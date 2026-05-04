# Contributing

This repo is the source for the published `@forgeplan/web` package. You
only need this file if you're contributing to the tool itself, not just
using it. For end-user docs see [`USAGE.md`](USAGE.md).

## Layout

```
bin/
  forgeplan-web.mjs    # zero-dep Node CLI (init / update / start / help)
template/              # SvelteKit source — repo-internal, NOT published
  src/
    app/               # FSD: app shell (root layout, global CSS)
    pages/             # FSD: page-level routes
    widgets/           # FSD: HealthBar, Filters, DependencyGraph (5 views), …
    entities/          # FSD: artifact, graph, health, score, claim, blocked, activity
    shared/            # FSD: api/, server/, config/
scripts/
  build.mjs            # vite build → emit dist/package.json → install --omit=dev --omit=peer → strip sourcemaps
  smoke.mjs            # cross-platform end-to-end smoke (uses test/forgeplan-shim.mjs)
  test/forgeplan-shim.mjs   # Node stub that pretends to be `forgeplan`, used in CI
dist/                  # generated, gitignored — what `init` copies into .forgeplan-web/
.forgeplan/            # this repo's own Forgeplan workspace (PRD/RFC/ADR/Evidence)
.github/workflows/     # cross-platform smoke matrix + auto-publish on release
guides/                # methodological guides (CLAUDE.md & git-flow)
```

The published npm tarball ships `bin/`, `dist/`, and `README.md` only
(`files: ["bin", "dist", "README.md"]`). `template/` is dev-only.

## Branching policy

Git Flow with two long-lived branches:

- **`main`** — the shipping branch. Reflects what is currently published on
  npm. **Never push directly here.** Updated only via merged PRs from
  `develop` (or `release/*` / `hotfix/*`) and tagged releases.
- **`develop`** — the integration branch. **All day-to-day work lands here**,
  via PRs from `feature/*` / `fix/*` / `docs/*` / `chore/*` branches.

Both branches are server-side protected: required PR + 3-OS smoke matrix
green; force-push and delete blocked; `enforce_admins: true`. The pre-tool
hook `.claude/hooks/forge-safety-hook.sh` blocks the same patterns
client-side, so you get a fast local error before reaching GitHub.

Full branch model, commit message rules, release flow, recovery recipes:
[`../guides/GIT-FLOW-GUIDE.ru.md`](../guides/GIT-FLOW-GUIDE.ru.md).
Agent-facing summary: [`../CLAUDE.md`](../CLAUDE.md).

## Setup

```bash
git clone https://github.com/ForgePlan/forgeplan-web.git
cd forgeplan-web
git checkout develop
node scripts/build.mjs    # populates dist/
```

The build script:

1. Runs `npm install` inside `template/`.
2. Runs `vite build` (via `@sveltejs/adapter-node`) → `template/build/`.
3. Emits `template/build/package.json` derived from
   `template/package.json#dependencies`.
4. Runs `npm install --omit=dev --omit=peer` inside `template/build/`
   (peer skip drops the entire `vite` build chain — saves ~85% of the
   tarball).
5. Strips `*.map` files and `//# sourceMappingURL=...` references.
6. Patches `HOST` default to `127.0.0.1` (adapter-node bakes `0.0.0.0`).
7. Copies `template/build/` → `dist/` and writes a build manifest.
8. **Windows-aware** since v0.1.3: `spawn('npm', …)` is invoked with
   `shell: true` on `win32` so `npm.cmd` is reachable.

## Day-to-day commands

```bash
npm run build      # full pipeline → dist/
npm run clean      # rm dist/ template/build/ template/.svelte-kit/
npm run dev        # vite dev (HMR on raw template, NOT dist/) → http://localhost:5174
npm run smoke      # CI-equivalent end-to-end smoke against built dist/
```

`npm run dev` runs `vite dev` in `template/` with HMR; useful while
editing components and routes. It expects a real `forgeplan` binary on
`PATH` (it shells out for real, no shim).

`npm run smoke` is the same script CI runs — it scaffolds into a temp
directory, prepends a forgeplan shim to `PATH`, starts the server, and
asserts `/api/health`, `/api/list`, and `GET /` all return 200. **Run it
after every change to `bin/`, `scripts/`, or `template/` before opening a
PR.**

## Forgeplan workflow

This repo follows its own methodology. Standard+ work needs an artifact
and `R_eff > 0` before merge. See [`../CLAUDE.md`](../CLAUDE.md) for the
full Methodology section. Quick mental model:

```
OBSERVE → ROUTE → SHAPE → BUILD → PROVE → SHIP
forgeplan health   →   route   →   new prd / rfc / adr   →   code+smoke   →   new evidence   →   activate + PR + merge
```

After every `forgeplan` output, parse the `Next:` / `Or:` / `Wait:` /
`Done.` / `Fix:` marker and run it verbatim — see CLAUDE.md "Hint
protocol".

## CI

`.github/workflows/smoke.yml` runs `node scripts/build.mjs` and
`node scripts/smoke.mjs` on `ubuntu-latest`, `macos-latest`,
`windows-latest` × Node 22 for every push and PR to `main` / `develop`.
The forgeplan binary is faked with `scripts/test/forgeplan-shim.mjs` so
CI does not depend on the real binary being installable on every runner.

Branch protection requires all three jobs green before merge.

## Release flow

Releases are cut **from a `release/v*` branch**, never tagged directly on
`main`. Full procedure (expands `guides/GIT-FLOW-GUIDE.ru.md` §2.5 with the
GitHub Release UI step + `npm publish --provenance` flow specific to this repo):

```bash
# 1. Cut release branch from develop
git checkout develop && git pull
git checkout -b release/v0.2.0

# 2. Bump version in BOTH package.json files
#    package.json#version           → "0.2.0"
#    template/package.json#version  → "0.2.0"
git commit -am "chore(release): bump version to 0.2.0"
git push -u origin release/v0.2.0

# 3. PR release/v0.2.0 → main; CI matrix MUST be green
gh pr create --base main --title "release: v0.2.0"
# After CI green, merge with --merge (merge commit, NOT squash)

# 4. Tag from main, annotated only (lightweight tags rejected by guide §6)
git checkout main && git pull
git tag -a v0.2.0 -m "release v0.2.0"
git push origin v0.2.0

# 5. GitHub UI → Releases → Draft a new release → tag v0.2.0 → target main → Publish
#    .github/workflows/release.yml fires on `release: published`:
#    - verifies branch == main
#    - verifies tag == package.json#version
#    - builds dist/, runs smoke
#    - npm publish --access public --provenance

# 6. Back-merge release branch into develop so the version bump survives
git checkout develop
git merge --no-ff release/v0.2.0
git push origin develop
```

Hotfix is the same shape from `main` instead of `develop`:
`main` → `hotfix/vX.Y.Z+1` → PR to `main` → tag → back-merge into `develop`.

The release workflow uses the `NPM_TOKEN` repo secret (Settings → Secrets
and variables → Actions). Generate it on npm under Profile → **Access
Tokens** → type `Automation`. The npm account must be a member of the
`@forgeplan` org with publish rights.

### Manual dry-run (sanity check before tagging)

```bash
npm pack --dry-run                # what will the tarball contain?
npm run build && npm run smoke    # end-to-end against fresh dist/
```

### Manual publish (emergency only)

```bash
npm login         # interactive — writes ~/.npmrc
npm publish       # prepublishOnly runs scripts/build.mjs first
```

## How publication works

The published tarball ships:

- `bin/forgeplan-web.mjs` — zero-dependency Node CLI (init / update / start).
- `dist/` — the pre-built SvelteKit app: server bundle, client assets, and
  `node_modules/` populated with `--omit=dev --omit=peer`.
- `README.md`.

It does **not** ship `template/` source, `docs/`, `guides/`, `.forgeplan/`,
`.claude/`. `init` is a `cp -r` of `dist/` into `.forgeplan-web/`, plus a
tiny `forgeplan-web.json` that records the workspace root and bundled
version. `start` is a `spawn(node, dist/index.js)` with the right env.
That's the whole tool.

## Tag immutability

`v*.*.*` tags are server-protected via Ruleset
`tag-protection-semver` (id 15928584): `update` and `deletion` blocked
even for repo admins. Cutting a new patch is the only way forward — the
guide §6.3 ("never rewrite a published tag") is enforced both
methodologically and at the API level.
