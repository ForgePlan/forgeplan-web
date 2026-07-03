---
depth: standard
id: EVID-084
kind: evidence
last_modified_at: 2026-07-03T01:40:03.942724+00:00
last_modified_by: claude-code/2.1.198
links:
- target: RFC-030
  relation: informs
status: active
title: Fix-loop closing EVID-082/083 — composed-layout tests + error/loading discriminant
---

## Fix-loop closing EVID-082/083

Independent tester (EVID-082) and code-reviewer (EVID-083) both returned CONCERNS on the composed-map Phase-1 build (`4c59cda..39a93ab`). Both findings addressed directly by the orchestrator, verified by re-running the full suite, not re-asserted from memory.

### Findings closed

1. **EVID-082/083 — `composed-layout.ts` had zero test coverage** (SPEC-006 AC-2 / RFC-030 Implementation Phase 3 gate silently unmet). Fixed: added `entities/map/lib/composed-layout.test.ts` — determinism (repeat-call deep-equal), pinned-cols (zone.cols drives sub-grid width, not node count), append-stability for both a non-wrapping and a row-wrapping append (earlier node positions byte-identical in both cases), bounded/finite output across a multi-zone/multi-edge document, and a not-throwing check for edges/connectors whose endpoint has no resolved position. 7 new tests, all pass on first run against fresh per-case fixtures (not tautological).

2. **EVID-083 F1 (HIGH bug) — a server transport error collapsed into "no map yet"**. `ComposedMapView.svelte`'s `liveBranch` derivation checked only `mapPoller.state.data`; a malformed-JSON server response (`MapFileErr`, `data: {}`) is indistinguishable from the ENOENT-empty envelope once only `data` is inspected, so a genuine error silently rendered the calm empty state instead of RFC-030's own Failure-Path-B error surface. Fixed: check `mapPoller.state.error` before the `isEmptyMapResponse` discriminant.

3. **EVID-083 F2 (MEDIUM bug) — pre-first-fetch flash of a false validation error**. Before the poller's first fetch resolves, `state.data` is `null`; `isEmptyMapResponse(null)` is `false` by design (zero-key-object check), so `null` fell through to `validateMapDocument(null)`, which correctly rejects `null` — producing a "Map document failed validation" flash on every mount before real data ever arrived. Fixed: added an explicit `loading` branch (`data === null && lastFetched === null`) checked first, with a neutral "Loading map…" render state.

4. **EVID-083 finding 3 (Architecture) — `composed-layout.ts` location diverged from RFC-030 SD-2 without a recorded amendment**. Not a bug (FSD import direction was never violated — `widgets → entities` held throughout), but the RFC said one thing and the code did another. Fixed by amending RFC-030 SD-2 (and its Module Breakdown / Function Signatures / Implementation Phase 3 cross-references) to record the actual, reasoned decision: colocating the pure layout engine with the document-model types it consumes (`entities/map/lib/composed-layout.ts`) avoids a redundant type-import bridge to a would-be `widgets/composed-map/model/types.ts`. This is a documentation fix, not a code change.

### Verification (re-run after all fixes, not carried over from the prior EVIDs)

- `npx vitest run` (full suite): **477/477 passing, 38/38 files** (was 470/470 before this fix-loop; +7 new).
- `npx svelte-check --tsconfig ./tsconfig.json --threshold error`: **0 errors / 1155 files** (2 pre-existing a11y warnings, unchanged, already accepted — canvas background click-to-reset, mitigated by the existing Esc-key equivalent).
- `forgeplan validate RFC-030`: PASS, 0 errors / 0 warnings, after the amendment.

### What is NOT closed by this fix-loop (unchanged from EVID-082/083, deliberately deferred)

- The Phase-4 render-harness test suite for `ComposedMapView.svelte` (mirroring `idef0-view.render.test.ts`: render-proof scenario, empty/loading/error states, time-travel suspension, the §15 nav contract) still does not exist. Both prior reviews named this as an expected, RFC-named Phase-4 deliverable, not a silently-skipped gate like the Phase-3 layout suite was — it is left as follow-up work, not fixed in this loop, per the orchestrator's time-boxing of this build wave.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test


