---
created: 2026-05-04
depth: tactical
id: EVID-001
kind: evidence
links:
- target: RFC-001
  relation: informs
status: active
title: 'smoke test: dist/ scaffolded into scratch dir, server starts, /api/health returns 200'
---

# EVID-001: smoke test: dist/ scaffolded into scratch dir, server starts, /api/health returns 200

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-04 |
| Valid Until | 2026-08-04 |
| Target | RFC-001 |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Measurement

End-to-end smoke test of the new publication pipeline (`@forgeplan/web` → `dist/` → `init` → `start`):

1. `node scripts/build.mjs` from a clean `template/` (npm install + vite build + emit dist/package.json + npm install --omit=dev inside template/build → cp to dist/).
2. Created scratch directory `/var/folders/.../fpw-smoke-XXXX.RR0XmRzb0F`, ran `forgeplan init -y` to materialise `.forgeplan/`.
3. `node bin/forgeplan-web.mjs init -y` against the scratch dir (no `--force`, no `--no-install`).
4. Inspected scratch root: only `.forgeplan/` and `.forgeplan-web/` present (rule 20 — host isolation — holds).
5. `PORT=15681 node bin/forgeplan-web.mjs start` → server listens.
6. `curl http://127.0.0.1:15681/api/health`, `/api/list`, `/`.

Verifications also run on root:
- bin imports introspected via JS — only `node:child_process`, `node:fs`, `node:path`, `node:url` (rule 23 — bin zero-dep — holds).
- root `package.json#dependencies` empty (rule 23 verification command).
- `npm pack --dry-run` lists `bin/`, `dist/`, `README.md`, `package.json` only.

## Result

- Build pipeline: `dist/` is 45 MB (template/build/ copy + node_modules with `--omit=dev`, 60 packages).
- Tarball: 15.3 MB compressed, 41.5 MB unpacked, 1823 files. Source-maps account for ≈10 MB and could be stripped later.
- `init -y`: copied `dist/` into `.forgeplan-web/` and wrote `forgeplan-web.json` with `workspaceRoot`. **No `npm install` ran at user side.**
- `start`: spawned `node .forgeplan-web/index.js`, server logged `Listening on http://127.0.0.1:15681`.
- `GET /api/health` → 200, JSON `{"ok":true,"data":{...,"project":"fpw-smoke-XXXX.RR0XmRzb0F","total":0,...},"cmd":"forgeplan health --json"}`.
- `GET /api/list` → 200, JSON `{"ok":true,"data":[],"cmd":"forgeplan list --json"}`.
- `GET /` → 200, 3899 bytes HTML (SvelteKit page).
- Host isolation: scratch root listing contained exactly `.forgeplan/` and `.forgeplan-web/` after init.
- Rule-23 grep: zero third-party imports in `bin/forgeplan-web.mjs`.

## Interpretation

The new flow `npx @forgeplan/web init -y` → `npx @forgeplan/web start` works without any `npm install` at user side, on a freshly-init'd Forgeplan workspace, with all read-only proxy endpoints responding correctly. The chosen direction in RFC-001 (Option B: pre-built `dist/` with bundled `node_modules/`) is validated for the macOS-darwin path. Rules 20, 21, 22, 23 remain enforceable.

Open follow-ups (not blockers):
- TODO(size): strip `.map` files in `dist/` to drop tarball ≈30%.
- TODO(matrix): repeat smoke test on linux + windows runners before publish (cross-platform binary deps in transitive d3/svelte chains, currently none observed).

## Congruence Level Justification

CL3 — same-context: the test runs the exact `bin/` and `dist/` artifacts the published package will ship, in the exact `init`/`start` flow described in the RFC. No proxies, no mocks. Penalty 0.0.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-001 | informs |


