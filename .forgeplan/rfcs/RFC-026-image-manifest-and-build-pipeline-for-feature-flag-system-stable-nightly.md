---
depth: standard
id: RFC-026
kind: rfc
links:
- target: PRD-030
  relation: informs
- target: ADR-005
  relation: informs
status: active
title: Image manifest and build-pipeline for feature-flag system (stable + nightly)
---

---
id: RFC-026
title: "Image manifest and build-pipeline for feature-flag system (stable + nightly)"
status: Draft
author: nikitafedorovvvvv@gmail.com
created: 2026-05-09
updated: 2026-05-09
prd: PRD-030
depth: deep
informs: PRD-030
amends: RFC-013
---

# RFC-026: Image manifest and build-pipeline for feature-flag system (stable + nightly)

## Summary

Replace the single `--experimental` boolean with a config-driven multi-image pipeline:

1. `config/images.json` lists every image (`stable`, `nightly`, …) and the flags each one ships.
2. `config/features.json` lists every flag with `addedIn` / `expiresIn` semver markers; build fails when any flag's `expiresIn ≤ currentVersion` or when the gap exceeds 3 minor versions.
3. `scripts/build.mjs` bundles `template/build/index.js` once via esbuild (already done today for `dist-experimental/`), then copies the bundle output into `dist/` (for `stable`) and `dist-<name>/` (for every other image), each with its own `forgeplan-web-build.json` carrying `{ image, features }`.
4. `bin/commands/init.mjs` accepts `--image <name>` (default `stable`); `--experimental` becomes a deprecated alias for `--image nightly` for one minor release.
5. `bin/commands/update.mjs` reads the persisted `image` from `forgeplan-web.json` and refreshes from the matching `dist*/`.

Legacy SvelteKit-with-`node_modules/` shape is dropped from the published tarball — graduating PRD-014 / RFC-013.

## Motivation

See PRD-030. Two pressures merge:

- **Graduation of the bundle shape.** RFC-013 explicitly framed `dist-experimental/` as a temporary parallel artifact pending field validation. Validation is sufficient. Keeping the legacy `dist/` doubles the tarball size and the maintenance surface.
- **Need for >2 parallel tracks.** A single boolean (`experimental`) does not scale to a third or fourth image. We want a registry, not a series of ad-hoc booleans.

The flag-lifecycle constraint (≤2-3 minor releases) comes from the user requirement: experimental flags must expire so nothing accretes silently.

## Goals / Non-Goals

### Goals

- **G1**: `config/images.json` is the single source of truth for image membership (image → flags).
- **G2**: `config/features.json` is the single source of truth for flag metadata (`addedIn`, `expiresIn`, `rollout`).
- **G3**: `scripts/build.mjs` emits one directory per image; `dist/` is reserved for `stable`; other images go to `dist-<name>/`.
- **G4**: Each emitted directory contains a `forgeplan-web-build.json` carrying `{ name, builtAt, entry, image, features }`. Bundle bytes are identical across images that share the same flag set; only the JSON differs.
- **G5**: `init` and `update` accept `--image <name>`; `start` is image-agnostic.
- **G6**: Build pipeline fails fast on lifecycle violations (flag past `expiresIn` or beyond 3-minor window).
- **G7**: `--experimental` keeps working as deprecated alias for `--image nightly` for exactly one minor release.
- **G8**: `bin/` allow-list (rule 23: `node:* + citty + relative siblings`) unchanged.

### Non-Goals

- **NG1**: Per-image runtime gating logic. v1 ships with empty feature lists; what flags *do* is the next PR's problem.
- **NG2**: Telemetry on which image users pick.
- **NG3**: Custom adapter / replacing adapter-node.
- **NG4**: Minification / further size reduction beyond what RFC-013's bundle already does.
- **NG5**: A graduation-bot that rewrites `expiresIn`. Manual.

## Options Considered

### Option A (chosen): one bundle, multiple `dist*/` outputs, image declared in `forgeplan-web-build.json`

Build SvelteKit once, bundle once via esbuild, then copy the bundle to N image-named directories. Each directory's `forgeplan-web-build.json` records the image name + feature list. The bytes of `index.js` / `client/` / `env.js` are identical across images that share the same flag set; only the manifest JSON differs. `package.json#files` enumerates each image directory.

**Pro**:

- Reuses the existing esbuild pipeline (RFC-013).
- `start` stays image-agnostic — it just spawns `index.js`.
- Adding an image is a 2-line change in `config/images.json` plus a `package.json#files` entry.
- Deterministic across builds (modulo `builtAt`).
- Backwards-compatible `dist/` path (so `init -y` users see no change in install output paths).

**Con**:

- Tarball ships duplicate bundle bytes when N images share an empty feature set. v1 with 2 empty images means ~1.4 MB of duplication.
- *Mitigation*: tarball size cap + future de-duplication step (out of scope for v1).

### Option B (rejected): one bundle, runtime-only flags via `forgeplan-web.json`

Single `dist/`. `init --image <name>` writes the chosen image into `forgeplan-web.json`; the runtime SvelteKit server reads it and gates behaviour with `if (features.includes("X"))`.

**Pro**:

- No duplication; one bundle for all images.

**Con**:

- All flag code paths ship in every install. A flag in `nightly` only is still bytes in every `stable` user's install. Doesn't fit the "image" mental model the user asked for.
- Removing a graduated flag from `nightly` doesn't reduce installed code size unless it's also removed from the source.
- Reviewer can't quickly see "what does the nightly image actually contain" — the answer is "all the code, gated at runtime."

### Option C (rejected): one full `npm` package per image (e.g. `@forgeplan/web-nightly`)

**Pro**:

- Maximum isolation; each image is its own dependency.

**Con**:

- 2× publish surface, 2× release pipeline, 2× CHANGELOG. Disproportionate for what we have today.
- Doesn't compose to N images well (would need N packages).

### Option D (rejected): keep `--experimental` boolean, add `--lts` boolean later

**Pro**:

- Smallest immediate diff.

**Con**:

- Combinatorial — N image flags = 2^N implicit combinations. Doesn't scale.
- No registry, no lifecycle, no graduation discipline. Punts on the user's actual requirement.

## Architecture

The system has four physical layers, all of which derive from one source of truth (`config/`):

```
config/                                    ← author-edited, source of truth
  images.json     (image → flags mapping)
  features.json   (flag metadata)
        ↓ (read at build-time)
scripts/build.mjs                          ← validator + emitter
  ├─ validateLifecycle(config, version)    ← rule 11-style fail-fast
  ├─ bundleBaseDist()                      ← esbuild, one shot
  └─ emitImageDist(imageName, features)    ← per-image cp + manifest write
        ↓ (writes to filesystem)
dist/                forgeplan-web-build.json: { image: "stable", features: [] }
dist-nightly/        forgeplan-web-build.json: { image: "nightly", features: [] }
        ↓ (packed in tarball via package.json#files)
@forgeplan/web@x.y.z (npm)
        ↓ (npx)
bin/forgeplan-web.mjs                      ← reads --image, picks dist*/
  ├─ commands/init.mjs    (--image <name>, default stable)
  ├─ commands/update.mjs  (sticky --image from forgeplan-web.json)
  └─ lib/images.mjs       (imagePath, isValidImageName, listAvailableImages)
        ↓ (cpSync)
<cwd>/.forgeplan-web/                      ← user's scaffold
  forgeplan-web.json: { image: "stable", ... }
  forgeplan-web-build.json: { image: "stable", features: [] }
  index.js, client/, env.js, ...
```

**Invariant**: every directory listed in `package.json#files` matching `dist*/` is also listed in `config/images.json#images`, and vice versa. Build pipeline asserts this.

**Invariant**: bin script never reads `config/` at runtime — the build pipeline materializes everything bin needs into `dist*/forgeplan-web-build.json`.

## Implementation Phases

### Phase 1 — Config and validator

Files:

- `config/images.json` — image registry (v1: `stable`, `nightly`, both with empty `features`).
- `config/features.json` — feature registry (v1: empty `features` array).
- `config/IMAGES.md` — human docs: how to add an image, how to add a flag, lifecycle policy.

Validator (in `scripts/build.mjs`, run before any artifact emission):

1. Parse both JSON files; validate schemas (string keys, arrays where required).
2. Read `package.json#version` (current).
3. For each entry in `features.json`:
   - Assert `addedIn` and `expiresIn` are valid semvers and `expiresIn > addedIn`.
   - Assert `currentVersion < expiresIn` (strict). If `>=`, fail with the offending flag id and target version.
   - Assert `expiresIn` is at most 3 minor versions past `addedIn` (i.e. `parseSemver(expiresIn).minor - parseSemver(addedIn).minor ≤ 3`, allowing major bumps to reset).
4. For each entry in `images.json#images.<name>.features`:
   - Assert every named flag exists in `features.json`.

Failure → non-zero exit, single stderr line per violation.

### Phase 2 — Build emission per image

Refactor `scripts/build.mjs`:

- Drop `installRuntimeDeps()`, `emitDistPackageJson()`, `copyToDist()`. Their only purpose was to produce the legacy SvelteKit shape.
- Rename `bundleExperimentalDist()` → `bundleBaseDist()`. Its output goes to a temp directory `dist-base/` (gitignored), or stays as a re-usable in-memory artifact.
- New `emitImageDist(imageName, features)`:
  - Compute target: `dist/` if `imageName === "stable"`, else `dist-${imageName}/`.
  - `rmSync(target)` then `cpSync(BUNDLE_BASE, target)`.
  - Write `target/forgeplan-web-build.json` with `{ name: "@forgeplan/web", builtAt, entry: "index.js", image: imageName, features }`.
  - `patchHostDefault(target)` (already proven on dist-experimental).
  - Assert `du -sb target ≤ 3 MB`.
- Loop over `Object.entries(images.images)` and call `emitImageDist`.
- Drop `--skip-experimental`. Add `--only=<image>` for partial rebuilds (devloop convenience).
- Sanity gate: `package.json#files` MUST include every emitted directory; build fails otherwise.

### Phase 3 — Bin plumbing

`bin/lib/images.mjs` (new):

```js
// Exports:
//   imageDirName(imageName)        → "dist" | "dist-<name>"
//   imagePath(pkgRoot, imageName)  → absolute path
//   isValidImageName(name)         → boolean (regex /^[a-z][a-z0-9-]*$/)
//   listAvailableImages(pkgRoot)   → ["stable", "nightly", ...] (probes filesystem)
```

`bin/commands/init.mjs`:

- Replace `experimental` arg with `image: { type: "string", description: "image name (default: stable)", valueHint: "stable|nightly" }`.
- Keep `experimental` as a hidden alias arg; if `args.experimental === true && args.image == null`, set `image = "nightly"` and print stderr deprecation pointing to `--image nightly`.
- `runInit` takes `{ image: "stable" | "nightly" | ... }`. Resolves dir via `imagePath(PKG_ROOT, image)`. `existsSync(dir)` → fail otherwise.
- `forgeplan-web.json` writer adds `image` field. `experimental` field is no longer written.

`bin/commands/update.mjs`:

- Same `--image` plumbing.
- Migration block: when reading existing config, if `image` is missing but `experimental === true`, treat as `image: "nightly"`. Write the new shape on next save.

`bin/lib/config.mjs`:

- `readConfig` returns the new shape; downstream code uses `cfg.image ?? (cfg.experimental ? "nightly" : "stable")` for read-back compat.

### Phase 4 — Docs and rules

- README.md / README.ru.md: document `--image` + image lifecycle policy + flag-graduation policy (≤3 minor versions).
- `config/IMAGES.md`: detailed maintainer guide.
- Rule 21 (`template-purity`): replace "the bundle approach is opt-in" language with "the bundle approach is the single artifact form for every image; `dist/` for stable, `dist-<name>/` for others."
- Rule 23 (`bin-zero-deps`): note `bin/lib/images.mjs` as a sibling module (allowed by rule); no new third-party deps.
- CLAUDE.md: replace `dist-experimental/` references with image-aware language; document `config/`.
- CHANGELOG: BREAKING CHANGE entry under Unreleased / next minor.

### Phase 5 — Smoke and evidence

- Extend `scripts/smoke.mjs` to run twice: once with default `init -y` and once with `init -y --image nightly`. Both must reach `exit 0` + `/api/health 200` + `/api/list 200` + `GET / 200`.
- EvidencePack with `## Structured Fields` (`verdict: supports`, `congruence_level: 3`, `evidence_type: test`) capturing both runs.
- Activate PRD-030 / RFC-026 / ADR-005 once `R_eff > 0`.

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Bundle byte-duplication grows tarball materially as more images ship | Low | Medium | NFR-001 caps each `dist*/` ≤3 MB; alarm in CHANGELOG when total tarball >10 MB |
| Schema drift between `config/images.json` and `config/features.json` | Medium | Medium | Build-time validator (Phase 1) cross-references; test fixture exercises an unknown-flag-id case |
| Removing legacy SvelteKit shape surfaces a user we missed in smoke | Low | High | Smoke matrix on ubuntu/macos/windows + Node 20.19 / 22 (existing CI); revert path is a single commit |
| `--experimental` deprecation warning gets ignored | Medium | Low | Print on every invocation, not once; CHANGELOG entry; remove in announced minor |

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
- CLAUDE.md
- scripts/smoke.mjs (extended for --image)

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-030 | informs | this PR |
| ADR-005 | informs (image-as-artifact decision) | this PR |
| PRD-014 | based_on (esbuild bundle motivation) | active |
| RFC-013 | amends (graduates `--experimental`) | active |
| ADR-003 | based_on (citty-only bin allow-list, unchanged) | active |




