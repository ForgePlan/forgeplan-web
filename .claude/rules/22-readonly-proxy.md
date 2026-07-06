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

## Allow-list extension: `/api/map` (non-forgeplan; PRD-036 / SPEC-006 / RFC-030)

`/api/map` is a read-only mirror of the composed-map document at
`<workspaceRoot>/.forgeplan/map/map.json` (SPEC-006 C5), backing the
composed-map view (the 9th graph view, Phase-1 render-proof).

Constraints (every one of these is enforceable from the diff):

- Method: `GET` only.
- File path: `path.join(workspaceRoot(), ".forgeplan", "map", "map.json")` —
  **no interpolation, no env override beyond the standard `workspaceRoot()`
  resolution, no user input** on the path.
- **No spawn, no Forgeplan invocation, no network.** The endpoint reads via
  `node:fs.readFileSync` only, inside
  `template/src/shared/server/map.ts#readMapFile`. The file's content is
  mirrored **verbatim** — the endpoint performs NO structural validation.
  Validation (`validateMapDocument`) is the web client's job (SPEC-006 C4);
  the server is the third of the three validation call sites (§20) and is
  deliberately a "dumb honest mirror" — forking the rule list between
  server and client would hide errors from the error-surface UX.
- Response shape mirrors the standard envelope: `{ ok, data, cmd: "map:read",
error? }`. HTTP 200 in every handled case.
  - File present, parseable JSON → `{ ok: true, data: <file content
verbatim> }`.
  - File missing (ENOENT) → `{ ok: true, data: {} }` — a NORMAL state
    ("no map yet"), never an error.
  - Unreadable / unparseable → `{ ok: false, data: {}, error }` — never a
    thrown exception.

Any additional non-forgeplan endpoint requires a new Forgeplan artifact and
a fresh amendment to this rule.

## Allow-list extension: `/api/map/layers/<zone>` (non-forgeplan; PRD-038 FR-002)

`/api/map/layers/<zone>` is a read-only mirror of a **map-pack-emitted
per-zone layer** document at
`<workspaceRoot>/.forgeplan/map/layers/<zone>.json` (PRD-038 FR-002), backing
the composed-map's "prefer emitted layer, fall back to client-derived"
descend seam (FD-6, RFC-031's `deriveSubDocument` seam). This is a distinct,
**read-only** amendment — categorically separate from ADR-008's later,
human-gated **write** amendment for the append/deeper-scan loop (PRD-038
Non-Goals).

Constraints (every one of these is enforceable from the diff):

- Method: `GET` only.
- Route param: `zone` (single dynamic segment, `routes/api/map/layers/[zone]/+server.ts`).
  Validated against `^[a-zA-Z0-9._-]+$` **and** rejected if it contains `..`
  — no interpolation of unvalidated input into the filesystem path. The
  charset excludes `/` outright (no path-traversal via a raw slash); the
  explicit `..` rejection closes the two-adjacent-dots gap the charset alone
  would allow.
- File path: `path.join(workspaceRoot(), ".forgeplan", "map", "layers",
\`${zone}.json\`)`— the validated`zone` is the only interpolated segment.
- **No spawn, no Forgeplan invocation, no network.** The endpoint reads via
  `node:fs.readFileSync` only, inside
  `template/src/shared/server/map.ts#readMapLayerFile`. The file's content
  is mirrored **verbatim** — the endpoint performs NO structural validation
  (validation is the web client's job, SPEC-006 C4, same division of labour
  as `/api/map`).
- Response shape mirrors the standard envelope: `{ ok, data, cmd:
"map:layer:read", error? }`.
  - File present, parseable JSON → `{ ok: true, data: <file content
verbatim> }`.
  - File missing (ENOENT) → `{ ok: true, data: {} }` — a NORMAL state ("no
    emitted layer for this zone yet"), never an error.
  - Unreadable / unparseable → `{ ok: false, data: {}, error }` — never a
    thrown exception.
  - Invalid `zone` param → HTTP 400 (`error(400, ...)`), the only non-GET-2xx
    response this endpoint returns.
- **MVP scope**: single-segment top-level zone ids only. A nested
  `<ancestor>/<zone>` layer path is a follow-up — out of scope for this
  amendment, rejected by the same `zone` validation (no `/` in the charset).

Any additional non-forgeplan endpoint requires a new Forgeplan artifact and
a fresh amendment to this rule.

## Allow-list extension: git-reconstruction endpoints (`/api/snapshot`, `/api/timeline-events`)

Time-travel (PRD-008 / RFC-007) and snapshot identity (PRD-016 / RFC-015) need
the workspace's _history_, which the `forgeplan` CLI does not expose read-only.
Two endpoints therefore spawn **`git`** (not `forgeplan`) in read-only mode:

- `/api/timeline-events` — `git log` over `.forgeplan/` to list create / activate
  / supersede / score events for the scrubber.
- `/api/snapshot` — reconstructs a past workspace state: `git rev-list` (resolve
  the commit at/before an ISO timestamp), `git cat-file -e` (reachability),
  `git worktree add --detach <tmp> <sha>` into an OS tmpdir, then runs
  `forgeplan reindex` **inside that ephemeral throwaway worktree** plus
  `forgeplan list/graph --json` against it, then `git worktree remove --force`.

Constraints (every one enforceable from the diff):

- Method: `GET` only.
- Every `git` / `forgeplan` invocation goes through `child_process.spawn` with an
  **argv array** — never a shell-string. The only interpolated values are the
  SHA (validated `^[0-9a-f]{40}$`) and the `at` timestamp (validated against an
  ISO-8601 regex); no raw user input reaches argv.
- `git` runs are scoped to the repo root (`git rev-parse --show-toplevel`) with
  the pathspec restricted to `.forgeplan/`; every spawn carries a timeout.
- **The `forgeplan reindex` here is the documented exception to the "forbidden
  reindex" rule below.** It writes the Lance index of a _disposable_ git worktree
  under `tmpdir`, never the host `.forgeplan/lance/`; the host workspace is never
  mutated, and the worktree is always removed in a `finally`.
- No network; no host filesystem write outside the OS-tmpdir worktree.

These are the only places `git` is spawned from `/api/*`, and the only place
`reindex` runs (ephemeral-worktree-scoped). Any new git-spawning or
history-reconstruction endpoint requires an updating Forgeplan artifact and a
revision of this rule. See PRD-008 / RFC-007 and PRD-016 / RFC-015.

## OPTIONS preflight + CORS carve-out (`/api/instance-status`)

`/api/instance-status` (issue #134) reports a single instance's live status using
only the allow-listed `health` + `claims` subcommands — fully compliant with the
forgeplan allow-list above. Because the instance switcher fetches _other_
forgeplan-web instances **cross-origin** (different port = different origin), this
endpoint is the one permitted exception to the strict "GET only" shape: it also
exports an `OPTIONS` handler returning `204` with `Access-Control-Allow-Origin: *`

- `Access-Control-Allow-Methods: GET` for the browser preflight. The `OPTIONS`
  handler is side-effect-free (no spawn, no body); `GET` stays the only data path.
  No other `/api/*` route may export a non-GET handler or set CORS headers without
  an updating artifact.

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
- `grep -RIn "spawn\|execFile" template/src/routes/api/ template/src/shared/server/`
  may show `git` spawns ONLY in the snapshot / timeline-events reconstruction
  path (see git-reconstruction extension above); every such spawn is argv-based
  with validated SHA / ISO inputs.
- Every route file is `+server.ts` exporting `GET` only (no `POST`, `PUT`,
  `PATCH`, `DELETE`) — the sole exception is the side-effect-free `OPTIONS`
  preflight on `/api/instance-status` (CORS carve-out above).
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
- `template/src/routes/api/map/+server.ts` MUST NOT contain any `spawn`,
  `execFile`, `writeFileSync`, `renameSync`, or `mkdirSync` call, and MUST
  NOT call `validateMapDocument` (validation stays client-side per SPEC-006
  C4/C5). The reader `template/src/shared/server/map.ts#readMapFile` MAY
  only call `existsSync` + `readFileSync` against
  `<workspaceRoot>/.forgeplan/map/map.json`.
- `template/src/routes/api/map/layers/[zone]/+server.ts` MUST NOT contain
  any `spawn`, `execFile`, `writeFileSync`, `renameSync`, or `mkdirSync`
  call, and MUST NOT call `validateMapDocument` (validation stays
  client-side, same as `/api/map`). It MUST validate `params.zone` via
  `isValidZoneId` and respond `400` before calling `readMapLayerFile` on an
  invalid id. The reader
  `template/src/shared/server/map.ts#readMapLayerFile` MAY only call
  `existsSync` + `readFileSync` against
  `<workspaceRoot>/.forgeplan/map/layers/<zone>.json`.
