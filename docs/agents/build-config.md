# Build & Test Config

Stack: **Node.js (zero-dep CLI in `bin/`) + SvelteKit (in `template/`,
built into `dist/`)**. Engines: `^20.19.0 || >=22.12.0`.

Authoritative reference — [`../../CLAUDE.md`](../../CLAUDE.md) "Common
commands" and [`../CONTRIBUTING.md`](../CONTRIBUTING.md) "Day-to-day
commands".

## Commands fpl-skills should know

### Build

```bash
npm run build      # full pipeline: vite build + emit dist/package.json + npm i --omit=dev
npm run clean      # rm dist/ template/build/ template/.svelte-kit/
```

### Dev loop

```bash
npm run dev              # HMR on raw template/ sources → http://localhost:5174
npm run dev:playground   # HMR with seeded ~123-artifact playground/.forgeplan/
```

`npm run dev` requires a real `forgeplan` binary on `PATH`.

### Smoke (CI-equivalent)

```bash
npm run smoke      # scaffold to temp dir, prepend forgeplan-shim to PATH,
                   # boot server, assert /api/health, /api/list, GET / return 200
```

**Run after every change to `bin/`, `scripts/`, or `template/` before
opening a PR.** This is the same script CI runs across
ubuntu/macos/windows × Node 22.

### Forgeplan (workspace)

```bash
forgeplan health             # session-start sanity check (run on /restore)
forgeplan list               # all artifacts
forgeplan validate <id>      # 0 MUST errors required for Standard+
forgeplan score <id>         # R_eff calc — must be > 0 to activate
forgeplan reindex            # rebuild Lance index after direct .md edits
```

## Type-check & lint

There is **no separate `npm run typecheck` / `npm run lint`** at the
repo root. Type-checking happens inside `npm run build` (vite +
svelte-check). Treat a green `npm run smoke` as the merge gate.

## Forbidden in CI / scripts

- `npm publish`, `pnpm publish`, `yarn publish` — release workflow
  only (`.github/workflows/release.yml`).
- `--no-verify` on any `git commit` / `git push`.
- `forgeplan init --force` without a `.forgeplan/` backup.

These are blocked at the shell hook level
(`.claude/hooks/forge-safety-hook.sh`); listed here so fpl-skills
agents do not propose them.

## Cross-platform notes

- The bin script must use Node built-ins only
  ([rule 23](../../.claude/rules/23-bin-zero-deps.md)).
- `scripts/build.mjs` invokes `spawn('npm', …)` with `shell: true` on
  `win32` so `npm.cmd` resolves. Don't undo that — Windows CI breaks
  silently otherwise.
