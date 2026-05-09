# Images & feature flags — maintainer guide

This directory is the source of truth for the multi-image build pipeline
introduced by PRD-030 / RFC-026 / ADR-005. The build script
(`scripts/build.mjs`) reads these files; the bin script reads the
materialised `forgeplan-web-build.json` inside each emitted `dist*/`
directory.

## Files

| File | Role |
|---|---|
| `images.json` | Image registry. Maps image name → `{ description, features: [<flag-id>] }`. Each `name` in `images.json#images` becomes one emitted directory: `stable` → `dist/`, every other → `dist-<name>/`. |
| `features.json` | Feature-flag registry. Each entry: `{ id, description, addedIn, expiresIn, owner, rollout }`. The build pipeline cross-references this with `images.json`. |

There is intentionally **no schema file** committed yet — the validator
in `scripts/build.mjs` is the runtime contract; if a schema is later
generated, it should be a sibling next to these JSON files.

## Adding a new image

1. Add an entry to `config/images.json#images.<name>`. Pick a kebab-case
   name (validated by `bin/lib/images.mjs#isValidImageName`).
2. Add the directory to `package.json#files`:
   ```json
   "files": ["bin", "dist", "dist-nightly", "dist-<your-image>", "README.md", ...]
   ```
3. Run `npm run build` — the validator asserts every `dist*/` it emits is
   listed in `package.json#files`. Build fails fast if you forgot.
4. Update README.md / README.ru.md to mention the new image (the user-
   facing flag is `--image <your-image>`).

## Adding a new feature flag

1. Add an entry to `config/features.json#features`:
   ```json
   {
     "id": "kebab-case-id",
     "description": "One sentence.",
     "addedIn": "0.2.0",
     "expiresIn": "0.4.0",
     "owner": "<github-handle or team>",
     "rollout": "alpha"
   }
   ```
2. Add the flag's `id` to the `features` arrays of every image that
   should ship it (typically `nightly` first, then `stable` after
   graduation).
3. The flag itself must be implemented in `template/` and gated by
   reading `forgeplan-web-build.json#features` at runtime. The build
   pipeline does not enforce this — it only manages metadata.

## Lifecycle policy

A flag's `expiresIn` MUST be at most three minor versions past
`addedIn`. The validator in `scripts/build.mjs` enforces:

- `addedIn` is a valid semver and `expiresIn > addedIn`.
- `expiresIn ≤ addedIn + 3 minor` (major bumps reset the clock).
- `package.json#version < expiresIn` (strict). When `>=`, the build
  fails until the flag is either removed or graduated.

"Graduating" a flag means: pick one of two paths.

1. **Promote** — if the flag is now part of the default behaviour:
   remove it from `features.json`, remove all gating in `template/`,
   delete the flag id from every image's `features` array. The
   behaviour is now unconditional.
2. **Drop** — if the flag did not pan out: remove it from
   `features.json`, remove all gating in `template/`, delete the flag
   id from every image's `features` array. The behaviour is gone.

A flag MUST NOT be silently extended past `expiresIn`. Bumping
`expiresIn` is allowed only with an updating Forgeplan artifact (PRD or
RFC) explaining why graduation is being delayed.

## Image rollout taxonomy

| `rollout` | Eligible images | Meaning |
|---|---|---|
| `alpha` | `nightly` only | Active development; behaviour can change between releases. |
| `beta` | `nightly` only | Stable interface; hardening period. |
| `stable` | `stable` and `nightly` | Generally available. Once a flag reaches `stable`, it should graduate within one more minor version. |

The validator currently does not enforce the `rollout → eligible image`
mapping (it would be over-prescriptive in v1). When in doubt, follow
the table.

## Why a registry, not a series of booleans

PRD-030 §"Differentiators" and ADR-005 cover this in depth. Short
version: a registry keeps the lifecycle data in one place, makes
"what's in nightly?" a question with a one-file answer, and lets the
build pipeline mechanically enforce graduation.
