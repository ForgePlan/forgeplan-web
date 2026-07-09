---
depth: standard
id: EVID-098
kind: evidence
last_modified_at: 2026-07-07T14:19:25.320158+00:00
last_modified_by: claude-code/2.1.202
links:
- target: RFC-035
  relation: informs
status: active
title: 'RFC-035 chat panel v2 fully verified: window + status + tabs + live tokens/instances + magic launcher (771 tests, live)'
---

## Summary

RFC-035 (chat panel v2) is fully implemented across four commits on
`feat/idef0-onboard-agent-phase1` and verified by automated gates **and**
live browser testing. Supersedes the pre-fix BLOCKER EVID-097 (which reviewed
the incomplete Wave-1 integration).

Commits: `286ced8` (Wave 1 — window/status/tabs/Info scaffold), `1cb6edb`
(Wave 2 — live tokens + instance discovery + corner resize), `18bf9f8`
(polish — /health carries instance data so Info populates on open),
`60ae14a` (magic launcher moved to onboard header).

## Automated gates (run against MAIN)

| Gate | Result |
|---|---|
| `node agent/scripts/smoke.mjs` | exit 0 |
| `npx vitest run src/widgets/map-chat src/shared/ui` | pass |
| full `npx vitest run` | 58 files / 771 tests pass |
| `npx svelte-check --threshold error` | 0 errors (7 pre-existing warnings, unrelated) |
| rule-24 grep | OK — FloatingWindow + magic Button are clean shared/ui primitives; no upper-layer `:global()` re-skin |

## Live browser verification (Playwright, real daemon)

- **FR-1 window**: dock↔float toggle detaches/re-docks; 8 resize grips (4 edges
  + 4 corners) present with `nwse/nesw/ew/ns` cursors; geometry persists +
  clamps to viewport on restore (I4).
- **FR-2 status**: compact `online` / `offline` dot reflects daemon liveness
  (verified both — killing the daemon flips it).
- **FR-3 tabs**: Chat|Info switch cleanly (fixed a real CSS-cascade stacking
  bug where an author `display:flex` defeated `[hidden]`); switching preserves
  the mounted chat/stream.
- **FR-4/FR-5 Info tokens**: after a real turn, Info shows
  `input 105,932 · output 702 · $3.0390` + cumulative — the NATIVE SDK
  `result.usage` / `total_cost_usd` fields, forwarded verbatim.
- **FR-6 instances**: with a 2nd daemon live, Info shows
  `sees 1 other · Work:7432`; the daemon registers in
  `~/.forgeplan-web/instances.json` with `kind:agent`; the /health probe
  carries the data so the row populates on chat open with zero WS/subprocess.
- **Magic launcher**: the Ask button (animated iridescent rainbow gradient +
  twinkling sparkles) sits in the onboard header off the map, opens the
  chat, toggles to Close chat.

## Invariants held

- **I1** read-only preserved (no mutation path; /health is GET-only, rule 22
  intact — browser to daemon direct, no /api change).
- **I2** no subprocess regression — lazy `query()` holds; probe / idle chat /
  Info-open spawn zero `claude` subprocesses (the earlier P0 CPU meltdown fix,
  commit `e42040e`, is not regressed; the /health-carries-instances polish
  opens no WS).
- **I3** forward-compatible wire — usage/capabilities/otherInstances additive;
  PROTOCOL_VERSION 1 to 2; old browser ignores unknown, defaults arrays empty.
- **I4** never restore off-screen — clampFloating on restore (unit-tested).
- **I5** single registry writer — `agent/lib/registry.mjs` reuses the
  instances.json FORMAT (atomic tmp+rename) with `kind:agent`; does NOT
  import the core `bin/lib/registry.mjs` (cross-package). Known:
  simultaneous-startup write race can briefly drop a row; self-heals via the
  30s heartbeat — pre-existing registry contention, not introduced here,
  acceptable for same-machine multi-project use.

## Notes

Two real bugs were caught by LIVE testing that the unit suite structurally
cannot catch (documented for future contributors): (1) the tab-stacking
CSS-cascade bug; (2) the `.map-chat-pos` stacking-context trapping the
FloatingWindow's `position:fixed`. Both fixed + re-verified live.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test


