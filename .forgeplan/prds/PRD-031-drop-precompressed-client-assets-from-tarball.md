---
depth: standard
id: PRD-031
kind: prd
last_modified_at: 2026-05-09T11:34:37.535120+00:00
last_modified_by: claude-code/2.1.138
links:
- target: PRD-014
  relation: based_on
- target: PRD-030
  relation: based_on
status: active
title: Drop precompressed client assets from tarball
---

---
id: PRD-031
title: "Drop precompressed client assets from tarball"
status: Draft
author: fedorovvvv
created: 2026-05-09
updated: 2026-05-09
priority: P2
depth: standard
domain: general
projectType: cli_tool
stepsCompleted: []
---

# PRD-031: Drop precompressed client assets from tarball

## Progress

```
Phase 0  ████████████████████████  1/1  (100%)
─────────────────────────────────────────────────
TOTAL                              1/1  (100%)
```

---

## Executive Summary

### Vision

Ship a smaller `@forgeplan/web` tarball by removing 84 precompressed
`*.br` / `*.gz` client siblings emitted by `@sveltejs/adapter-node` —
saving ~520K per `dist*/` artifact (~29% of the experimental tarball)
without measurably degrading the local-first user experience.

### Problem

`@sveltejs/adapter-node` defaults to `precompress: true`, so every
`dist*/client/` carries 21 `.br` + 21 `.gz` files alongside the
originals (~520K). The tarball ships **two** images (`dist/` for
`stable`, `dist-nightly/` for `nightly`), so users pay the cost twice
on every `npm install` / `npx` invocation.

The runtime CPU savings precompressed assets buy (sirv serving the
cached `.br`/`.gz` directly) are negligible for the canonical
deployment shape: `npx @forgeplan/web start` on `127.0.0.1` for one
local user, behind no CDN. Every user pays the install cost; almost
nobody benefits from the runtime saving.

**Impact**: ~520K × 2 dists = ~1.04 MB of dead weight on every
install. After PR #117 minified the server bundle (1.4 MB → 683 KB),
precompressed client assets are now the largest fixed cost in
`dist-nightly/`.

### Target Users

| Persona | Описание | Ключевая боль |
|---------|----------|---------------|
| Local-first user | Runs `npx @forgeplan/web start` on `127.0.0.1` | Pays install cost (tarball download + extraction) for runtime savings they will never measure |
| CI runner | Installs `@forgeplan/web` in throwaway environments | Slower cold installs because of inflated tarball |

### Differentiators

- Single-flag adapter change (Option A from issue #120) — minimal
  blast radius, fully reversible by flipping `precompress` back to
  `true`.
- Aligned with `npx @forgeplan/web` philosophy: the package is
  optimized for fast first-run on a developer machine, not for
  high-throughput public-facing serving.

---

## Success Criteria

| ID | Criterion | Metric | Current | Target | Timeframe | How to Measure |
|----|-----------|--------|---------|--------|-----------|----------------|
| SC-1 | Precompressed siblings absent from both shipped images | count of `*.br` + `*.gz` under `dist/client/` ∪ `dist-nightly/client/` after `npm run build` | 84 | 0 | This PR | `find dist dist-nightly -name '*.br' -o -name '*.gz' \| wc -l` |
| SC-2 | Each tarball image stays under PRD-014 SC-1 cap | `du -sh dist*/` | 2.0M each | ≤ 1.5M each (target) / ≤ 3M (cap) | This PR | `du -sh dist dist-nightly` |
| SC-3 | `start` still serves usable HTML | HTTP status of `GET /` after `npx @forgeplan/web start` | 200 | 200 | This PR | scratch-dir manual probe (see EVID) |
| SC-4 | `/api/health` still returns `ok` | endpoint response | `{ ok: true }` | `{ ok: true }` | This PR | manual probe |
| SC-5 | No regression in `npm run smoke` | smoke exit code | 0 | 0 | This PR | `npm run smoke` |

---

## Product Scope

### MVP (In-Scope)

- Pass `precompress: false` to `adapter()` in `template/svelte.config.js`.
- Re-build both images (`dist/` + `dist-nightly/`) and verify the
  precompressed siblings are gone.
- Smoke test the bin script against a scratch dir end-to-end.
- Document the trade-off (no precompressed cache; sirv now serves
  uncompressed or compresses on-the-fly per `Accept-Encoding`).

### Out of Scope

- Lowering `DIST_*_MAX_BYTES` cap in `scripts/build.mjs` — separate
  decision (PRD candidate).
- RFC-013 graduation / legacy `dist/` removal — owned by PRD-014.
- Adding a custom sirv compression middleware to recover the runtime
  saving — only if a measured regression appears.

### Growth Vision

- If real users complain about uncompressed first-load wire size
  over slow networks, revisit by either (a) flipping `precompress`
  back on, or (b) wiring an on-the-fly compression middleware in
  `template/src/hooks.server.ts`.

---

## User Journeys

### Journey 1: Local-first user installs and starts

**Цель пользователя**: Spin up the Forgeplan web viewer in a working repo.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | `npx @forgeplan/web init -y` | Copies `dist/` (~1.5 MB target) into `.forgeplan-web/` | Smaller download than today |
| 2 | `npx @forgeplan/web start` | Spawns node, listens on `127.0.0.1:5174` | No precompressed cache hit on assets |
| 3 | Opens `http://127.0.0.1:5174` | Browser receives HTML; CSS/JS load | sirv serves assets uncompressed or via on-the-fly gzip per `Accept-Encoding` (TBD by smoke) |

**Результат**: Same UX, smaller install footprint.

### Journey 2: CI runner does throwaway install

**Цель пользователя**: Validate Forgeplan integration in CI.

| Шаг | Действие пользователя | Ответ системы | Заметки |
|-----|----------------------|---------------|---------|
| 1 | `npm i -g @forgeplan/web@latest` | Pulls smaller tarball, faster cold install | Saves ~1 MB per cold install across both images |
| 2 | `forgeplan-web --version` | Prints version | Unaffected by this change |

**Результат**: Faster CI cold start, no functional change.

---

## Functional Requirements

| ID | Category | Priority | Requirement | Journey |
|----|----------|----------|-------------|---------|
| FR-001 | Build | Must | Build pipeline can emit `dist*/client/` directories with no `*.br` and no `*.gz` siblings | Journey 1, Journey 2 |
| FR-002 | Runtime | Must | `start` command can serve an HTTP 200 on `GET /` and `/api/health` from a freshly initialised `.forgeplan-web/` that contains no precompressed siblings | Journey 1 |
| FR-003 | Runtime | Should | Browser can render a usable page (CSS + JS load successfully) when the static-asset middleware has no precompressed siblings to fall back to | Journey 1 |

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Condition | Measurement |
|----|----------|-------------|--------|-----------|-------------|
| NFR-001 | Size | System shall emit each `dist*/` artifact below the existing cap | ≤ 3 MB | After `npm run build` for both `stable` and `nightly` images | `du -sh dist dist-nightly` + `scripts/build.mjs` cap assertion |
| NFR-002 | Reversibility | System shall allow restoring precompressed assets by flipping a single boolean | 1 line in `template/svelte.config.js` | Forever | Diff inspection |
| NFR-003 | Compatibility | System shall not regress `npm run smoke` exit code | exit code = 0 | Local + CI matrix (ubuntu/macos/windows) | `npm run smoke` |

---

## Risks & Mitigations

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-1 | Without precompressed siblings, sirv serves assets uncompressed → +700 KB first-load wire traffic for users on slow links | Medium | Low (local-first deployments dominate) | Document in README + this PRD; if real complaints surface, add an on-the-fly gzip middleware in `template/src/hooks.server.ts` or revert to `precompress: true` | fedorovvvv |
| R-2 | A future custom hook in `template/` assumes `.br`/`.gz` siblings exist | Low | Medium | Grep template for `\.br` / `\.gz` references in this PR; none found at time of writing | fedorovvvv |
| R-3 | Adapter-node behavior changes in a future major version, making `precompress: false` ineffective | Low | Low | Pinned via `template/package.json#dependencies`; bump-with-test is the existing process | fedorovvvv |

---

## Affected Files

- `template/svelte.config.js` — flip `adapter()` → `adapter({ precompress: false })`.
- `dist/`, `dist-nightly/` — regenerated by `npm run build` (no source-controlled change beyond the regenerated bundles).

## Related Artifacts

| Artifact | Relation | Status |
|----------|----------|--------|
| PRD-014 | parent (tarball-size cap SC-1) | active |
| PRD-030 | parent (dual-image pipeline `stable` + `nightly`) | active |
| PR #117 | predecessor (server bundle minify, 1.4 MB → 683 KB) | merged |
| Issue #120 | source | open (this PRD closes it) |

---

> **Decision recorded (closes issue #120 acceptance criterion 1)**:
> Option A — disable precompress at the adapter level. Rejected:
> Option B (build.mjs strip — strictly more code for the same runtime
> behaviour) and Option C (keep `.br` only — half the size win for
> ~zero additional safety, since a sirv fallback regression would still
> need investigation).




