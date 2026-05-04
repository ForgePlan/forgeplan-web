---
created: 2026-05-04
depth: tactical
id: EVID-002
kind: evidence
links:
- target: RFC-001
  relation: informs
status: active
title: tarball trim (--omit=peer + sourcemap strip) + cross-platform smoke script + GH Actions matrix
---

# EVID-002: tarball trim + cross-platform smoke

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-04 |
| Valid Until | 2026-08-04 |
| Target | RFC-001 (follow-ups TODO(size) + TODO(matrix) from EVID-001) |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Measurement

Two follow-ups from EVID-001 implemented and measured against the same flow:

1. **Tarball trim**:
   - `template/vite.config.ts` — `build.sourcemap: false` (no SvelteKit-emitted maps).
   - `scripts/build.mjs` — defensive `stripSourceMaps(dist)` walks `dist/` and `dist/node_modules/`, removing `*.map` files and `//# sourceMappingURL=...` references.
   - `scripts/build.mjs` — install switched to `npm install --omit=dev --omit=peer`. Root cause: `@sveltejs/kit` declares `vite`, `@sveltejs/vite-plugin-svelte`, etc. as **peerDependencies**. npm 7+ auto-installs peer deps; `--omit=peer` opts out. The runtime server doesn't import any of those (verified by static scan of `dist/*.js` bare specifiers).

2. **Cross-platform smoke**:
   - `scripts/test/forgeplan-shim.mjs` — minimal Node stub that responds to `--version` + `health|list|graph|order|...|tree --json`. No real forgeplan binary needed in CI.
   - `scripts/smoke.mjs` — orchestrator: ensures `dist/` built, installs shim into `$tmp/shim/forgeplan` (or `forgeplan.cmd` on win32), prepends to `PATH`, runs `init -y` then `start`, polls `/api/health` until 200, asserts `/api/list` and `/` also 200.
   - `.github/workflows/smoke.yml` — matrix over `ubuntu-latest`, `macos-latest`, `windows-latest` × Node 22. Steps: checkout → setup-node (with npm cache on `template/package-lock.json`) → `node scripts/build.mjs` → `npm pack --dry-run` → `node scripts/smoke.mjs`.

## Result

| Metric | Before (EVID-001) | After |
|--------|-------------------|-------|
| `dist/` total | 45 MB | **11 MB** (-76%) |
| Tarball compressed | 15.3 MB | **2.0 MB** (-87%) |
| Tarball unpacked | 41.5 MB | **7.5 MB** (-82%) |
| Files in tarball | 1823 | 1404 |
| `dist/node_modules` packages | 60 | **41** (vite + lightningcss + rolldown + postcss removed) |

Local smoke (`node scripts/smoke.mjs` on darwin-arm64):

```
[smoke] dist/ already built — reusing
[smoke] scratch: /var/folders/.../fpw-smoke-9nDyYp
[smoke] init -y
→ creating .../.forgeplan-web

✓ ready (no install needed)
[smoke] start (PORT=15786)
Listening on http://127.0.0.1:15786
[smoke] server is up
[smoke] /api/health: ok (project=shim)
[smoke] /api/list: ok (0 entries)
[smoke] GET /: ok (HTML returned)
[smoke] PASS
```

`project=shim` confirms the forgeplan-shim is being resolved via the
`$tmp/shim/` path prepended to `PATH`, not a real forgeplan binary.

## Interpretation

- Tarball trimming validated. The 87% reduction comes from skipping
  `@sveltejs/kit`'s peer deps (vite + native bundler binaries) which the
  built server never imports. The post-build `stripSourceMaps` walk
  contributes a smaller portion (~600 KB across 89 vendor `.map` files +
  the SvelteKit-emitted maps that were already disabled at the vite layer).
- Cross-platform smoke harness ready. CI workflow runs on every push/PR
  to `main`/`develop`. Windows path-handling is covered by the `.cmd`
  shim wrapper in `scripts/smoke.mjs` (`process.platform === 'win32'`
  branch). Cache key is `template/package-lock.json` since `dist/` is
  generated and root has no deps.
- Follow-up TODOs from EVID-001 are now resolved.

Open follow-ups (not blockers, not committed-to):
- TODO(realbinary): once forgeplan ships official prebuilt binaries with
  a stable install path, swap the shim for the real binary in CI for
  end-to-end coverage of every `/api/*` endpoint.
- TODO(npm-publish): add a `release.yml` workflow that publishes on tag
  push (with `--access public`).

## Congruence Level Justification

CL3 — same-context: every measurement (`du -sh dist`, `npm pack
--dry-run`, smoke output) is taken against the exact `bin/`, `dist/`,
and `scripts/` artifacts the published package will ship. The CI matrix
exercises the same `scripts/smoke.mjs` that ran locally. Penalty 0.0.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-001  | informs  |
| EVID-001 | extends  |


