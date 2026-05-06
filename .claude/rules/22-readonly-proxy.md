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
