# forgeplan-web

Interactive realtime web map for a [Forgeplan](https://github.com/ForgePlan/forgeplan) workspace.

`npx forgeplan-web init` scaffolds a small SvelteKit app inside `.forgeplan-web/`
in the current directory. The app's server endpoints shell out to the local
`forgeplan` CLI (which must already be on `PATH`) and stream results to a
browser UI that auto-refreshes every 10 seconds.

It is intentionally **a separate package**: it never imports from the host
project and never modifies anything outside `.forgeplan-web/`.

## Quick start

```bash
# inside a directory that contains .forgeplan/
npx forgeplan-web init
cd .forgeplan-web
npm run dev
# → http://localhost:5174
```

`init` is idempotent — re-running copies any new template files but keeps
your existing `node_modules` / build output in place. Pass `--force` to
overwrite local edits, or `--no-install` to skip `npm install`.

## What you get

- **Force-directed map** of every artifact (PRD / RFC / ADR / Spec / Epic /
  Evidence / Problem / Note), colored by kind, sized by `R_eff`, with edges
  for every typed link. Pan, zoom, click to open the full body.
- **Live health bar** powered by `forgeplan health --json`.
- **Filters** by kind, status, R_eff range.
- **Side panel** with the full markdown body for the selected artifact and a
  list of its inbound / outbound links.
- **10 s polling** of every endpoint.

## Server endpoints

All endpoints invoke the `forgeplan` CLI in the parent directory of
`.forgeplan-web/` (i.e. the workspace root). Output is the JSON that the CLI
already produces.

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

The endpoints are read-only by design.

## Configuration

Two environment variables are read by the SvelteKit server:

- `FORGEPLAN_BIN` — absolute path to the `forgeplan` binary. Defaults to
  `forgeplan` (from `PATH`).
- `FORGEPLAN_CWD` — workspace root. Defaults to the parent directory of
  `.forgeplan-web/`.

## Why a separate `.forgeplan-web/`?

So this never collides with the host project's build pipeline, lint config,
TypeScript paths, or `node_modules`. Add `.forgeplan-web/` to your project's
`.gitignore` if you don't want the generated app committed.
