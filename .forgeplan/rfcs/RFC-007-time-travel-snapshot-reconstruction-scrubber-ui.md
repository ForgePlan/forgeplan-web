---
depth: standard
id: RFC-007
kind: rfc
links:
  - target: PRD-008
    relation: refines
status: active
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
const SNAPSHOT_CACHE_TTL_MS = 60_000; // in-memory LRU TTL for hot keys
const SNAPSHOT_CACHE_MAX_ENTRIES = 32; // LRU cap (memory layer)
const SNAPSHOT_DISK_CACHE_DIR = ".forgeplan-web/.snapshots"; // <sha>.json files
const SCRUBBER_DEBOUNCE_MS = 200; // client debounce drag → fetch
const TIMELINE_HEIGHT_PX = 60;
const COLLAPSED_HEIGHT_PX = 24;
const MAX_RECONSTRUCT_ARTIFACTS = 5000;
const COMPARE_DIFF_OPACITY_GHOST = 0.3; // superseded in COMPARE
const WORKTREE_TMP_PREFIX = "fpw-snap-"; // os.tmpdir()/fpw-snap-<sha>
```

## Snapshot reconstruction algorithm

> **F18-T1 finding (2026-05-06):** `forgeplan journal --json --until=ISO`
> does NOT exist in CLI 0.28.0 — only `--type` and `--risk` flags are
> supported, no `--json` output, no time-cutoff. Additionally
> `forgeplan log --json` emits structured mutations but is rebuilt by
> `reindex` and currently shows all 39 artifacts as `create at 12:21
today, source=reindex` — historical timeline collapsed. Triggered
> Risk R-1 fallback: git-based reconstruction is the only durable path.

Server endpoint `GET /api/snapshot?at=ISO[&compare=ISO]`:

1. Parse `at` (and optional `compare`) ISO 8601 timestamps via strict
   regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$`.
2. Reject if newer than `now()`. Reject if `at < workspace_creation_at`
   (return empty workspace).
3. Resolve `at` to commit SHA: `git rev-list -1 --before="<at>"
--first-parent HEAD -- .forgeplan/`. Empty result → return empty
   workspace.
4. Memory-cache lookup keyed on SHA. Hit (fresh) → return.
5. Disk-cache lookup at `<workspaceRoot>/.forgeplan-web/.snapshots/<sha>.json`.
   Hit → re-prime memory cache, return.
6. Miss path:
   a. `mkdtemp(os.tmpdir() + WORKTREE_TMP_PREFIX)` → ephemeral path.
   b. `git worktree add --detach <tmp> <sha>`.
   c. Inside `<tmp>`: spawn `forgeplan list --json` (already in
   `READ_ONLY_SUBCOMMANDS`).
   d. Parse JSON, project to `{ artifacts, edges, r_eff_by_id }`.
   e. Write `<sha>.json` to disk cache (atomic rename); seed memory cache.
   f. `git worktree remove --force <tmp>` — best-effort, log on failure.
7. Return JSON: `{ at, sha, snapshot: { artifacts, edges, r_eff_by_id } }`.
8. If `compare=ISO2`, recursively resolve second snapshot (parallel
   `Promise.all`), compute `diff: { added, activated, superseded,
degraded }` server-side, return `{ at, compare, sha, sha2, snapshot,
snapshot2, diff }`.

**Why git+cache over CLI replay (Path D, this RFC's chosen approach):**

- Markdown `.forgeplan/*.md` is the source of truth (parent
  Forgeplan repo's ADR-003). Git automatically becomes append-only
  event log over the source of truth — no derived structure to
  desynchronize.
- `git worktree add --detach <sha>` creates an isolated checkout in
  `os.tmpdir()` — never touches the user's working tree. This was
  the objection that originally rejected option B; worktrees solve
  it.
- `forgeplan list --json` inside the worktree gives us the parsed
  state with R_eff, links, status — no need to hand-replay mutations.
- Cache hits make repeated COMPARE mode (Alt-drag scrubber pairs)
  serve from disk: ~5-10ms per snapshot vs 200-500ms cold.

**Rule 22 compliance:** the endpoint shells out to `forgeplan list
--json` (already in allow-list) and to `git rev-list / worktree
add / worktree remove` — read-only operations on the local repo
that do not mutate `.forgeplan/`. The worktree lives in
`os.tmpdir()`; `git worktree remove` only deletes the temp tree, not
the host workspace.

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

## Endpoint allow-list

`forgeplan list` is already in `READ_ONLY_SUBCOMMANDS`
(`template/src/shared/server/forgeplan.ts`). No allow-list extension is
required for this RFC. Git operations (`rev-list`, `worktree
add/remove`) are invoked directly via `child_process.spawn`, not
through `runForgeplan`, since they are not forgeplan subcommands.

Per rule 22: validation regex on `at` / `compare` parameters:
`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$` (strict ISO 8601).
Commit SHA is sanitised (`^[0-9a-f]{7,40}$`) before passing to git
worktree commands. Reject with 400 on mismatch.

## Implementation Phases

1. **F18-T1** — verify `forgeplan journal --json --until=ISO` API
   surface. ✅ Done 2026-05-06: API does NOT exist; pivoted to
   git-based reconstruction (Path D) per Risk R-1.
2. **F18-T2** — server endpoint
   `template/src/routes/api/snapshot/+server.ts` (GET, ISO regex
   validation) + library
   `template/src/shared/server/snapshot.ts` (`getSnapshot(at)` +
   `compareSnapshots(at1, at2)` with git+cache hybrid). Read-only proxy
   per rule 22.
3. **F18-T3** — `widgets/timeline/lib/snapshot-state.svelte.ts` —
   shared $state singleton (mode, activeAt, t1, t2). Use plain `let`
   for memoization-only signals to avoid `effect_update_depth_exceeded`
   (workspace convention).
4. **F18-T4** — hydrate canvas from snapshot. Wire scrubber → store
   → DependencyGraph re-render. SINGLE mode complete; status indicator
   `viewing snapshot at YYYY-MM-DD HH:MM`.
5. **F18-T5** — formalise cache layer if profiling shows >500ms cold
   reconstruction; otherwise document as future-work in this RFC and
   ship without disk cache (memory-LRU only).
6. **F18-T6** — COMPARE mode. Alt-drag → 2nd scrubber → parallel
   `Promise.all` snapshot fetches → diff overlay class names.
7. **F18-T7** — write `EVID-020` with structured fields (verdict /
   congruence_level / evidence_type), measure cold/warm latency, link
   to PRD-008 + RFC-007 via `forgeplan link`.
8. **F18-T8** — CHANGELOG, `npm run smoke`, vitest, commit, push, PR
   `feature/f18-time-travel → develop`. After merge: `release/v0.1.12`
   PR → main → tag → workflow → npm.

## Proposed Direction

Adopt the **git+cache hybrid** (Path D) end-to-end. PR
`feature/f18-time-travel`. After F18 ships, COMPARE mode subsumes the
ad-hoc PR-Diff feature requested separately — same backend, two
scrubber positions instead of one.

## Options Considered

| Option                                                                                | Approach                                                                    | Verdict                                                                                         |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A. `forgeplan journal --json --until=ISO` replay                                      | Hand-replay events from CLI                                                 | **Rejected (F18-T1)** — flag does not exist in CLI 0.28.0; `log --json` exists but reindex-flat |
| B. `git checkout` to commit-before-T + read `.forgeplan/`                             | Pure git read                                                               | Rejected — mutates host working tree, conflicts with concurrent user edits                      |
| C. Pre-compute snapshots at every commit, cache in `.forgeplan/lance`                 | Faster                                                                      | Rejected — cache invalidation hell, `.forgeplan` is markdown source-of-truth (ADR-003)          |
| **D. `git worktree add --detach` to `os.tmpdir()` + cache + `forgeplan list --json`** | Ephemeral isolated checkout per snapshot, in-memory LRU + disk cache by SHA | **Chosen** — preserves working tree, uses MD source-of-truth, cache makes COMPARE fast          |
| E. Client-side replay of full journal                                                 | No new endpoint                                                             | Rejected — full history can exceed bandwidth + we'd still need git for actual MD content        |

## Invariants

- `/api/snapshot` is read-only — invokes `forgeplan list --json` (allow-listed) and `git rev-list / worktree add / worktree remove` only. No mutating subcommands; no writes to `.forgeplan/`.
- Worktrees live in `os.tmpdir()` and are removed after each snapshot reconstruction (best-effort cleanup; `git worktree prune` reaps leaks).
- Snapshot reconstruction is deterministic — same SHA → same JSON output (cache key = SHA, not timestamp).
- Disk cache lives in `<workspaceRoot>/.forgeplan-web/.snapshots/` — bounded by repo commit count and a `.gitignore` entry; safe to delete at any time.
- COMPARE mode never mutates either snapshot — both are read-only views.
- Scrubber state survives `prefers-reduced-motion` (no animation, but logical state OK).
- Workspace > MAX_RECONSTRUCT_ARTIFACTS returns 413 with explanatory error; UI shows "history too large" message.

## Rollback Plan

1. Revert each F18-T\* commit independently.
2. Remove `template/src/widgets/timeline/` directory.
3. Remove `template/src/routes/api/snapshot/` and `template/src/shared/server/snapshot.ts`.
4. Drop snapshot-prop from DependencyGraph + view interfaces (each is a pure addition with default value — removal is mechanical).
5. Add `.forgeplan-web/.snapshots/` cleanup to next `init --force` if leaked (already cleaned by current `init` since it's inside `.forgeplan-web/`).

## Risks

- R-1: ~~`forgeplan journal --json --until=` may not exist.~~ ✅ **Closed F18-T1** — pivoted to git+cache.
- R-2: Snapshot at far-past timestamps misses historical artifact bodies (we only show structural state — bodies are current). Acceptable: covered by Non-Goals.
- R-3: SCRUBBER_DEBOUNCE_MS too aggressive on slow machines → janky drag. Adjust empirically; fallback to 400ms.
- R-4: Endpoint memory-cache LRU — if user rapidly toggles COMPARE between many T1/T2 pairs, cache evicts hot keys. Cap at SNAPSHOT_CACHE_MAX_ENTRIES=32; disk cache backs it up.
- R-5: `git worktree add` cost scales with repo size. Profile in T2; if cold path > 500ms, escalate to T5 (formal disk cache) and consider `git archive | tar -x` as a sparse-checkout alternative.
- R-6: Concurrent worktree creation could hit git lockfile contention. Serialise via spawn semaphore (existing 4-process cap in `forgeplan.ts`) or add a separate worktree mutex.
- R-7: If host repo is shallow-cloned (`git clone --depth N`), snapshots before depth limit return empty. Detect via `git rev-parse --is-shallow-repository`; surface as warning in UI.
- R-8: Disk cache may persist across `git pull` rewrites (force-pushed branches). Mitigation: cache key is commit SHA — rewritten history simply produces orphan files; `git worktree prune` + manual cleanup as future maintenance.
