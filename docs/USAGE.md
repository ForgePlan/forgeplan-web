# Usage

Full reference for using `@forgeplan/web` as an end-user. If you are
contributing to the package itself, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Requirements

- Node.js `^20.19.0 || >=22.12.0`.
- The `forgeplan` CLI on `PATH`. Install from
  <https://github.com/ForgePlan/forgeplan>.
- A `.forgeplan/` workspace in the directory you run `init` from. If you
  don't have one yet, run `forgeplan init -y` first.

## Install

You don't need to install anything globally — `npx` will fetch the package
on first use:

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

`init` is idempotent — re-running copies any new files but keeps the
existing scaffold in place. Pass `--force` to overwrite local edits.

After upgrading the npm package, run `update` to refresh the scaffold
without losing the `workspaceRoot` pointer:

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

| Command  | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`   | Copy the pre-built app into `./.forgeplan-web/`, write `forgeplan-web.json` (records the workspace root + bundled version), and append `.forgeplan-web/` to `./.gitignore` so the generated app does not get committed. The `.gitignore` step is idempotent. `-y` is accepted for compatibility (init is non-interactive). `--force` overwrites existing files. `--no-gitignore` skips the `.gitignore` step.                                  |
| `update` | Refresh `./.forgeplan-web/` to the version bundled with the currently-resolved `@forgeplan/web` package. Removes stale files (anything no longer in the new `dist/`), preserves `workspaceRoot` and `createdAt`, records the new `version` and `updatedAt`. No-op when already current; pass `--force` to re-copy anyway. **Any manual edits inside `./.forgeplan-web/` are lost** — that directory is generated. Does not touch `.gitignore`. |
| `start`  | Run the SvelteKit server from `./.forgeplan-web/`.                                                                                                                                                                                                                                                                                                                                                                                             |
| `help`   | Print the same usage block.                                                                                                                                                                                                                                                                                                                                                                                                                    |

## What you get

- **Force-directed map** of every artifact (PRD / RFC / ADR / Spec / Epic /
  Evidence / Problem / Note), colored by kind, sized by `R_eff`, with edges
  for every typed link. Pan, zoom, click to open the full body.
- **Five graph views** — Force, Lanes, Matrix, Radial, Tree. Pick the one
  that matches the question (lanes for status flow, matrix for adjacency,
  radial for hierarchy, tree for parent/child).
- **Live health bar** powered by `forgeplan health --json`.
- **Filters** by kind, status, `R_eff` range. Persisted in `localStorage`.
- **Side panel** with the full markdown body for the selected artifact and
  a list of its inbound / outbound links.
- **10 s polling** of every endpoint — the UI refreshes itself; no manual
  reload needed when artifacts change on disk (just remember to run
  `forgeplan reindex` after direct markdown edits so the Lance index keeps
  up).

## Server endpoints

All endpoints `spawn` `forgeplan <cmd> --json` in the workspace root and
stream the JSON it produces. They are **read-only** by design — no mutating
subcommand is reachable through HTTP.

| Route                 | CLI command                    |
| --------------------- | ------------------------------ |
| `GET /api/list`       | `forgeplan list --json`        |
| `GET /api/health`     | `forgeplan health --json`      |
| `GET /api/graph`      | `forgeplan graph --json`       |
| `GET /api/get/[id]`   | `forgeplan get <id> --json`    |
| `GET /api/order`      | `forgeplan order --json`       |
| `GET /api/blocked`    | `forgeplan blocked --json`     |
| `GET /api/claims`     | `forgeplan claims --json`      |
| `GET /api/stale`      | `forgeplan stale --json`       |
| `GET /api/log`        | `forgeplan log --json`         |
| `GET /api/score`      | `forgeplan score --all --json` |
| `GET /api/tree`       | `forgeplan tree --json`        |
| `GET /api/blindspots` | `forgeplan blindspots`         |
| `GET /api/journal`    | `forgeplan journal`            |

## Configuration

Environment variables read by the server (set them before
`npx @forgeplan/web start` or before `node .forgeplan-web/index.js`):

| Variable        | Default                           | Purpose                          |
| --------------- | --------------------------------- | -------------------------------- |
| `PORT`          | `5174`                            | Listen port.                     |
| `HOST`          | `127.0.0.1`                       | Listen host.                     |
| `FORGEPLAN_BIN` | `forgeplan` (from `PATH`)         | Absolute path to the binary.     |
| `FORGEPLAN_CWD` | the directory you ran `init` from | Workspace root the server reads. |

Example — different port, explicit binary path:

```bash
PORT=8080 FORGEPLAN_BIN=/opt/forgeplan/bin/forgeplan \
  npx @forgeplan/web start
```

## Why a separate `.forgeplan-web/`?

So this never collides with the host project's build pipeline, lint
config, TypeScript paths, or `node_modules/`. `init` automatically appends
`.forgeplan-web/` to `./.gitignore` (idempotent — re-runs do not duplicate
the line). Pass `--no-gitignore` if you'd rather manage that yourself.

## Cross-platform support

CI matrix verifies `ubuntu-latest`, `macos-latest`, `windows-latest` × Node
22 on every push and PR to `main` / `develop`. The published `0.1.3+`
package works end-to-end on all three (earlier versions had a
silently-broken Windows path; see the [v0.1.3 changelog](../CHANGELOG.md)).
