---
depth: standard
id: ADR-005
kind: adr
links:
- target: PRD-030
  relation: informs
status: active
title: Image as build artifact, not runtime config
---

---
id: ADR-005
title: "Image as build artifact, not runtime config"
status: Proposed
depth: deep
valid_until: 2027-05-09
created: 2026-05-09
updated: 2026-05-09
informs: PRD-030
amends: RFC-013
---

# ADR-005: Image as build artifact, not runtime config

## Context

PRD-030 introduces named "images" of the `@forgeplan/web` scaffold (initial set: `stable`, `nightly`). Each image declares the set of feature flags it ships. There are two structurally different ways to materialize an image:

- **Build-time**: emit one filesystem directory per image (`dist/`, `dist-nightly/`, …), each containing the bundle bytes for that flag set. `init --image <name>` is a `cp -r` of the chosen directory.
- **Runtime**: ship one bundle and one runtime config. `init --image <name>` writes the chosen image into `forgeplan-web.json`; the SvelteKit server reads `features` at startup and gates behaviour with `if (features.includes("X"))`.

The two approaches differ in code locality, tarball size, dead-code shipping, mental model, and the level of effort required to introduce future image-tracks (e.g. an `lts` lane). This ADR locks the choice in.

## Decision

**Selected**: build-time. An image is a directory in the npm tarball; `init --image <name>` is a `cp -r` of the named directory.

Concretely:

- Build pipeline emits N filesystem directories — one per declared image. `dist/` is reserved for `stable`; other images go to `dist-<name>/`.
- Each directory contains the same bundle bytes today (because v1 images all have empty feature lists), but they are byte-divergent in principle and divergent in practice as soon as flags exist.
- `forgeplan-web-build.json` records the image name and the active feature list. The bin script does not interpret features.
- `start` does not know about images. It spawns `node .forgeplan-web/index.js`.

Build-time was selected because it preserves the user's "image" mental model (a directory IS an image), it keeps `start` image-agnostic, and it lets us drop dead code from images that don't enable a flag once the bundling pipeline learns about flags. Runtime gating remains available as a future tactical option for individual flags within an image, but the image identity itself is a build-time fact.

## Consequences

### Positive

- `start` is image-agnostic; unchanged invariants on the runtime side.
- Adding a new image is a 2-line `config/images.json` change + a `package.json#files` entry.
- Reviewers can answer "what does the nightly image actually contain" by reading `dist-nightly/`.
- The graduation forcing-function (lifecycle validator) operates on a single source of truth (`config/features.json`), separate from runtime code paths.
- Reuses the existing esbuild pipeline (RFC-013) — no new build technology.

### Negative

- Tarball ships N copies of the bundle when N images share an empty (or identical) flag set. v1 with 2 empty images means ~1.4 MB of duplication. NFR-001 caps each directory ≤3 MB; total tarball alarm threshold sits at 10 MB (CHANGELOG only, no hard cap yet).
- Adding a flag whose presence/absence affects the bundle bytes will require esbuild to rebuild per-image (small, predictable cost; bundle is fast).
- `dist/` and `dist-<name>/` need explicit listing in `package.json#files`. Missed entry = missing artifact at install time. Mitigated by build-time assertion that every emitted dir is referenced in `files`.

### Reversibility

This decision is **soft-reversible**. Switching to runtime gating later would require:

- A bundle that reads `forgeplan-web-build.json#features` at startup.
- Code paths gated by `if (features.includes("X"))`.
- Dropping all `dist-*/` directories from `package.json#files` except `dist/`.

The CLI surface (`init --image <name>`, `update --image <name>`, persisted `image` in `forgeplan-web.json`) is identical between build-time and runtime materializations, so users do not see a difference. Reversal cost is mostly in the build pipeline, not in user-visible API.

## Alternatives Considered

### Runtime gating

Already detailed above. Rejected because:

- Every image ships every flag's code, defeating the user's stated mental model of "images contain features".
- Removing a graduated flag from `nightly` doesn't reduce bytes for `stable` users unless the source itself is removed — which is exactly the work we're trying to force via lifecycle. Build-time materialization makes "stripping a graduated flag" a directly visible diff.
- "Reviewer reads `dist-nightly/` to confirm what nightly actually contains" — not possible.

### One npm package per image

Rejected because:

- 2× publish surface, 2× release pipeline, 2× CHANGELOG.
- Cardinality scales poorly: N images = N packages.
- v1 ships one package historically; switching package count is a much bigger user-visible event than adding a CLI flag.

### Single boolean per image (continue `--experimental`-style)

Rejected because:

- Combinatorial: N image flags imply 2^N implicit combinations. The `images.json` registry is a flat list, which is the actual mental model.
- No graduation discipline. `--experimental` has no expiry today.

## Invariants

- `start` is image-agnostic: it spawns `node .forgeplan-web/index.js` regardless of which image was installed. Future changes MUST NOT introduce branching in `start` that depends on the image name.
- The set of directories matching `dist*/` shipped in the npm tarball MUST equal the set of images declared in `config/images.json#images`. Mismatch is a build error.
- `bin/lib/images.mjs` MUST NOT import anything outside the rule 23 allow-list (`node:*` + relative siblings).
- `forgeplan-web.json#image` is sticky on `update`; switching tracks requires `--image <name>` explicitly.

## Preconditions

- esbuild bundle pipeline (RFC-013) is producing usable output with smoke pass on default flag set. (True today.)
- `package.json#files` is editable per release without `npm publish` automation drift. (True today.)

## Postconditions

- `--experimental` is a deprecated alias documented in CHANGELOG and emitting a stderr warning on every invocation.
- `forgeplan-web.json` of every newly-installed scaffold contains an `image` field.

## Rollback Plan

If field validation surfaces a regression in the stable bundle that does not affect the legacy SvelteKit shape:

1. Restore `copyToDist()`, `installRuntimeDeps()`, `emitDistPackageJson()` in `scripts/build.mjs` from this PR's parent commit. Single revert.
2. Restore `dist-experimental/` as opt-in: revert the `--image`/`--experimental` consolidation in `bin/commands/init.mjs` and `update.mjs`.
3. Keep `config/images.json` and `config/features.json` — they are forward-compatible with the legacy shape (the legacy shape is just one more "image" track in waiting).
4. Cut a patch release.

Rollback cost: estimated ≤2 hours; the legacy code paths are deleted in this PR but preserved in git history at the parent commit's SHA.

## Affected Files

- scripts/build.mjs — drops legacy SvelteKit shape, adds image emitter and lifecycle validator.
- bin/commands/init.mjs — `--image`, deprecated `--experimental` alias.
- bin/commands/update.mjs — `--image`, persisted track.
- bin/lib/images.mjs (new) — image name/path helpers.
- bin/lib/config.mjs — `image` field plumbing.
- config/images.json (new) — image registry.
- config/features.json (new) — feature registry.
- config/IMAGES.md (new) — maintainer docs.
- package.json — `files` includes every emitted image dir.
- README.md / README.ru.md — documents `--image` + lifecycle policy.
- CHANGELOG.md — BREAKING CHANGE entry.
- .claude/rules/21-template-purity.md — image-aware language.
- .claude/rules/23-bin-zero-deps.md — note `bin/lib/images.mjs`.
- CLAUDE.md — replaces `dist-experimental/` references with image-aware language.
- scripts/smoke.mjs — extended to run twice (default + nightly).

## Validity / Review

- This ADR is valid through `valid_until: 2027-05-09` (one year).
- Triggers for early re-review:
  - Tarball total size ≥10 MB (then duplication starts to matter).
  - Three or more images share an identical non-empty flag set (then the build-time duplication is wasted).
  - User-reported install latency regression > 30% from current baseline (`init` time on slow link).

## Related Artifacts

- PRD-030 — drives this decision
- RFC-026 — implements this decision
- RFC-013 — historical context (`--experimental` was the prototype of this)
- ADR-001 — `init` host-isolation invariants (image choice does not widen them)
- ADR-003 — citty-only bin allow-list (image dispatch is just `node:fs` + relative siblings)




