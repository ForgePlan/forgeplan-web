---
depth: standard
id: EVID-094
kind: evidence
last_modified_at: 2026-07-06T11:44:56.231282+00:00
last_modified_by: claude-code/2.1.201
links:
- target: RFC-031
  relation: informs
status: active
title: 'Deeper-level flow chips: deriveSubDocument carries filtered parent flows — 38/38 tests + adversarial PASS'
---

## Status

draft

## Summary

Checkpoint for the #21 web-side stopgap (PR #166) on **RFC-031**'s `deriveSubDocument`: deeper
composed-map drill levels (level 2+, no map-pack-emitted layer) now render flow chips because the
derivation **carries the parent doc's flows filtered to the revealed node subset** instead of
dropping them.

**Contract note (supersedes an RFC-031 statement):** RFC-031's body describes `deriveSubDocument` as
"filters `edges` to intra-altitude endpoints; **drops `flows`**". As of this change the second clause
is superseded — flows are now **carried, filtered** (see below). The RFC-031 body text is stale on
this point and is queued for reconciliation alongside the arch-audit findings (computeComposedLayout
"unchanged" claim; edge-rollup module-breakdown gap).

## What changed

`template/src/entities/map/lib/derive-subdocument.ts` — replaced `flows: undefined` with a carried set:
for each parent flow, keep `node_ids ∩ revealedIds`; drop the flow if fewer than 2 survive; trim
`node_ids` to the survivors; drop `steps` + `edge_ids` on a partial trim (per-node RU narration would
misalign) and keep them verbatim when the whole flow survived; `flows = carried.length ? carried :
undefined` (never `[]`). `revealedIds` is the exact set already gating edge visibility, so
flow-node/edge-node consistency holds by construction.

## Observations (measured, 2026-07-06)

- `npx vitest run src/entities/map/lib/derive-subdocument.test.ts` → **38/38 PASS** (5 new tests:
  (1) fully-revealed flow survives verbatim; (2) partial trim drops `steps`+`edge_ids`; (3) <2 revealed
  node_ids → dropped; (4) empty → `undefined` not `[]`; (5) no-parent-flows non-regression).
- `npx vitest run src/entities/map src/widgets/composed-map` → **155/155 PASS**.
- Independent adversarial review (agents-core:code-reviewer): **PASS**. Re-ran the suite itself,
  traced correctness against source (not just tests), confirmed no path where a carried flow's
  `node_ids` contains an unplaced id (`kept` is filtered by `revealedIds`), verified downstream
  graceful degradation: `FlowChips` reads only `id`/`name`; `ComposedMapView` gates the steps caption
  with `{#if activeFlowObj?.steps?.length}`, so a trimmed flow with `steps: undefined` simply omits the
  caption. Purity intact (no minted ids, no x/y, deterministic). `tsc` shows only 3 pre-existing
  unrelated `shared/ui` errors (confirmed on base).

## Known scope boundary

This is a **stopgap**, not the root fix. Level 2+ still uses the client-derived `deriveSubDocument`
approximation; the curated fix is source-side — `forgeplan-map-pack` emitting **nested** per-zone
layers (`layers/<ancestor>/<zone>.json`) rendered via the RFC-032 prefer-emitted seam.
`// TODO(e3-nested-layers)`. Folded into the marketplace findings brief.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Related Artifacts

- **RFC-031** (`informs`) — the drill-down `deriveSubDocument` this refines; supersedes its "drops
  flows" clause.
- **RFC-032** — the prefer-emitted seam whose nested-layer extension is the root fix for deeper levels.
- **PR #166** — the branch carrying this change (commit `9553faf`).


