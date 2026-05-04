# Changelog

All notable changes to `@forgeplan/web` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Pending for the next release

- Marketing-style README rewrite + Russian translation (`README.ru.md`).
- `docs/` split: `USAGE.md` (end-user reference) and `CONTRIBUTING.md` (dev/release flow).
- `.github/assets/hero.png` — interactive map screenshot for the npm landing.
- `LICENSE` (MIT) added at repo root and declared in `package.json#files`.
- `CHANGELOG.md` (this file) added at repo root and declared in `package.json#files`.
- Demo console block in both READMEs aligned to the actual `init` output.
- Cross-platform CI badge URL switched from relative to absolute (so it renders
  on the npm registry landing page, not only on GitHub).
- `.claude/rules/00-index.md` now lists rule 12 (`forgeplan-agent-dispatch`).

### Security

Tactical hardening pass per PRD-002 (S1 batch).

- **CWE-78** — `FORGEPLAN_BIN` regex-validated at module load in `template/src/shared/server/forgeplan.ts`. Refuses spawn (returns `502` envelope) when the env var contains characters outside `[A-Za-z0-9_./:\-]`. Closes a Windows `shell:true` command-injection vector.
- **CWE-59** — `bin/forgeplan-web.mjs#update` now `lstat`s `.forgeplan-web/` before `rmSync`; refuses to operate when target is a symlink. Plus a `resolve()`-equality assert as defense-in-depth against future refactors.
- **CWE-770** — `template/src/shared/server/forgeplan.ts` enforces in-process spawn concurrency cap (4 simultaneous `forgeplan` processes). Bounds loopback / LAN-bound DoS surface.
- **CWE-1357** — `scripts/build.mjs#installRuntimeDeps` passes `--ignore-scripts` to `npm install`. Blocks transitive postinstall hooks from baking arbitrary code into published `dist/node_modules/`.

## [0.1.4] - 2026-05-04

### Added

- `update` subcommand on `bin/forgeplan-web.mjs` — refreshes `./.forgeplan-web/`
  to the version bundled with the currently-resolved package, preserving
  `workspaceRoot` and `createdAt`.
- Feature-Sliced Design migration of `template/src/`:
  `app/`, `pages/`, `widgets/`, `entities/`, `shared/` replace the old
  `lib/` layout.
- Five graph view modes — Force, Lanes, Matrix, Radial, Tree —
  in `template/src/widgets/dependency-graph/ui/`.
- New `/api/blindspots` and `/api/journal` read-only endpoints.
- `.claude/rules/12-forgeplan-agent-dispatch.md` and `ADR-002` covering
  parallel sub-agent coordination via `forgeplan_dispatch` / `forgeplan_claim`.
- Skill scaffolds for `feature-sliced-design`, `svelte-code-writer`,
  `svelte-core-bestpractices` under `.claude/skills/`.
- `scripts/dev.mjs` entry point for the SvelteKit HMR loop.
- `CLAUDE.md` rewrite: 8 RED LINES, Routing table, Forge Mode permission zones,
  EvidencePack Structured Fields example, Git workflow section, Reference
  (guides) block linking to `guides/INDEX.md`.
- `guides/CLAUDE-MD-GUIDE.ru.md` and `guides/GIT-FLOW-GUIDE.ru.md` (authored
  methodological guides bundled into the repo).
- GitHub Branch Protection on `main` + `develop` (PR required, 3-OS smoke
  required, force-push blocked, delete blocked, `enforce_admins: true`).
- Rulesets: `release-branches-no-force-push` (id 15928537) and
  `tag-protection-semver` (id 15928584, target=tag, rules=`update`+`deletion`).

### Fixed

- **Windows CI was red since day 1.** `spawnSync('npm', ...)` and
  `spawn('forgeplan', ...)` could not invoke `.cmd` shims via
  `CreateProcess` without `shell: true`. Added `shell: process.platform === 'win32'`
  to the build pipeline (`scripts/build.mjs`), the bin probe
  (`bin/forgeplan-web.mjs`), and the live server driver
  (`template/src/shared/server/forgeplan.ts`). Smoke matrix is now green
  on `ubuntu-latest` × `macos-latest` × `windows-latest` × Node 22.
- `scripts/smoke.mjs` cleanup: `await server.exit` before `rmSync`, plus
  `maxRetries: 20` / `retryDelay: 100` on Windows to avoid `EBUSY` on the
  scratch dir held by the still-exiting child process.
- `forge-safety-hook.sh`: false-positive guard for text-only commands
  (`git commit -m`, `git log`, `gh pr create`, `echo`, `printf`, `cat <<`)
  so dangerous-looking strings inside commit messages and HEREDOC bodies no
  longer trigger the block. New explicit blocks for `forgeplan init --force`
  (override `FORGE_ALLOW_INIT_FORCE=1`) and direct push to
  `main`/`master`/`develop`/`release/*` (override
  `FORGE_ALLOW_PUSH_TO_PROTECTED=1`).

### Changed

- `actions/checkout@v4` → `@v5` and `actions/setup-node@v4` → `@v5` in both
  `smoke.yml` and `release.yml` (Node 24 default ahead of the June 2026 Node
  20 deprecation).
- `package.json#scripts.dev` now points to `scripts/dev.mjs` (was inline
  `cd template && npm run dev`).

## [0.1.3] - 2026-05-04

### Added

- Cross-platform smoke matrix workflow (`.github/workflows/smoke.yml`)
  on `ubuntu-latest`, `macos-latest`, `windows-latest` × Node 22.
- `.forgeplan/` workspace seeded with the package's own decision artifacts
  (RFC-001, ADR-001, EvidencePacks).

## [0.1.2] - 2026-05-04

### Added

- `repository` metadata in `package.json` for sigstore provenance — required
  by `npm publish --provenance` to attach the build's source revision to the
  signed artifact.

## [0.1.1] - 2026-05-04

Initial public release attempt. The Windows runtime path was silently
broken end-to-end and CI matrix was red — both addressed in 0.1.4.

## [0.1.0] - 2026-04-04

Internal release. Pre-built SvelteKit app published as a single
`@forgeplan/web` npm package, scaffolded into `.forgeplan-web/` of the
host project via `npx @forgeplan/web init -y`. No `npm install` at user
side: `dist/` ships its own `node_modules/` populated with
`--omit=dev --omit=peer`.

[Unreleased]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/ForgePlan/forgeplan-web/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/ForgePlan/forgeplan-web/releases/tag/v0.1.1
[0.1.0]: https://github.com/ForgePlan/forgeplan-web/releases/tag/v0.1.0
