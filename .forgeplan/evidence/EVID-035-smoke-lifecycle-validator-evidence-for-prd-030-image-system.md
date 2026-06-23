---
depth: tactical
id: EVID-035
kind: evidence
links:
- target: PRD-030
  relation: informs
- target: RFC-026
  relation: informs
- target: ADR-005
  relation: informs
status: active
title: Smoke + lifecycle-validator evidence for PRD-030 image system
---

# EVID-035: Smoke + lifecycle-validator evidence for PRD-030 image system

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-09 |
| Valid Until | 2027-05-09 |
| Target | PRD-030 / RFC-026 / ADR-005 |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Measurement

Three separate measurements, all run on the implementation branch
`feature/issue-121-feature-flag-images` against the working tree at
the commit immediately before activation:

1. **`npm run build`** with the new pipeline: confirm both `dist/` and
   `dist-nightly/` are emitted, each capped under 3 MB, each with the
   expected per-image `forgeplan-web-build.json`.
2. **`npm run smoke`** (extended): scaffold-init + start + `/api/health`
   + `/api/list` + `GET /` against both images, each in its own scratch
   workspace, with the local `forgeplan-shim` on PATH.
3. **Lifecycle-validator regression** with two synthetic fixtures
   injected into `config/features.json` (originals restored after each
   run): an expired flag and an over-3-minor lifetime flag. Build must
   exit non-zero in both cases.

All three measurements run against the actual surface (the build
script, the bin script, the SvelteKit server) — `evidence_type: test`,
not `measurement`-only. Same context as PRD-030 (this repo, this branch,
this build pipeline), CL3.

## Result

### Measurement 1 — `npm run build` (per-image emission)

```
[build] patched HOST default 0.0.0.0 → 127.0.0.1 in ./.dist-base/index.js (env=Ue)
[build] dist/ ready (1.79M, image=stable, features=0)
[build] dist-nightly/ ready (1.79M, image=nightly, features=0)
[build] done. images built: stable, nightly
```

Manifest spot-check:

```json
// dist/forgeplan-web-build.json
{
  "name": "@forgeplan/web",
  "version": "0.1.13",
  "builtAt": "2026-05-09T10:47:10.937Z",
  "entry": "index.js",
  "image": "stable",
  "features": []
}

// dist-nightly/forgeplan-web-build.json
{
  "name": "@forgeplan/web",
  "version": "0.1.13",
  "builtAt": "2026-05-09T10:47:10.954Z",
  "entry": "index.js",
  "image": "nightly",
  "features": []
}
```

→ **Satisfies SC-1, SC-2, SC-4, AC-5.**

### Measurement 2 — `npm run smoke` (both images, full HTTP path)

```
[smoke] dist/ + dist-nightly/ already built — reusing
[smoke] ==== image: stable ====
[smoke] init -y (run 1)
✓ ready (... image: stable)
[smoke] forgeplan-web.json#image = stable; build manifest image=stable, features=[]
[smoke] gitignore: 1 match (preserved user content)
[smoke] init -y --force (run 2 — must be idempotent)
✓ ready (... image: stable)
[smoke] gitignore: still 1 match after second init (idempotent)
[smoke] start (PORT=15769)
[smoke] server is up
[smoke] /api/health: ok (project=shim)
[smoke] /api/list: ok (0 entries)
[smoke] GET /: ok (HTML returned)
[smoke] PASS (image=stable)

[smoke] ==== image: nightly ====
[smoke] init -y --image nightly (run 1)
⚠ Using image "nightly" (non-stable). Behaviour may change between releases.
✓ ready (... image: nightly)
[smoke] forgeplan-web.json#image = nightly; build manifest image=nightly, features=[]
[smoke] gitignore: 1 match (preserved user content)
[smoke] init -y --image nightly --force (run 2 — must be idempotent)
✓ ready (... image: nightly)
[smoke] gitignore: still 1 match after second init (idempotent)
[smoke] start (PORT=15717)
[smoke] server is up
[smoke] /api/health: ok (project=shim)
[smoke] /api/list: ok (0 entries)
[smoke] GET /: ok (HTML returned)
[smoke] PASS (image=nightly)

[smoke] ALL IMAGES PASS
```

Smoke harness asserts (per image):

- `.forgeplan-web/index.js` exists.
- `.forgeplan-web/node_modules/` does **not** exist (bundle shape, not legacy).
- `forgeplan-web.json#image` matches the requested image.
- `forgeplan-web-build.json#image` matches.
- `forgeplan-web-build.json#features` is an array.
- `.gitignore` contains exactly one `.forgeplan-web/` entry across two
  `init` invocations (idempotency).
- All three HTTP endpoints return 200 + envelope `{ ok: true, ... }`.

→ **Satisfies SC-1, SC-2, SC-6, AC-1, AC-2, NFR-002.**

### Measurement 3 — `--experimental` deprecation alias

Manual scratch-dir run:

```
$ node bin/forgeplan-web.mjs init -y --experimental --force
forgeplan-web: warning: --experimental is deprecated and will be removed in 0.3.0; use --image nightly instead.
⚠ Using image "nightly" (non-stable). Behaviour may change between releases.
→ creating /tmp/.../.forgeplan-web
→ created .gitignore (added .forgeplan-web/)

✓ ready (scope: project — /tmp/.../.forgeplan-web, image: nightly)

$ jq -r '.image' .forgeplan-web/forgeplan-web.json
nightly

$ jq -r '.image' .forgeplan-web/forgeplan-web-build.json
nightly
```

→ **Satisfies SC-3, AC-3, FR-005, FR-006.**

### Measurement 4 — lifecycle validator (expired + over-3-minor)

Synthetic fixtures injected into `config/features.json` then reverted:

```
# Fixture: expiresIn (0.1.5) ≤ currentVersion (0.1.13)
[build] config error: config/features.json: feature "synthetic-expired-flag" \
  expired (expiresIn=0.1.5, currentVersion=0.1.13); remove from features.json \
  + every image's features array
exit 1

# Fixture: lifetime 0.5.0-0.1.0 > 3 minor
[build] config error: config/features.json: feature "synthetic-too-long-lived" \
  lifetime 0.5.0-0.1.0 exceeds 3 minor versions; graduate or drop it \
  (rule: PRD-030 NFR-005)
exit 1
```

Both produce a single descriptive stderr line and a non-zero exit.

→ **Satisfies SC-5, AC-4, NFR-005.**

## Reproduction

From the repo root, on `feature/issue-121-feature-flag-images`:

```bash
npm run build      # measurement 1
npm run smoke      # measurement 2
# measurement 3:
SCRATCH=$(mktemp -d) && mkdir -p "$SCRATCH/.forgeplan" && \
  SHIM=$(mktemp -d) && \
  printf '#!/usr/bin/env sh\nexec %s %s "$@"\n' "$(which node)" \
    "$PWD/scripts/test/forgeplan-shim.mjs" > "$SHIM/forgeplan" && \
  chmod +x "$SHIM/forgeplan" && \
  cd "$SCRATCH" && \
  PATH="$SHIM:$PATH" node "$OLDPWD/bin/forgeplan-web.mjs" init -y --experimental --force
# measurement 4:
# Manually inject a synthetic flag with expiresIn ≤ package.json#version into
# config/features.json then run `node scripts/build.mjs`.
```

## Implication

PRD-030's success criteria SC-1..SC-6 are all satisfied by direct test
against the actual build + bin + server surface. The image-as-build-
artifact decision (ADR-005) holds — `start` remained image-agnostic and
required no changes; bin script picked up the right directory via
`bin/lib/images.mjs#imagePath`. Lifecycle validator forces the user-
required ≤3-minor cap mechanically. The legacy `dist/`-with-
`node_modules/` shape is gone from the published tarball without any
change to the user-visible install UX.

→ Score should advance the chain to `R_eff > 0` and unblock activation
of PRD-030, RFC-026, ADR-005.




