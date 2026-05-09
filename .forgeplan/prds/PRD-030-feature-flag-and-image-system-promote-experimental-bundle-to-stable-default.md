---
depth: standard
id: PRD-030
kind: prd
status: active
title: Feature-flag and image system; promote experimental bundle to stable default
---

---
id: PRD-030
title: "Feature-flag and image system; promote experimental bundle to stable default"
status: Draft
author: nikitafedorovvvvv@gmail.com
created: 2026-05-09
updated: 2026-05-09
priority: P1
depth: deep
domain: general
projectType: cli_tool
stepsCompleted: []
---

# PRD-030: Feature-flag and image system; promote experimental bundle to stable default

## Executive Summary

### Vision

`@forgeplan/web` ships **multiple named "images" of the scaffold** (today: `stable` + `nightly`) chosen at `init` time via `--image <name>`, with a config-driven feature-flag registry that forces every flag to graduate or expire within 2-3 minor releases. The legacy SvelteKit-with-`node_modules/` shape is dropped; the bundle approach (PRD-014 / RFC-013) becomes the single artifact form for every image.

### Problem

Two related issues compounded into one product-shape decision:

1. **Experimental bundle has been opt-in too long.** PRD-014 / RFC-013 introduced `dist-experimental/` as a single-file esbuild bundle (~9× smaller than legacy `dist/`). It ships behind `init --experimental`. Smoke tests, sweeps, and field use across multiple minor versions show it is at least as reliable as the legacy shape, but `--experimental` keeps it opt-in. Users on the slow path keep paying ~14 MB of `dist/node_modules/` per `init` for no upside.
2. **No graduation discipline for shape variants.** The repo has accumulated one ad-hoc opt-in (`--experimental`) with no policy on (a) when it graduates, (b) how to ship a *second* parallel variant, (c) how to keep experimental flags from accreting indefinitely. The only switch today is a single boolean. Adding a third parallel shape (e.g. an LTS line, or a feature-preview lane) would mean adding another ad-hoc boolean to `init`, `update`, and `forgeplan-web.json`.

**Impact**:

- Default `init` users still get the 14 MB shape in v0.1.x, ~9× larger than necessary.
- Adding a new track means duplicating ad-hoc plumbing in three places, each of which is a chance to forget one.
- Experimental flags (`--experimental` is the prototype) can drift indefinitely with no forcing function for graduation.

### Target Users

| Persona | Описание | Ключевая боль |
|---------|----------|---------------|
| End user of `npx @forgeplan/web init` | Запускает в чужом репо, expects sensible default | Сейчас платит за legacy shape; не имеет выбора между «стабильный» и «бета» без знания внутренних флагов |
| Maintainer пакета | Шипит multiple варианты scaffold'а | Нет фреймворка: каждый новый вариант = новый ad-hoc булевый флаг + три места правки |
| Adventure-mode user | Хочет получить early-access функции до общего релиза | Нет канала "nightly" с чёткой политикой что-там-внутри |

### Differentiators

- **Single source of truth for what ships.** `config/images.json` + `config/features.json` describe every image and every flag; `scripts/build.mjs` reads them; bin script reads the resulting `forgeplan-web-build.json`. No flag definitions scattered across files.
- **Graduation is enforced, not requested.** The build pipeline fails when any flag is older than its declared `expiresIn` vs the current `package.json#version`. The forcing function is mechanical.
- **Backwards compatible at the install surface.** `init` without flags keeps working (defaults to `stable`); `init --experimental` keeps working for one minor release with a deprecation warning aliasing to `--image nightly`. `forgeplan-web.json` with `experimental: true` is migrated on next `update`.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Default `init` produces the bundle shape | `! test -d .forgeplan-web/node_modules` after `init -y` | dist/node_modules exists (~12 MB) | path absent | до merge в develop | scripts/smoke.mjs assertion |
| SC-2 | `init --image nightly` writes a distinct image record | `forgeplan-web.json#image == "nightly"` | n/a (no field) | exact match | до merge в develop | jq assertion in smoke output |
| SC-3 | `init --experimental` works with deprecation warning | stderr matches `/deprecated.*--image nightly/i` | warning absent | warning present, exit 0 | до merge в develop | smoke / manual check |
| SC-4 | All emitted image directories ≤3 MB | `du -sb dist*/` | 14 MB legacy | ≤3 MB each | до merge в develop | scripts/build.mjs assertion (existing cap) |
| SC-5 | Build fails when a flag's expiry < current version | exit code of build with seeded expired flag | n/a (no validator) | non-zero exit | до merge в develop | unit assertion in build pipeline (synthetic flag fixture) |
| SC-6 | `npm run smoke` passes against both images | exit 0 | passes for legacy only | exit 0 for `stable` and `nightly` | до merge в develop | scripts/smoke.mjs with `--image` arg |
| SC-7 | Forgeplan artifacts validated and `R_eff > 0` | `forgeplan score PRD-030` | 0 (artifact draft) | >0 | до merge в develop | forgeplan score |

---

## Product Scope

### MVP (In-Scope)

- `config/images.json` — image registry. Schema: `{ "$schema": "...", "images": { "<name>": { "description": "...", "features": ["<flag-id>", ...] } } }`. v1 ships `stable` and `nightly`, both with empty feature lists.
- `config/features.json` — feature registry. Schema per entry: `{ id, description, addedIn (semver), expiresIn (semver), owner, rollout: "alpha"|"beta"|"stable" }`. v1 ships an empty array — framework only.
- Migration of `dist-experimental/` shape to be the universal artifact for every image. Legacy `dist/` (SvelteKit + `node_modules/`) is dropped.
- `scripts/build.mjs` reads `config/`, validates feature lifecycle (no flag where `currentVersion >= expiresIn`), bundles once via esbuild, then copies to `dist/` (for `stable`) and `dist-<name>/` (for every other image), each with its own `forgeplan-web-build.json` carrying `{ image, features }`.
- `bin/commands/init.mjs` — new `--image <name>` flag, default `stable`, validated against existing image directories. `--experimental` is kept as deprecated alias for `--image nightly` with a stderr warning.
- `bin/commands/update.mjs` — same `--image` plumbing. Reads persisted `image` from `forgeplan-web.json`. Migration: if `experimental: true` is found, treat as `image: nightly`.
- `forgeplan-web.json` gains an `image` field. The `experimental` boolean stays for one minor release for read-back compatibility, then is dropped.
- `package.json#files` enumerates `dist`, `dist-nightly` (and any future image dirs explicitly).
- README + rule 21 + rule 23 updated.

### Out of Scope

- Per-feature runtime gating in the SvelteKit app. Flags are declared and shipped — what they *do* is the responsibility of the feature-PR that adds them. v1 ships an empty registry.
- Dropping `--experimental` outright in this PR. Kept as deprecated alias for one minor release; removal scheduled for the release after that.
- Spec'ing a third image (e.g. `lts`). Framework supports it, but no `lts/` image ships in this PR.
- Pruning the legacy `dist/` rebuild path right away. The `copyToDist()` / `installRuntimeDeps()` / `emitDistPackageJson()` functions are removed in this PR — they are not kept on a fallback path.

### Growth Vision

- Per-image release cadence (e.g. `nightly` cut from every `develop` merge; `stable` cut on tagged releases only).
- A third `lts` or `preview` image once a real flag wants its own track.
- Telemetry (opt-in) on which image users pick — informs whether `nightly` is worth maintaining.

---

## User Journeys

### Journey 1: End user — first install on the new scheme

**Цель пользователя**: scaffold the viewer into their project, no surprises.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | `npx @forgeplan/web init -y` in repo with `.forgeplan/` | Copies `dist/` (= bundle shape, the new stable) to `.forgeplan-web/`; writes `forgeplan-web.json` with `image: "stable"` | No flag needed; default is the `stable` image |
| 2 | `npx @forgeplan/web start` | Spawns `node .forgeplan-web/index.js` | Same UX as today |
| 3 | Inspects `.forgeplan-web/forgeplan-web-build.json` | `{ name, builtAt, entry, image: "stable", features: [] }` | UI/server can read this to gate behaviour later |

**Результат**: same install UX as today; smaller artifact; image is recorded in config.

### Journey 2: Adventure user — opts into nightly

**Цель пользователя**: try the next-track image even though no flags are turned on yet.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | `npx @forgeplan/web init --image nightly` | Copies `dist-nightly/` to `.forgeplan-web/`; writes `forgeplan-web.json` with `image: "nightly"` | Today nightly == stable bytes-wise (no flags), but the image-track is recorded |
| 2 | Later: `npx @forgeplan/web update` | Resolves the persisted `image: "nightly"` and refreshes from `dist-nightly/` of the new package version | No `--image` flag needed on update — track is sticky |
| 3 | Switch back: `npx @forgeplan/web update --image stable` | Switches to `dist/` and rewrites `image: "stable"` in config | Both directions supported |

**Результат**: the user can pick a track explicitly; track is sticky across `update`s; switching is one flag away.

### Journey 3: Existing user with `experimental: true` config

**Цель пользователя**: keep working without rerunning `init`.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | Has `forgeplan-web.json` with `experimental: true` from a previous version | n/a | Pre-existing state |
| 2 | Runs `npx @forgeplan/web update` after upgrading the package | `update` reads `experimental: true`, treats as `image: nightly`, refreshes from `dist-nightly/`, writes `image: "nightly"` to config (drops `experimental`) | Migration is one-way and silent (single log line) |
| 3 | Runs `npx @forgeplan/web init --experimental` | Init runs with `image: nightly` and prints a deprecation warning to stderr pointing to `--image nightly` | Removed in 0.3.0 |

**Результат**: existing users do nothing; first `update` migrates them; CLI flag removal is announced.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Core | Must | Maintainer can declare images and the flags they include via a single JSON config | Journey 1, 2 |
| FR-002 | Core | Must | Maintainer can declare a flag's lifecycle (`addedIn`, `expiresIn`) so the build pipeline enforces graduation | Journey 1 |
| FR-003 | Core | Must | End user can choose an image at install time via `--image <name>`, with `stable` as the default | Journey 1, 2 |
| FR-004 | Core | Must | End user can switch images via `update --image <name>`; the choice is sticky in `forgeplan-web.json` for subsequent updates | Journey 2 |
| FR-005 | Compatibility | Must | Existing user with `experimental: true` in config gets migrated to `image: "nightly"` on first `update` without re-running `init` | Journey 3 |
| FR-006 | Compatibility | Should | `init --experimental` keeps working for one minor release as deprecated alias for `--image nightly`, with a stderr warning | Journey 3 |
| FR-007 | Build | Must | Build pipeline emits `dist/` for `stable` and `dist-<name>/` for every other image, each with its own `forgeplan-web-build.json` carrying `{ image, features }` | Journey 1, 2 |
| FR-008 | Build | Must | Build pipeline fails non-zero when any flag in any image has `expiresIn ≤ currentVersion` | Journey 1 (indirect — author surface) |
| FR-009 | Operability | Should | `start` does not need to know about images; it spawns whatever sits at `.forgeplan-web/index.js` | Journey 1, 2 |
| FR-010 | Documentation | Must | README documents `--image` + image lifecycle policy + flag-graduation policy | Journey 1, 2 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Size | Each emitted image directory must fit | ≤3 MB | After `npm run build`, before publish | `du -sb dist*/` assertion in scripts/build.mjs |
| NFR-002 | Compatibility | `start` must succeed against any emitted image without configuration changes | exit 0 + /api/health 200 | scripts/smoke.mjs run with each image | smoke output |
| NFR-003 | Build determinism | Repeated `npm run build` must produce per-image directories with the same byte content modulo `builtAt` timestamp | byte-diff = `forgeplan-web-build.json` only | Two consecutive builds on same git SHA | `diff -r dist*/` excluding `forgeplan-web-build.json` |
| NFR-004 | Bin allow-list | `bin/` must remain bound to `node:*` + `citty` after the change | grep on bin/**/*.mjs | All bin files | rule 23 verification block |
| NFR-005 | Lifecycle | No flag can persist past `expiresIn` once a release crossing that version is being built | exit code of `npm run build` | Synthetic fixture flag with expired version | unit harness inside scripts/build.mjs (or scripts/test/) |

---

## Acceptance Criteria

### AC-1: default install produces bundle shape

```gherkin
Given a clean scratch directory with a `.forgeplan/` workspace and `forgeplan` on PATH
When the user runs `npx @forgeplan/web init -y`
Then the directory `.forgeplan-web/` is created
And  `.forgeplan-web/index.js` exists
And  `.forgeplan-web/node_modules/` does NOT exist
And  `.forgeplan-web/forgeplan-web.json` contains `"image": "stable"`
And  `.forgeplan-web/forgeplan-web-build.json` contains `"image": "stable"` and `"features": []`
```

### AC-2: nightly image install records track

```gherkin
Given a clean scratch directory with a `.forgeplan/` workspace
When the user runs `npx @forgeplan/web init --image nightly`
Then `.forgeplan-web/forgeplan-web.json` contains `"image": "nightly"`
And  `.forgeplan-web/forgeplan-web-build.json` contains `"image": "nightly"`
And  the start command spawns the server successfully on a free port
```

### AC-3: deprecated --experimental aliases to nightly

```gherkin
Given a clean scratch directory with a `.forgeplan/` workspace
When the user runs `npx @forgeplan/web init --experimental`
Then the exit code is 0
And  stderr contains a deprecation message pointing to `--image nightly`
And  `.forgeplan-web/forgeplan-web.json` contains `"image": "nightly"`
```

### AC-4: build fails on expired flag

```gherkin
Given the build harness is invoked with a synthetic feature whose `expiresIn` precedes the current `package.json#version`
When `node scripts/build.mjs` runs
Then the exit code is non-zero
And  stderr names the offending flag id and the expiry version
```

### AC-5: build emits per-image manifests

```gherkin
Given `config/images.json` lists `stable` and `nightly`
When `npm run build` completes successfully
Then `dist/forgeplan-web-build.json` contains `"image": "stable"` and `"features": []`
And  `dist-nightly/forgeplan-web-build.json` contains `"image": "nightly"` and `"features": []`
And  neither directory contains a `node_modules/` subdirectory
```

---

## Dependencies

| Dependency | Type | Status | Owner |
|-----------|------|--------|-------|
| `template/` SvelteKit build pipeline | Internal | Stable | maintainers |
| `esbuild` ^0.24 (devDep) | Internal | Pinned | maintainers |
| `citty` ^0.2.2 (runtime dep, ADR-003) | Internal | Pinned | maintainers |
| Forgeplan workspace | Methodology | Active | maintainers |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Dropping legacy `dist/` shape regresses a user we didn't catch in smoke | Low | High | One-version overlap of `--experimental` alias + smoke against both images + EvidencePack capturing exit codes; revert path is one commit (restore `copyToDist` + `installRuntimeDeps`) | maintainers |
| R-2 | Build-time lifecycle validator becomes annoying (false positives during release-train freeze) | Medium | Medium | Validator compares against `package.json#version` only; release engineer can explicitly bump `expiresIn` in `config/features.json` as part of the freeze | maintainers |
| R-3 | `--experimental` deprecation removed too early, breaks scripts | Medium | Low | Keep alias for explicitly-named single minor release before removal; CHANGELOG entry; deprecation warning printed every invocation | maintainers |
| R-4 | `config/images.json` and `package.json#files` drift (a new image is built but not packed) | Medium | High | Build pipeline asserts that every image directory it emits is referenced in `package.json#files`; CI fails otherwise | maintainers |

---

## Timeline

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| PRD activated | 2026-05-09 | This document, evidence-linked |
| RFC-026 activated | 2026-05-09 | Architecture for build pipeline + bin plumbing |
| ADR-005 activated | 2026-05-09 | Image-as-build-artifact decision |
| Implementation merged to develop | 2026-05-09 | PR closing issue #121 |
| Released in next minor (≥ 0.2.0) | TBD | Standard release/v* cycle from develop → main |
| `--experimental` flag removed | one minor after release (≥ 0.3.0) | Per FR-006 commitment |

---

## Stakeholders

| Role | Name | Sign-off |
|------|------|----------|
| Product Owner | nikitafedorovvvvv@gmail.com | [x] |
| Engineering Lead | nikitafedorovvvvv@gmail.com | [x] |
| Design | n/a | [x] |
| QA | smoke.mjs (machine) | [x] |

---

## Affected Files

- scripts/build.mjs
- bin/commands/init.mjs
- bin/commands/update.mjs
- bin/lib/config.mjs
- bin/lib/images.mjs (new)
- config/images.json (new)
- config/features.json (new)
- config/IMAGES.md (new)
- package.json
- README.md
- README.ru.md
- CHANGELOG.md
- .claude/rules/21-template-purity.md
- .claude/rules/23-bin-zero-deps.md

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-014 | informs (esbuild bundle origin) | active |
| RFC-013 | supersedes the `--experimental`-as-feature-flag scheme | active |
| RFC-026 | architecture for this PRD | this PR |
| ADR-005 | image-as-build-artifact (vs runtime) | this PR |
| EvidencePack (created by this PR) | smoke evidence for SC-1..SC-6 | this PR |




