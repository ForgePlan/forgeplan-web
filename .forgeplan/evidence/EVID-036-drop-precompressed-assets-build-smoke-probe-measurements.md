---
depth: standard
id: EVID-036
kind: evidence
last_modified_at: 2026-05-09T11:38:56.840360+00:00
last_modified_by: claude-code/2.1.138
links:
- target: PRD-031
  relation: informs
status: active
title: Drop precompressed assets — build/smoke/probe measurements
---

# EVID-036: Drop precompressed assets — build/smoke/probe measurements

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-09 |
| Valid Until | 2026-08-09 |
| Target | PRD-031 |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Measurement

Built `@forgeplan/web` after flipping `template/svelte.config.js` from
`adapter()` to `adapter({ precompress: false })`. Measured against
PRD-031 SC-1 / SC-2 / SC-3 / SC-4 / SC-5 directly on the post-build
`dist/` and `dist-nightly/` directories and on a live server spawned
from a scratch `init`. All commands executed in
`/Users/nikitafedorov/Desktop/Projects/forgeplan-web` on
`darwin 25.4.0` against the same `develop` branch the change was made on.

Commands:

```bash
# SC-1: precompressed sibling count
find dist dist-nightly -name '*.br' -o -name '*.gz' | wc -l

# SC-2: per-image size
du -sh dist dist-nightly

# SC-3 + SC-4: live server probe
SCRATCH=$(mktemp -d) && cd "$SCRATCH" && mkdir -p .forgeplan
node /…/bin/forgeplan-web.mjs init -y --image nightly
PORT=15998 node .forgeplan-web/index.js &
curl -sI http://127.0.0.1:15998/_app/immutable/entry/app.DvKYkSiM.js
curl -sI -H 'Accept-Encoding: br, gzip' \
     http://127.0.0.1:15998/_app/immutable/entry/app.DvKYkSiM.js
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:15998/

# SC-5: smoke
npm run smoke
```

## Result

| SC  | Metric | Before | After | Pass? |
|-----|--------|--------|-------|-------|
| SC-1 | precompressed siblings (`*.br` + `*.gz` under both `dist*/client/`) | 84 | **0** | ✅ |
| SC-2 | `du -sh dist` | 2.0M | **1.5M** (-25%) | ✅ (< 3M cap) |
| SC-2 | `du -sh dist-nightly` | 2.0M | **1.5M** (-25%) | ✅ (< 3M cap) |
| SC-3 | `GET /` HTTP status (live server, scratch dir) | 200 | **200** | ✅ |
| SC-4 | `/api/health` returns `ok` (smoke run) | ok | **ok** (project=shim) | ✅ |
| SC-5 | `npm run smoke` exit code | 0 | **0** (`ALL IMAGES PASS`) | ✅ |

`scripts/build.mjs` post-build report after the change:

```
[build] dist/ ready (1.40M, image=stable, features=0)
[build] dist-nightly/ ready (1.40M, image=nightly, features=0)
[build] done. images built: stable, nightly
```

Asset-compression probe (3047-byte `app.DvKYkSiM.js`):

```
--- without Accept-Encoding ---
HTTP/1.1 200 OK
Content-Length: 3047
--- with Accept-Encoding: br, gzip ---
HTTP/1.1 200 OK
Content-Length: 3047
```

→ Sirv (adapter-node's static layer) serves uncompressed bytes when
precompressed siblings are absent. There is **no** `Content-Encoding`
header in either response. PRD-031 R-1 ("uncompressed first-load wire
traffic") is therefore real, not just theoretical — but it lands on a
loopback `127.0.0.1` connection in the canonical deployment, where the
cost is negligible.

## Interpretation

Option A from issue #120 (disable `precompress` at adapter level) is
implemented and verified end-to-end. All five PRD-031 success criteria
pass on the first build. Tarball saving is ~520K per image (~1.04 MB
total across both images) — exactly the figure forecast in the issue
body. Live server still serves `GET /` HTTP 200 from a freshly
initialised scratch dir; smoke matrix passes with `ALL IMAGES PASS`.

The compression-probe result confirms the documented trade-off (R-1):
sirv does NOT compress on-the-fly; clients receive uncompressed bytes.
For local-first deployments (`127.0.0.1`, single user) this is
negligible. If a future user reports slow first-load over a slow
network, the mitigation path is documented in PRD-031 (flip
`precompress` back to `true`, or wire an on-the-fly compression
middleware in `template/src/hooks.server.ts`).

This evidence supports activating PRD-031 with `R_eff > 0`.

## Congruence Level Justification

CL3 (same context, penalty 0.0): the measurement was executed against
the exact build artifacts (`dist/`, `dist-nightly/`) and the exact bin
script (`bin/forgeplan-web.mjs init … && node .forgeplan-web/index.js`)
that PRD-031 governs, on the same `develop` branch the change was
landed on. No proxy environment, no benchmark surrogate, no cached
result — direct measurement on the surface the PRD describes.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-031 | informs |


