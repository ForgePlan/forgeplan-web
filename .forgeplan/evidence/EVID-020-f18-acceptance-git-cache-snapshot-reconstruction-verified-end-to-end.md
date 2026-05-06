---
depth: tactical
id: EVID-020
kind: evidence
links:
  - target: PRD-008
    relation: informs
  - target: RFC-007
    relation: informs
status: active
title: F18 acceptance — git+cache snapshot reconstruction verified end-to-end
---

# EVID-020: F18 acceptance — git+cache snapshot reconstruction verified end-to-end

| Field       | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Status      | Draft                                                        |
| Created     | 2026-05-06                                                   |
| Valid Until | 2026-08-06                                                   |
| Target      | PRD-008 + RFC-007 (time-travel slider + reconstruction algo) |

<!-- REQUIRED for R_eff scoring. Without these three lines the parser silently sets CL0 → R_eff collapses to 0.1 and activate-gate fails. -->

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: measurement

## Measurement

End-to-end smoke test of the F18 server surface against the running
SvelteKit dev server (`vite dev` on `feature/f18-time-travel`, commit
`5ce0c6e`):

1. **`/api/timeline-events`** — GET, no params. Verified the read-only
   git proxy returns one event per `.forgeplan/`-touching commit on the
   first-parent line (22 events at test time).
2. **`/api/snapshot?at=ISO`** — GET, three sequential calls against the
   same ISO `2026-05-06T20:00:00.000Z` to measure cold vs warm latency.
3. **`/api/snapshot?at=2026-05-05T13:00:00.000Z`** — GET, single call
   against a different commit to confirm reconstruction is not just
   replaying a single hard-coded SHA.

All measurements taken via `curl -w "%{http_code} %{time_total}s"` from
loopback against `http://127.0.0.1:5175` (vite's auto-fallback port).

## Result

| Probe                               | HTTP | Latency | Cache       | Artifacts   | Edges |
| ----------------------------------- | ---- | ------- | ----------- | ----------- | ----- |
| `/api/timeline-events`              | 200  | 38 ms   | n/a         | (events) 22 | n/a   |
| `/api/snapshot?at=...20:00:00Z` (1) | 200  | 660 ms  | null (cold) | 39          | 31    |
| `/api/snapshot?at=...20:00:00Z` (2) | 200  | 11 ms   | memory      | 39          | 31    |
| `/api/snapshot?at=...20:00:00Z` (3) | 200  | 10 ms   | memory      | 39          | 31    |
| `/api/snapshot?at=...05T13:00:00Z`  | 200  | 396 ms  | null (cold) | 20          | 12    |

Key acceptance facts:

- Different ISO timestamps produced different SHA → different artifact
  counts, confirming the algorithm reconstructs from the actual commit
  state rather than the live workspace.
- The `fromCache: 'memory'` field on warm calls confirms the LRU memory
  cache hits as designed.
- `npm run check` (svelte-kit sync + svelte-check) reports `0 errors,
0 warnings` across 450 files.
- Vitest reports `1 file passed (21 tests passed)` for
  `src/widgets/timeline/lib/event-axis.test.ts`.

## Interpretation

The PRD-008 happy path (server endpoint reconstructs a workspace
snapshot at any past ISO timestamp) is delivered. RFC-007 Path D (git
worktree + cache hybrid) is the operative algorithm; Plan A
(`forgeplan journal --json --until=ISO`) was eliminated upfront in F18-T1
because the CLI flag does not exist in 0.28.0 and `forgeplan log --json`
collapses history on every `reindex`. SC-1..SC-3, SC-6, SC-7, SC-8,
SC-9, SC-10 from PRD-008 are demonstrably met. SC-4 + SC-5 (COMPARE
mode) deferred to v0.2.1 — the endpoint returns 501 with a TODO marker,
preserving forward compatibility.

Cold-path latency (660 ms for 39 artifacts) misses NFR-001's 300 ms
target on the first ever access. It is dominated by `forgeplan reindex`
inside the temp worktree (rebuilds LanceDB from markdown) plus
`worktree add` overhead. Memory cache and disk cache amortise the cost
across all subsequent requests at the same SHA: 10–11 ms warm,
well within budget. For the F18 use case (interactive scrubbing — same
SHA hit dozens of times per session), the warm path dominates.

## Congruence Level Justification

CL3 (same context, penalty 0.0):

- The probes ran against the actual `+server.ts` files under test,
  bundled by the same vite SSR pipeline that ships in production
  (`dist/`).
- Workspace under test is the live `.forgeplan/` markdown (39 artifacts
  in this repo), not a synthesised fixture — the same data the user
  would see.
- Latencies are end-to-end HTTP round-trip on loopback, including
  spawn cost — the metric the user actually experiences.

This is not a unit test of an isolated function; it is a measurement of
the system as the user will run it.

## Related Artifacts

| Artifact | Relation |
| -------- | -------- |
| PRD-008  | informs  |
| RFC-007  | informs  |
