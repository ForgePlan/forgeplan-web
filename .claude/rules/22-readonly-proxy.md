# `/api/*` is a read-only forgeplan proxy

The SvelteKit server in `template/src/routes/api/` exists to render the
host's Forgeplan workspace as a graph. It is a **viewer**, not an editor.

## Allowed `forgeplan` subcommands behind `/api/*`

`list`, `health`, `graph`, `get <id>`, `order`, `blocked`, `claims`,
`stale`, `log`, `score`, `tree`, `blindspots`, `journal`. All invoked with `--json`.

> NOTE: `blindspots` and `journal` are read-only by intent. As of CLI 0.27 they
> may not support `--json` and may return raw text — endpoints that wrap them
> must handle that case explicitly. Adding new read-only subcommands here
> requires an updating Forgeplan artifact.

## Flag-only exception: `--version`

`forgeplan --version` is read-only by definition (it prints a static string and
exits). It is NOT a subcommand and therefore NOT a member of the allow-list
above. It is exposed to `/api/*` via a dedicated helper
(`getForgeplanVersion()` in `template/src/shared/server/forgeplan.ts`) that
bypasses `runForgeplan`'s subcommand check while reusing the same
`FORGEPLAN_BIN` validation, concurrency cap, and timeout. The result is
memoized for the process lifetime.

This is the only flag-only invocation permitted from `/api/*`. Any new
flag-only or subcommand entry requires an updating Forgeplan artifact and a
revision of this rule. See PRD-012 / RFC-011.

## Allow-list extension: `/api/update-check` (non-forgeplan)

`/api/update-check` is one of the non-forgeplan endpoints permitted from
`/api/*`. It probes the npm registry for the latest published version of
`@forgeplan/web` so the UI can surface an "Update available" affordance.

Constraints (every one of these is enforceable from the diff):

- Method: `GET` only.
- URL: the **string literal** `https://registry.npmjs.org/@forgeplan/web/latest`.
  No interpolation, no query params, no user input on the URL path.
- No spawn, no host filesystem write, no Forgeplan invocation. The only
  side-effect is a process-local in-memory cache (5 min TTL, single
  inflight promise).
- Headers: `accept: application/json` and a static `user-agent`. No cookies,
  no credentials.
- Response shape mirrors the standard envelope: `{ ok, data: { current,
  latest, hasUpdate }, cmd, error? }` with `current = __FORGEPLAN_WEB_VERSION__`.
- Network failures (timeout, non-2xx, JSON parse error) MUST fall back to
  `{ ok: false, error, data: { ..., hasUpdate: false } }` — never throw.

Any additional non-forgeplan endpoint (whether it hits npm, GitHub,
crates.io, or anything else) requires a new Forgeplan artifact and a fresh
amendment to this rule. See PRD-013 / RFC-012.

## Allow-list extension: `/api/instances` (non-forgeplan)

`/api/instances` is the second non-forgeplan endpoint permitted from
`/api/*`. It exposes a read-only mirror of the global instance registry at
`~/.forgeplan-web/instances.json` (PRD-027 / RFC-023 / SPEC-003 / ADR-004) so
the UI can surface an instance switcher (PRD-029, Wave 6).

Constraints (every one of these is enforceable from the diff):

- Method: `GET` only.
- File path: the registry file is resolved as
  `path.join(os.homedir(), ".forgeplan-web", "instances.json")` —
  **no interpolation, no env override, no user input** on the path.
- **No spawn, no `fs.write*` / `fs.mkdir*` / `fs.rename*` / `fs.unlink*`**.
  The endpoint MUST NOT mutate the registry; mutations live exclusively in
  `bin/lib/registry.mjs`. The endpoint reads via `node:fs.readFileSync`
  only and applies an in-process liveness sweep (`process.kill(pid, 0)` +
  heartbeat freshness ≤ 60 s) before returning.
- No Forgeplan invocation, no network call, no host filesystem mutation.
  The only side-effect is a process-local in-memory cache (2 s TTL, single
  inflight promise) inside
  `template/src/shared/server/registry.ts#readInstances`.
- Response shape mirrors the standard envelope: `{ ok, data: { instances },
  cmd: "registry:read", error? }`. `instances` MUST conform to the
  SPEC-003 v1 row shape (id / host / port / pid / scope / workspaceRoot /
  projectName / startedAt / heartbeatAt / webVersion / forgeplanCli);
  malformed rows are silently dropped from the live view.
- Errors (file read, JSON parse) MUST fall back to `{ ok: false, error,
  data: { instances: [] } }` — never throw.

Any additional non-forgeplan endpoint (whether it hits npm, GitHub,
crates.io, the local filesystem outside the registry, or anything else)
requires a new Forgeplan artifact and a fresh amendment to this rule.

## Forbidden `forgeplan` subcommands from any `/api/*` endpoint

Any subcommand that mutates the workspace:

- `init`, `new`, `delete`, `move`, `rename`
- `link`, `unlink`
- `validate --fix`, `reason --write`
- `claim`, `release`
- `activate`, `supersede`, `deprecate`, `mark-stale`
- `scan-import`, `reindex` (these write the Lance index)
- `serve` (only the user's MCP wrapper invokes this)
- anything not in the allow-list above

## Required shape

- The endpoint shells out via `child_process.spawn` (or `execFile`), never
  `exec` with a shell-string built from user input.
- `cwd` is `FORGEPLAN_CWD` (default: parent of `.forgeplan-web/`, read from
  `forgeplan-web.json`).
- Path/id parameters are validated against `^[A-Z]+-[0-9]+$` (or the
  forgeplan-id regex of the day) before being passed as argv.
- The response is a JSON pass-through of stdout, plus `{ ok: false, error }`
  on non-zero exit.
- The endpoint method is `GET` only.

## Rationale

A drive-by request to `/api/...` should never delete a PRD or activate
something. The whole package is built on the assumption that the host's
git history of `.forgeplan/*.md` is the ground truth; mutating from a
browser invalidates that.

## Verification

- `grep -RIn "forgeplan" template/src/routes/api/` must show only commands
  from the allow-list above.
- Every route file is `+server.ts` exporting `GET` only (no `POST`, `PUT`,
  `PATCH`, `DELETE`).
- `runForgeplan` in `template/src/shared/server/forgeplan.ts` MUST check
  `args[0] ∈ READ_ONLY_SUBCOMMANDS` before spawning, and the constant MUST
  match this allow-list (see rule above). The check is the runtime backstop
  for review-time enforcement.
- `grep -RIn "fetch(" template/src/routes/api/` must show external URLs
  only inside `update-check/+server.ts`, and the URL must appear as a
  string literal (`https://registry.npmjs.org/@forgeplan/web/latest`).
- `template/src/routes/api/instances/+server.ts` MUST NOT contain any
  `spawn`, `execFile`, `writeFileSync`, `renameSync`, or `mkdirSync`
  call (read-only constraint above). The reader
  `template/src/shared/server/registry.ts` MAY only call
  `existsSync` + `readFileSync` against `~/.forgeplan-web/instances.json`.
