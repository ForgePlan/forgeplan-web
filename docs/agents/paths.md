# Paths

Where things live. Authoritative tree — [`../../CLAUDE.md`](../../CLAUDE.md)
"Repo layout".

## Top-level

| Path                  | Purpose                                                          | Published? |
| --------------------- | ---------------------------------------------------------------- | ---------- |
| `bin/`                | Zero-dep Node CLI (`forgeplan-web.mjs` — init / update / start) | ✅ yes     |
| `dist/`               | Pre-built scaffold for the `stable` image (default for `init`)   | ✅ yes     |
| `dist-nightly/`       | Pre-built scaffold for the `nightly` image (`init --image nightly`) | ✅ yes  |
| `config/`             | Image + feature-flag registries (`images.json`, `features.json`, `IMAGES.md`) | ❌ no |
| `template/`           | SvelteKit source — the thing every `dist*/` is built from        | ❌ no      |
| `scripts/`            | `build.mjs`, `smoke.mjs`, `test/forgeplan-shim.mjs`              | ❌ no      |
| `playground/`         | Seeded ~123-artifact Forgeplan workspace for HMR-driven testing  | ❌ no      |
| `.forgeplan/`         | This repo's **own** Forgeplan workspace (PRD/RFC/ADR/Evidence)   | ❌ no      |
| `.claude/`            | Hooks, rules, project skills, settings                           | ❌ no      |
| `docs/`               | `USAGE.md`, `CONTRIBUTING.md`, `agents/` (this file)             | ❌ no      |
| `guides/`             | Methodology guides (CLAUDE-MD, Git Flow)                         | ❌ no      |

The npm tarball ships `bin/`, `dist/`, every `dist-<image>/` declared
in `config/images.json`, and `README.md`. Everything else is
repo-internal. Adding a new image means: add it to `config/images.json`
and add the directory to `package.json#files` (PRD-030 / RFC-026 /
ADR-005).

## Inside `template/` — Feature-Sliced Design

`template/src/` follows FSD v2.1. See
[`../../.claude/skills/feature-sliced-design/SKILL.md`](../../.claude/skills/feature-sliced-design/SKILL.md)
for the layer/import rules.

| Layer        | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| `app/`       | Root layout, global CSS, providers                                 |
| `pages/`     | SvelteKit page-level routes                                        |
| `widgets/`   | Composite UI blocks — HealthBar, Filters, DependencyGraph (5 views), … |
| `entities/`  | Domain types — artifact, graph, health, score, claim, blocked, activity |
| `shared/`    | `api/` (HTTP clients), `server/` (read-only forgeplan proxy), `config/` |

`template/src/routes/api/` contains the **read-only proxy endpoints**
([rule 22](../../.claude/rules/22-readonly-proxy.md)).

## Where fpl-skills should write

- **`/fpl-skills:research`** reports → `research/reports/<topic>/` (one
  per topic). Don't pollute `.forgeplan/` — link from the driving
  artifact via `forgeplan link` instead.
- **`/fpl-skills:rfc`** → `.forgeplan/rfcs/RFC-NNN-<slug>.md`. Use
  `forgeplan new rfc "<title>"` to generate the ID; do NOT pick the
  next number manually.
- **`/fpl-skills:audit`** report → emit to chat / pin into the
  driving artifact body. Don't create an evidence record from an
  audit unless the audit was specifically scoped as evidence (verify
  `## Structured Fields` are present).
- **`/fpl-skills:sprint`** plan → `IMPLEMENTATION-PLAN.md` (transient,
  gitignored if generated; commit only if the user asks).

## Forbidden write paths

- **Anywhere outside `<cwd>/.forgeplan-web/`** for the bin script
  ([rule 20](../../.claude/rules/20-init-host-isolation.md)).
- **`template/` from agents acting as end-users** — that's
  repo-internal source, not a thing `init` produces.
- **`.forgeplan/lance/`** by hand — derived from markdown via
  `forgeplan scan-import`; editing it desyncs the index.
