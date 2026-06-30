---
depth: standard
id: EVID-017
kind: evidence
last_modified_at: 2026-05-06T16:58:57.023400+00:00
last_modified_by: claude-code/2.1.131
links:
- target: PRD-013
  relation: informs
- target: RFC-012
  relation: informs
status: active
title: smoke + svelte-check + live endpoint probe for shared UI + update checker
---

# EVID-017: smoke + svelte-check + live endpoint probe for shared UI + update checker

| Field       | Value                  |
| ----------- | ---------------------- |
| Status      | Draft                  |
| Created     | 2026-05-06             |
| Valid Until | 2026-08-06             |
| Target      | PRD-013 / RFC-012      |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Measurement

Three direct probes against the surface introduced by PRD-013 / RFC-012:

1. `cd template && npm run check` — `svelte-kit sync` followed by
   `svelte-check --tsconfig ./tsconfig.json`. Exercises every `.svelte`,
   `.svelte.ts`, and `.ts` file under `template/src/` (including the new
   `shared/ui/`, `shared/services/modal/`, and version-footer additions)
   for type errors and a11y warnings.
2. `npm run smoke` at the repo root — rebuilds `dist/` from scratch
   (`scripts/build.mjs --clean`), `init -y` against a scratch dir, then
   `init -y --force`, then boots `node dist/index.js`, and probes
   `/api/health`, `/api/list`, `/`. This is the same smoke harness
   already used to gate releases.
3. Live spawn of the freshly built `dist/index.js` on PORT=15999 with
   FORGEPLAN_CWD=/tmp + curl against the new endpoint.

## Result

```
$ npm run check          # in template/
COMPLETED 462 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS

$ npm run smoke          # at root
[smoke] /api/health: ok (project=shim)
[smoke] /api/list: ok (0 entries)
[smoke] GET /: ok (HTML returned)
[smoke] PASS

$ curl -s http://127.0.0.1:15999/api/update-check
{"ok":true,"data":{"current":"0.1.11","latest":"0.1.11","hasUpdate":false},
 "cmd":"GET registry.npmjs.org/@forgeplan/web/latest"}

$ curl -s http://127.0.0.1:15999/api/version
{"ok":true,"data":{"web":"0.1.11","cli":"0.27.0"},"cmd":"forgeplan --version"}
```

Vite build also reports `entries/endpoints/api/update-check/_server.ts.js
1.78 kB │ gzip: 0.83 kB`, confirming the new endpoint is bundled into
`dist/`.

## Interpretation

- **PRD-013 SC-1** (primitives exist + 1 widget imports): satisfied —
  `template/src/widgets/version-footer/ui/UpdateDialog.svelte` imports
  `Button`, `Code`, `Dialog` from `@/shared/ui`.
- **PRD-013 SC-2** (caller line count ≤ 3 lines to open a dialog): met
  by the `modalManager.open(UpdateDialog, { current, latest })` call
  inside `VersionFooter.svelte`.
- **PRD-013 SC-3** (update notice within ≤ 30 min of npm publish):
  meets the upper bound by `THIRTY_MINUTES_MS` poll interval +
  immediate `start()` on mount; live probe confirms the endpoint is
  reachable and returns a well-formed envelope.
- **PRD-013 SC-4** (dialog renders manual update command): rendered by
  `UpdateDialog.svelte` via `<Code code="npx @forgeplan/web update" />`.
- **PRD-013 SC-5** (endpoint is GET-only, respects rule 22): the only
  HTTP method exported is `GET`; no `spawn` or `runForgeplan` is called
  from `update-check/+server.ts`; URL is a string literal.
- **NFR-002** (endpoint never throws on registry failure): try/catch
  wraps `getLatestCached`; failure path returns `{ ok: false, ...,
  hasUpdate: false }`. Live probe with reachable registry returns the
  success path; failure path is exercised structurally.
- **NFR-004** (zero new runtime deps): `git diff develop --
  template/package.json` shows no change in `dependencies`.

The svelte-check pass over 462 files (up from 460 — the two new
modules) with zero errors and zero warnings means the new types
(ModalEntry, UpdateData, compareSemver) compose cleanly with existing
code. The smoke pass means `init` + `start` still work end-to-end after
the addition. The live curl proves the endpoint is wired.

## Congruence Level Justification

CL3 — the measurement is run against the exact files PRD-013 and
RFC-012 prescribe (same surface, same project, same commit). The smoke
test exercises the full ship-path (`bin/forgeplan-web.mjs init` →
`node dist/index.js` boot), and the curl probes the new endpoint by
its actual URL. evidence_type=test (binary pass/fail) +
verdict=supports (every assertion held).

## Related Artifacts

| Artifact | Relation |
| -------- | -------- |
| PRD-013  | informs  |
| RFC-012  | informs  |



