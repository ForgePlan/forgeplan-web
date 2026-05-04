# `init` host isolation

`bin/forgeplan-web.mjs init` runs in the user's project directory. It
MUST write only inside `<cwd>/.forgeplan-web/`, with **one** narrow
exception: appending an ignore rule for `.forgeplan-web/` to the host's
`.gitignore` (see ADR-001). Every other host write is forbidden.

## Forbidden writes from `init`

- The host's `package.json`, `pnpm-lock.yaml`, `package-lock.json`,
  `yarn.lock`.
- The host's `.npmrc`, `.editorconfig`, or any other root config.
- The host's `node_modules/`.
- The host's `.forgeplan/` (the workspace is *read* via the bundled
  `forgeplan` CLI; never written by us).
- Any file outside `<cwd>/.forgeplan-web/` other than the single
  `.gitignore` exception below.

## Allowed writes

- Anything inside `<cwd>/.forgeplan-web/`.
- `<cwd>/.forgeplan-web/forgeplan-web.json` (workspace pointer the
  SvelteKit server reads at runtime).
- `<cwd>/.gitignore` — **append-only**, with these constraints:
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

- `git status` in the host project after `init` must show changes only
  inside `.forgeplan-web/` and (at most) a single appended block at the
  end of `.gitignore`.
- The `init()` function in `bin/forgeplan-web.mjs` must not call
  `writeFileSync` / `copyFileSync` / `mkdirSync` with any path that
  does not resolve under `target` (`.forgeplan-web/`) or under the
  host's `.gitignore`.
- Running `init` twice must not duplicate the `.gitignore` entry.
- Running `init -y --no-gitignore` must not touch `.gitignore` at all
  (no create, no append, no read-then-rewrite).
