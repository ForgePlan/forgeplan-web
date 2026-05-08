# `init` host isolation

`bin/forgeplan-web.mjs init` runs in the user's project directory. Its
write boundary depends on the resolved scope (PRD-025 / RFC-021):

- **Project scope** (`--scope project`, or `-y` without `--scope`, or the
  user picks "project" interactively): writes only inside
  `<cwd>/.forgeplan-web/`, with **one** narrow exception — appending an
  ignore rule for `.forgeplan-web/` to the host's `.gitignore` (see
  ADR-001). Every other host write is forbidden.
- **User scope** (`--scope user`, or the user picks "user" interactively):
  writes only inside `~/.forgeplan-web/` (resolved from `os.homedir()`,
  per RFC-021 / ADR-004). The host project's `.gitignore` MUST NOT be
  touched — the home directory is workspace-agnostic and the user-scope
  scaffold is shared across projects, so an "ignore" hint in any
  individual project would be misleading. User scope likewise does NOT
  require a `.forgeplan/` workspace in the cwd at install time; the
  workspace is bound at `start` time via `FORGEPLAN_CWD`.

## Forbidden writes from `init` (both scopes)

- The host's `package.json`, `pnpm-lock.yaml`, `package-lock.json`,
  `yarn.lock`.
- The host's `.npmrc`, `.editorconfig`, or any other root config.
- The host's `node_modules/`.
- The host's `.forgeplan/` (the workspace is *read* via the bundled
  `forgeplan` CLI; never written by us).
- Under `--scope user`: the host's `.gitignore` MUST NOT be created,
  read-then-rewritten, or appended. User scope is gitignore-silent.
- Any file outside the resolved target directory (project: `<cwd>/.forgeplan-web/`,
  user: `~/.forgeplan-web/`) other than the single `.gitignore`
  exception below — and that exception applies to project scope only.

## Allowed writes

- **Project scope** only: anything inside `<cwd>/.forgeplan-web/`,
  including `<cwd>/.forgeplan-web/forgeplan-web.json` (workspace pointer
  the SvelteKit server reads at runtime).
- **User scope** only: anything inside `~/.forgeplan-web/`, including
  `~/.forgeplan-web/forgeplan-web.json`. The `workspaceRoot` field in
  the user-scope config is `null` at init-time (the user-scope dist is
  workspace-agnostic; `start` binds the workspace from cwd or
  `FORGEPLAN_CWD` at runtime).
- **Project scope** only: `<cwd>/.gitignore` — **append-only**, with these constraints:
  - Add at most one ignore line: `.forgeplan-web/`.
  - The append is idempotent. Detection regex per line:
    `^[ \t]*\.forgeplan-web\/?[ \t]*$`. If a matching line is already
    present, the bin script must do nothing. Commented lines
    (`# .forgeplan-web/`) do not count as a match.
  - If `.gitignore` does not exist, create it with just the marker
    comment + the ignore line.
  - Preserve the file's existing newline convention; if the file ends
    without a newline, prepend one before the appended block.
  - Skipped entirely when the user passes `--no-gitignore`.
  - Print a notice on stdout describing what changed.

## Rationale

Users invoke `npx @forgeplan/web init` against working repos with their
own build pipelines, lint configs, and `node_modules/` resolution.
Writing host config arbitrarily would corrupt their tooling. The
narrow `.gitignore` exception exists because virtually every user
forgot to add `.forgeplan-web/` (≈11 MB including a generated
`node_modules/`) and accidentally committed it. The append is bounded,
idempotent, reversible, and opt-out — see ADR-001.

## Verification

- After `init -y` or `init --scope project`: `git status` in the host
  project must show changes only inside `.forgeplan-web/` and (at most)
  a single appended block at the end of `.gitignore`.
- After `init --scope user`: `git status` in the cwd must show **no**
  changes at all. All writes land under `~/.forgeplan-web/`.
- `runInit()` in `bin/commands/init.mjs` must not call `writeFileSync`
  / `copyFileSync` / `mkdirSync` with any path that does not resolve
  under the resolved scope target (`<cwd>/.forgeplan-web/` or
  `~/.forgeplan-web/`) — and, only under project scope, the host's
  `.gitignore`.
- Running `init -y` twice must not duplicate the `.gitignore` entry.
- Running `init -y --no-gitignore` must not touch `.gitignore` at all
  (no create, no append, no read-then-rewrite).
- `ensureGitignore` is called from `runInit` only when `scope ===
  "project"`; user-scope code paths must not even invoke it.
