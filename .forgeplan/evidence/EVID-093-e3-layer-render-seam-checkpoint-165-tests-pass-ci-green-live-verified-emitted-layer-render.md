---
depth: standard
id: EVID-093
kind: evidence
last_modified_at: 2026-07-06T11:15:09.932180+00:00
last_modified_by: claude-code/2.1.201
links:
- target: RFC-032
  relation: informs
status: active
title: 'E3 layer-render seam checkpoint: 165 tests PASS + CI green + live-verified emitted-layer render'
---

## Status

draft

## Summary

Prove-phase checkpoint for **RFC-032** (E3 prefer-emitted layer-render seam, PRD-038 Pillar-A
FR-002/FR-003). The seam is implemented and green: on descend into a top-level zone the composed-map
prefers a map-pack-emitted per-zone layer (`.forgeplan/map/layers/<zone>.json`) via a new read-only
`GET /api/map/layers/<zone>` mirror, validates it client-side, and renders it through the unchanged
`computeComposedLayout`; an absent/invalid layer falls back silently to the RFC-031 `deriveSubDocument`
un-hide. This EVID records the test + CI + live-render observations that back RFC-032 activation.

## Observations

### Automated tests (measured locally, 2026-07-06)

`npx vitest run` over the E3 seam + drill-down surface — **13 test files, 165 tests, ALL PASS**
(4.23s, vitest v4.1.5, `pool: "threads"`):

- `src/shared/server/map.test.ts` — `readMapLayerFile(zone)`: present → verbatim mirror; ENOENT →
  `{ ok:true, data:{} }`; unreadable/malformed → `{ ok:false, error }`; path stays inside the layers
  dir (traversal defence).
- `src/widgets/composed-map/model/level-documents.test.ts` — `buildLevelDocuments` / prefer-emitted
  seam (`present` layer beats derived fallback; `absent`/`invalid` → derived).
- `src/entities/map/lib/edge-rollup.test.ts` — C4 rollup onto collapsed megas (dedup key, self-loop
  drop, `rollup_count`, `liftIds`).
- `src/entities/map/lib/roomy-canvas.test.ts` — adaptive gap scaling.
- `src/widgets/composed-map/model/node-tabs.test.ts` — node-detail tab snapshot store.
- `src/widgets/artifact-panel/ui/MapNodePanel.render.test.ts` — node-detail panel (honest
  no-narration + auto-Connections).
- Supporting drill-down: `derive-subdocument.test.ts`, `composed-layout.test.ts`, `drill-state.test.ts`,
  `hit-test.test.ts`, `nav-contract.render.test.ts`, `LevelBreadcrumb.render.test.ts`.

### CI (measured, run 28777927150)

PR #165 green on all three matrix legs: `ubuntu-latest / node 22` PASS, `macos-latest / node 22`
PASS, `windows-latest / node 22` PASS. `mergeStateStatus: CLEAN`, not draft.

### Live render (manual, dev server :5179, real map-pack v0.7.1 map)

Descend into `z.decisions` → the client fetches `/api/map/layers/z.decisions` → renders the
**emitted** layer (8 program-arc sub-zones / 194 nodes / 11 decision-trail flows), NOT the
client-derived fallback — the distinguishing-fixture outcome RFC-032 AC-1 requires. Descend into a
zone with no emitted layer → RFC-031 `deriveSubDocument` fallback renders (never a dead-end).

### Rule-22 read-only compliance

`routes/api/map/layers/[zone]/+server.ts` is GET-only; the reader `readMapLayerFile` uses
`existsSync` + `readFileSync` only — no spawn, no write, no network, no server-side
`validateMapDocument` (validation stays client-side, SPEC-006 C4/C5). The rule-22 amendment for
`/api/map/layers/<zone>` is present in `.claude/rules/22-readonly-proxy.md`.

## Known gaps (honest scope boundaries — not blockers)

- **No dedicated endpoint contract test file** for `+server.ts` (the endpoint is exercised indirectly
  via `readMapLayerFile` unit tests + live). `// TODO(e3-endpoint-test)` — a direct GET/traversal/405
  suite is a follow-up. Test-coverage note, not a correctness finding.
- **Nested layers (level ≥ 2) out of scope** (RFC-032 OQ1). A descend below level 1 fires no layer
  fetch and uses the derived path → deeper levels currently show no curated chips/flows. Tracked as
  the deeper-levels work (`// TODO(e3-nested-layers)`).
- **Latency budget not yet measured** (RFC-032 OQ6 / PRD-038 NFR-005) — endpoint fetch + descend
  render on the real map. Deferred to a measurement EVID.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Reproduction

```bash
cd template
npx vitest run \
  src/shared/server/map.test.ts \
  src/entities/map \
  src/widgets/composed-map \
  src/widgets/artifact-panel/ui/MapNodePanel.render.test.ts
# → 13 files, 165 tests pass
```

CI: `gh pr checks 165` (all three legs pass). Live: `npm run dev` (:5179) → composed-map view →
descend into `z.decisions` → emitted 8-zone layer renders.

## Related Artifacts

- **RFC-032** (`informs`) — the E3 seam this EVID proves; activation gated on this checkpoint
  (rule 11, R_eff > 0).
- **RFC-031** — the client-derived fallback floor, preserved and tested here (non-regression).
- **PRD-038** — parent PRD (Pillar-A FR-002/FR-003).
- **PR #165** — the branch carrying the E3 seam code (commit `e9c21b5` + follow-ups).


