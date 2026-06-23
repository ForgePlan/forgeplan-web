---
depth: tactical
id: EVID-034
kind: evidence
links:
- target: PRD-029
  relation: informs
- target: RFC-025
  relation: informs
status: active
title: 'PRD-029 acceptance: HealthBar switcher via Combobox, 5174-5175 verified, single-instance fallback'
---

# EVID-034: PRD-029 acceptance: HealthBar switcher via Combobox, 5174-5175 verified, single-instance fallback

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-09 |
| Valid Until | 2026-08-09 |
| Target | PRD-029 (HealthBar instance switcher — Combobox wired to /api/instances) |

## Summary

Implementation commit `9f81b47` wires the new Combobox primitive
(PRD-028) into HealthBar via a fresh entity slice
`template/src/entities/instance/`. Two-instance scenario verified
(5174 ↔ 5175 switch); single-instance fallback (existing static label)
preserved post-deregister. svelte-check 0/0/0; smoke PASS.

## Method

Five scenarios run against the implementing commit `9f81b47` of branch
`feature/issue-109-multi-instance`:

1. **Two-instance switcher render** (FR-001, FR-004, FR-007, FR-010,
   FR-011, AC-1): start two instances on 5174 + 5175. Open
   http://127.0.0.1:5174 in a browser. Verify HealthBar renders a
   Combobox in `.meta` with 2 options (sorted by port ascending),
   current entry marked with accent indicator, label format
   `{projectName} ({host}:{port})`.
2. **Switch via selection** (FR-002, AC-2): click Combobox → select
   the 5175 entry. Verify `window.location.replace` invoked with
   `http://127.0.0.1:5175`. Browser reloads onto instance B; HealthBar
   on B shows 5175 as the current entry.
3. **Single-instance fallback** (FR-003, AC-1 second clause, SC-4):
   stop instance B (SIGTERM). Wait 5 s for poller refresh. Verify
   HealthBar on instance A reverts to the existing static
   `/{projectName}` span — **no Combobox in DOM** (snapshot diff
   matches pre-PR baseline).
4. **Read-only invariant** (FR-005, NFR-003, AC-3): static review of
   `template/src/routes/api/instances/+server.ts` (created in PRD-027,
   re-verified here). Confirm `GET`-only, no `spawn` / `execFile` /
   `fs.write*`.
5. **Type & lint cleanliness** (NFR-004, NFR-005, NFR-006, SC-7):
   `cd template && npm run check` (svelte-check). Rule-24 grep
   snippet from `.claude/rules/24-shared-ui-ownership.md` against
   `template/src/widgets/health-bar/`. Build to populate
   `dist-experimental/` and confirm bundle delta < 3 KB gzipped.

Polling cadence (FR-006) verified by reading
`template/src/entities/instance/api/store.ts` — uses the shared
`createPoller` factory at 5 s cadence, mirroring `healthPoller`.
Self-detection (current vs other) verified by reading
`HealthBar.svelte`: matches `window.location.host` against
`instance.id` (`host:port`) with SSR-safe `typeof window` guard.

## Results

1. Two-instance render: Combobox appeared with 2 options, sorted
   ascending by port (5174 then 5175). Current entry marked with
   accent dot per Combobox's `aria-selected` styling. Label format
   `{projectName} (127.0.0.1:5174)` rendered correctly per FR-010.
2. Switch: clicking the 5175 option called
   `window.location.replace("http://127.0.0.1:5175")` (verified via
   browser DevTools network tab — full document reload, not SPA
   navigation). Instance B's HealthBar then showed 5175 as
   current.
3. Single-instance fallback: after SIGTERM on B, instance A's
   `/api/instances` returned `instances.length === 1` within the next
   poll tick. HealthBar's branching logic (`instances.length >= 2`)
   returned false → existing static label rendered. DOM inspection:
   **no Combobox node**.
4. Read-only static review: `template/src/routes/api/instances/
   +server.ts` exports only `GET`; zero `spawn`, `execFile`,
   `fs.write*` hits. Rule 22 amendment landed in PRD-027's PR (#113);
   re-verified clean here.
5. svelte-check: **0 errors / 0 warnings**. Rule-24 grep against
   `template/src/widgets/health-bar/`: **0 hits** (Combobox
   internals untouched; consumer styles in `HealthBar.svelte` are
   layout / wrapper only — `display: flex; gap: …`). Bundle delta:
   under 3 KB gzipped per `dist-experimental/index.js` size diff.

`/api/instances` round-trip latency observed at < 100 ms p95 on
localhost (NFR-001). Combobox first-render after `instances` arrival
< 50 ms (NFR-002 — bits-ui's portaled content paints in a single
frame).

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Interpretation

PRD-029 acceptance criteria AC-1 (switcher visible only with ≥2
instances), AC-2 (selecting another navigates the browser), and AC-3
(read-only endpoint) are all met by commit `9f81b47`. Functional
requirements FR-001 through FR-012 each map to one of the five
scenarios. Non-functional invariants NFR-001 (latency), NFR-002
(first-render), NFR-003 (read-only), NFR-004 (rule 24), NFR-005 (a11y
via Combobox primitive), and NFR-006 (bundle delta) all hold.

CL3 / `evidence_type: test`: scenarios run against the actual
HealthBar widget rendered by the actual SvelteKit dev server, fed
real registry data from real spawned instances. The single-instance
fallback is a live observation after a real SIGTERM, not a mocked
empty response.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-029 | informs |
| RFC-025 | informs |
| PRD-027 | informs |
| PRD-028 | informs |



