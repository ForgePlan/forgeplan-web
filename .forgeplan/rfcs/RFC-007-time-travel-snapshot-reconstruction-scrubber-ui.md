---
depth: standard
id: RFC-007
kind: rfc
status: draft
title: Time-travel snapshot reconstruction + scrubber UI
---

# RFC-007: Time-travel snapshot reconstruction + scrubber UI

## Summary

PRD-008 wants a timeline panel below the canvas with a scrubber that
re-renders any of the 7 graph views to a workspace snapshot at a chosen
past timestamp T. This RFC pins:

1. **Server-side snapshot reconstruction** — algorithm + endpoint
   contract.
2. **Scrubber UI** — event-axis math + interaction model + COMPARE mode.
3. **Diff overlay rendering** — class-name mapping per change kind.

## Motivation

Without an RFC, every iteration on "what does a snapshot mean?" risks
divergent answers. Pinning the algorithm here makes the implementation
mechanical and audit-replicable.

## Algorithmic constants

```ts
const SNAPSHOT_CACHE_TTL_MS = 60_000; // server cache for /api/snapshot?at=T
const SCRUBBER_DEBOUNCE_MS = 200; // client debounce drag → fetch
const TIMELINE_HEIGHT_PX = 60;
const COLLAPSED_HEIGHT_PX = 24;
const MAX_RECONSTRUCT_ARTIFACTS = 5000;
const COMPARE_DIFF_OPACITY_GHOST = 0.3; // superseded in COMPARE
```

## Snapshot reconstruction algorithm

Server endpoint `GET /api/snapshot?at=ISO[&compare=ISO]`:

1. Parse `at` (and optional `compare`) ISO 8601 timestamps.
2. Reject if newer than `now()`. Reject if `at < workspace_creation_at`
   (return empty workspace).
3. Spawn `forgeplan journal --json --until=<at>` (read-only — rule 22
   compliant; we extend the read-only allow-list with `journal`).
4. Replay events from journal to reconstruct artifact state at T:
   - `created`: artifact exists with status=draft, R_eff=null, no links
   - `activated`: status=active
   - `superseded`: status=superseded, supersededBy=<id>
   - `deprecated`: status=deprecated
   - `marked-stale`: status=stale
   - `linked`: append to outgoing/incoming
   - `unlinked`: remove
   - `scored`: update R_eff
5. Return JSON: `{ at, snapshot: { artifacts: [...], edges: [...], r_eff_by_id: {} } }`.
6. If `compare=ISO2` provided, return `{ at, compare, snapshot, snapshot2, diff: { added, activated, superseded, degraded } }`.
7. Cache result keyed on `(at, compare)` for SNAPSHOT_CACHE_TTL_MS.

**Why `forgeplan journal` and not `git checkout`:**

- `git checkout` mutates the working tree → conflicts with concurrent
  user edits.
- `forgeplan journal --json --until=` already exists in CLI (verify
  before implementation; if missing, RFC-007 falls back to git-based
  approach with worktree isolation).

## Scrubber UI

Component `widgets/timeline/ui/Timeline.svelte`. Anchored below
`.canvas-body` in HomePage. Collapsible.

**Event axis:** events from journal positioned along x-axis, log-spaced
when density > 50 per pixel. Tick marks coloured by event kind:

- `created`: var(--fg-3)
- `activated`: var(--accent)
- `superseded`: var(--fg-4)
- `scored`: var(--good)

**Scrubber:** SVG `<line>` + `<rect class="handle">` at chosen X.
PointerEvent drag with `setPointerCapture`. ArrowLeft/Right keyboard
(step by 1 event); Home/End → jump to extremes. Debounce
`SCRUBBER_DEBOUNCE_MS` before fetching `/api/snapshot`.

**SINGLE mode (default):** 1 scrubber. State broadcast as
`snapshotState.activeAt: ISO`.

**COMPARE mode:** Alt-drag (or Shift-Click) creates 2nd scrubber.
`snapshotState = { mode: 'compare', t1: ISO, t2: ISO }`. Endpoint
called with `?at=t1&compare=t2`.

**"Now" button:** sets `mode: 'now'`; clears scrubber state. Graph
re-renders from live `listPoller` / `graphPoller` data (existing path).

## Diff overlay (COMPARE mode)

Each artifact in T2 snapshot vs T1:

- **added** (in T2, not in T1): class `node-added` → green halo
  `box-shadow: 0 0 8px var(--good)`.
- **activated** (status changed `draft → active`): class
  `node-activated` → accent stroke pulse 1s.
- **superseded** (status changed `* → superseded`): class
  `node-superseded` → opacity 0.3 + grey border.
- **degraded** (R_eff dropped > 0.1): class `node-degraded` → warn
  stroke `var(--warn)`.
- **unchanged**: no extra class.

DependencyGraph component receives `snapshotMode + diffMap` as $props
and threads them to active view; each view's `<g class="node">`
receives the diff class via the existing `class:` directive pattern.

## Endpoint allow-list extension

Update `template/src/shared/server/forgeplan.ts` `READ_ONLY_SUBCOMMANDS`
allow-list to include `journal`. Existing 4-process spawn semaphore
unchanged.

Per rule 22: `journal --json` is read-only and idempotent. Validation
regex on `at` / `compare` parameters: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$`
(strict ISO 8601). Reject with 400 on mismatch.

## Implementation Phases

1. **F18-T1** — extend `READ_ONLY_SUBCOMMANDS` with `journal`; verify `forgeplan journal --json --until=ISO` exists (and works) — if not, fall back to event log replay from `git log` of `.forgeplan/`.
2. **F18-T2** — server endpoint `template/src/routes/api/snapshot/+server.ts` with input validation + cache.
3. **F18-T3** — `widgets/timeline/lib/snapshot-state.svelte.ts` — shared $state singleton (mode, activeAt, t1, t2).
4. **F18-T4** — `widgets/timeline/lib/event-axis.ts` — pure math (event-to-pixel mapping) + unit tests.
5. **F18-T5** — `widgets/timeline/ui/Timeline.svelte` — SVG scrubber + step buttons + collapse toggle.
6. **F18-T6** — wire snapshot prop into DependencyGraph + 7 view files; apply diff classes when COMPARE.
7. **F18-T7** — diff overlay CSS in app.css; honour reduced-motion.
8. **F18-T8** — CHANGELOG, npm run smoke, vitest, commit, push, PR `feature/f18-time-travel → develop`.

## Proposed Direction

Adopt the journal-replay approach end-to-end. PR
`feature/f18-time-travel`. After F18 ships, COMPARE mode subsumes the
ad-hoc PR-Diff feature requested separately — same backend, two
scrubber positions instead of one.

## Options Considered

| Option                                                                | Approach                               | Verdict                                                                                |
| --------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| **A. journal --json --until=ISO replay**                              | Read-only, no working-tree disturbance | **Chosen**                                                                             |
| B. git checkout to commit-before-T + read .forgeplan/                 | Pure git read                          | Rejected — mutates working tree, conflicts with active editing                         |
| C. Pre-compute snapshots at every commit, cache in `.forgeplan/lance` | Faster                                 | Rejected — cache invalidation hell, `.forgeplan` is markdown source-of-truth (ADR-003) |
| D. Client-side replay of full journal                                 | No new endpoint                        | Rejected — full journal can be > 5000 events; bandwidth waste                          |

## Invariants

- `/api/snapshot` is read-only — only `forgeplan journal --json --until=`, `forgeplan list --json`, `forgeplan graph --json` invoked.
- Snapshot reconstruction is deterministic — same `at` → same JSON output.
- COMPARE mode never mutates either snapshot — both are read-only views.
- Scrubber state survives `prefers-reduced-motion` (no animation, but logical state OK).
- Workspace > MAX_RECONSTRUCT_ARTIFACTS returns 413 with explanatory error; UI shows "history too large" message.

## Rollback Plan

1. Revert each F18-T\* commit independently.
2. Remove `journal` from `READ_ONLY_SUBCOMMANDS` allow-list.
3. Remove `template/src/widgets/timeline/` directory entirely.
4. Drop snapshot-prop from DependencyGraph + view interfaces (each is a pure addition with default value, removal is mechanical).

## Risks

- R-1: `forgeplan journal --json --until=` may not exist or behave differently. Verify in T1 before any UI work.
- R-2: Snapshot at far-past timestamps misses historical artifact bodies (we only show structural state — bodies are current). Acceptable: covered by Non-Goals.
- R-3: SCRUBBER_DEBOUNCE_MS too aggressive on slow machines → janky drag. Adjust empirically; fallback to 400ms.
- R-4: Endpoint cache (60s TTL) — if user rapidly toggles COMPARE between many T1/T2 pairs, cache fills up. Cap at 16 entries (LRU eviction).
