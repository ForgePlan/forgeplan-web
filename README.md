# @forgeplan/web

Interactive realtime web map for a
[Forgeplan](https://github.com/ForgePlan/forgeplan) workspace.

`npx @forgeplan/web init -y` copies a **pre-built SvelteKit app** (with its
`node_modules/` baked in) into `.forgeplan-web/` of the current directory.
No `npm install` runs at your side. `npx @forgeplan/web start` boots the
server, which shells out to the local `forgeplan` CLI and streams results
to a browser UI that auto-refreshes every 10 seconds.

It is intentionally **a separate package**: it never imports from the host
project and never modifies anything outside `.forgeplan-web/`.

---

# Using the tool

## Requirements

- Node.js `^20.19.0 || >=22.12.0`.
- The `forgeplan` CLI on `PATH` (install from
  <https://github.com/ForgePlan/forgeplan>).
- A `.forgeplan/` workspace in the directory you run `init` from. If you
  don't have one yet: `forgeplan init -y`.

## Install

You don't need to install anything globally — `npx` will fetch the
package on first use:

```bash
npx @forgeplan/web init -y
npx @forgeplan/web start
```

If you'd rather have the CLI on `PATH` permanently:

```bash
npm install -g @forgeplan/web
forgeplan-web init -y
forgeplan-web start
```

## Quick start

```bash
# inside a directory that contains .forgeplan/
npx @forgeplan/web init -y
npx @forgeplan/web start
# → http://127.0.0.1:5174
```

`init` is idempotent — re-running copies any new files but keeps your
existing scaffold in place. Pass `--force` to overwrite local edits.
After upgrading the npm package, run `update` to refresh the scaffold:

```bash
npm i -g @forgeplan/web@latest    # or: npx @forgeplan/web@latest update
npx @forgeplan/web update
```

You can also run the server directly without the wrapper:

```bash
node .forgeplan-web/index.js
```

## CLI reference

```
npx @forgeplan/web init [-y] [--force] [--no-gitignore]
npx @forgeplan/web update [--force]
npx @forgeplan/web start
npx @forgeplan/web help
```

| Command  | What it does |
|----------|--------------|
| `init`   | Copy the pre-built app into `./.forgeplan-web/`, write `forgeplan-web.json` (records the workspace root + bundled version), and append `.forgeplan-web/` to `./.gitignore` so the generated app does not get committed. The `.gitignore` step is idempotent. `-y` is accepted for compatibility (init is non-interactive). `--force` overwrites existing files. `--no-gitignore` skips the `.gitignore` step. |
| `update` | Refresh `./.forgeplan-web/` to the version bundled with the currently-resolved `@forgeplan/web` package. Removes stale files (anything no longer in the new `dist/`), preserves `workspaceRoot` and `createdAt`, records the new `version` and `updatedAt`. No-op when already current; pass `--force` to re-copy anyway. **Any manual edits inside `./.forgeplan-web/` are lost** — that directory is generated. Does not touch `.gitignore`. |
| `start`  | Run the SvelteKit server from `./.forgeplan-web/`. |
| `help`   | Print the same usage block. |

## What you get

- **Force-directed map** of every artifact (PRD / RFC / ADR / Spec / Epic /
  Evidence / Problem / Note), colored by kind, sized by `R_eff`, with edges
  for every typed link. Pan, zoom, click to open the full body.
- **Live health bar** powered by `forgeplan health --json`.
- **Filters** by kind, status, `R_eff` range.
- **Side panel** with the full markdown body for the selected artifact
  and a list of its inbound / outbound links.
- **10 s polling** of every endpoint.

## Server endpoints

All endpoints `spawn` `forgeplan <cmd> --json` in the workspace root and
stream the JSON it produces. They are **read-only** by design — no
mutating subcommand is reachable through HTTP.

| Route                   | CLI command                  |
|-------------------------|------------------------------|
| `GET /api/list`         | `forgeplan list --json`      |
| `GET /api/health`       | `forgeplan health --json`    |
| `GET /api/graph`        | `forgeplan graph --json`     |
| `GET /api/get/[id]`     | `forgeplan get <id> --json`  |
| `GET /api/order`        | `forgeplan order --json`     |
| `GET /api/blocked`      | `forgeplan blocked --json`   |
| `GET /api/claims`       | `forgeplan claims --json`    |
| `GET /api/stale`        | `forgeplan stale --json`     |
| `GET /api/log`          | `forgeplan log --json`       |
| `GET /api/score`        | `forgeplan score --all --json` |
| `GET /api/tree`         | `forgeplan tree --json`      |

## Configuration

Environment variables read by the server (set them before
`npx @forgeplan/web start` or before `node .forgeplan-web/index.js`):

| Variable        | Default                            | Purpose |
|-----------------|------------------------------------|---------|
| `PORT`          | `5174`                             | Listen port. |
| `HOST`          | `127.0.0.1`                        | Listen host. |
| `FORGEPLAN_BIN` | `forgeplan` (from `PATH`)          | Absolute path to the binary. |
| `FORGEPLAN_CWD` | the directory you ran `init` from  | Workspace root the server reads. |

Example — different port, explicit binary path:

```bash
PORT=8080 FORGEPLAN_BIN=/opt/forgeplan/bin/forgeplan \
  npx @forgeplan/web start
```

## Why a separate `.forgeplan-web/`?

So this never collides with the host project's build pipeline, lint
config, TypeScript paths, or `node_modules/`. `init` automatically
appends `.forgeplan-web/` to your `.gitignore` (idempotent — re-runs
do not duplicate the line). Pass `--no-gitignore` if you'd rather
manage that yourself.

---

# Working on this repository

This repo is the source for the published `@forgeplan/web` package.
You only need this section if you're contributing to the tool itself,
not just using it.

## Layout

```
bin/
  forgeplan-web.mjs    # zero-dep Node CLI (init / start / help)
template/              # SvelteKit source — repo-internal, NOT published
scripts/
  build.mjs            # vite build → emit dist/package.json → install --omit=dev --omit=peer → strip sourcemaps
  smoke.mjs            # cross-platform end-to-end smoke (uses scripts/test/forgeplan-shim.mjs)
  test/forgeplan-shim.mjs   # Node stub that pretends to be `forgeplan`, used in CI
dist/                  # generated, gitignored — what `init` copies into .forgeplan-web/
.forgeplan/            # this repo's own Forgeplan workspace (PRD/RFC/ADR/Evidence)
.github/workflows/     # cross-platform smoke matrix
```

The published npm tarball ships `bin/`, `dist/`, and `README.md` only
(`files: ["bin", "dist", "README.md"]`). `template/` is dev-only.

## Setup

```bash
git clone https://github.com/<owner>/forgeplan-web.git
cd forgeplan-web
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
6. Copies `template/build/` → `dist/` and writes a build manifest.

## Day-to-day commands

```bash
# Build the publishable artifact
npm run build

# Wipe dist/, template/build/, template/.svelte-kit/
npm run clean

# HMR dev loop on the SvelteKit source (NOT against dist/)
npm run dev          # → http://localhost:5174

# End-to-end smoke against the built dist/
npm run smoke
```

`npm run dev` runs `vite dev` in `template/` with HMR; useful while
editing components and routes. It expects a real `forgeplan` binary on
`PATH` (it shells out for real, no shim).

`npm run smoke` is the same script CI runs — it scaffolds into a temp
directory, prepends a forgeplan shim to `PATH`, starts the server, and
asserts `/api/health`, `/api/list`, and `/` all return 200. Run it after
every change to `bin/`, `scripts/`, or `template/` before opening a PR.

## CI

`.github/workflows/smoke.yml` runs `node scripts/build.mjs` and
`node scripts/smoke.mjs` on `ubuntu-latest`, `macos-latest`,
`windows-latest` × Node 22 for every push and PR to `main` / `develop`.
The forgeplan binary is faked with `scripts/test/forgeplan-shim.mjs` so
CI does not depend on the real binary being installable on every
runner.

## Publishing

Releases are published **automatically** by
`.github/workflows/release.yml` when a GitHub Release is created from
`main`. Manual `npm publish` from a contributor's machine is not the
expected flow.

### Release flow

1. Bump the version in `package.json` (and `template/package.json` if
   needed) on `main`. Commit + push.
2. On GitHub: Releases → **Draft a new release**.
3. Tag: `vX.Y.Z` (must match `package.json#version`, with a leading `v`).
4. Target: `main` (the workflow refuses to publish from any other branch).
5. **Publish release** → workflow runs:
   - verifies branch == `main` and tag matches `package.json#version`,
   - builds `dist/`,
   - runs `scripts/smoke.mjs`,
   - publishes to npm with `--access public --provenance`.

The workflow uses the `NPM_TOKEN` repo secret (Settings → Secrets and
variables → Actions). Generate it on npm under Profile → **Access
Tokens** → type `Automation`. The npm account must be a member of the
`@forgeplan` org with publish rights.

### Manual dry-run (sanity check before tagging)

```bash
# What will be packed?
npm pack --dry-run

# End-to-end smoke against a fresh dist/.
npm run build && npm run smoke
```

### Manual publish (emergency only)

```bash
npm login         # interactive — writes ~/.npmrc
npm publish       # prepublishOnly runs scripts/build.mjs first
```

## How publication works

The published tarball ships:

- `bin/forgeplan-web.mjs` — zero-dependency Node CLI (init / start).
- `dist/` — the pre-built SvelteKit app: server bundle, client assets,
  and `node_modules/` populated with `--omit=dev --omit=peer`.
- `README.md`.

It does **not** ship the source `template/`. `init` is a `cp -r` of
`dist/` into `.forgeplan-web/`, plus a tiny `forgeplan-web.json` that
records the workspace root. `start` is a `spawn(node, dist/index.js)`
with the right env. That's the whole tool.
