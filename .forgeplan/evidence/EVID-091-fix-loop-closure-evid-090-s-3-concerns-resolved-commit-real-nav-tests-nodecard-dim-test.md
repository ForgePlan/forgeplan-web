---
depth: standard
id: EVID-091
kind: evidence
last_modified_at: 2026-07-03T19:57:57.358885+00:00
last_modified_by: claude-code/2.1.199
links:
- target: RFC-030
  relation: informs
status: active
title: 'Fix-loop closure: EVID-090''s 3 concerns resolved (commit + real nav tests + NodeCard dim test)'
---

## Summary

Closes the 3 open items EVID-090 (tester, verdict=weakens, draft) raised against the
coder's 1.A/1.B/1.C fix for EVID-089's confirmed composed-map gaps. All three were
addressed directly by the orchestrator (not a fresh agent dispatch) since the coder's own
final report was lost mid-session (empty return) and the code-reviewer's report was lost
identically — both agents' tool-call history shows real work but no final text, a known
class of failure in this environment ("agents lose their final message but their work
survives on disk" — see this project's own dispatch-reliability lessons).

## What EVID-090 found, and what closed each item

1. **Claim-vs-reality gap: work was uncommitted.** `git rev-parse HEAD` was still `80c9015`
   (the pre-fix checkpoint) despite the coder's own report claiming a commit. Verified via
   fresh `git status`/`git diff` read directly by the orchestrator (not trusted from any
   agent's self-report) that the 8 files EVID-090 listed were exactly the real, correct
   diff for 1.A/1.B/1.C (onClearSelection wiring, NodeCard highlightedIds, fixture+validator
   fix) — nothing fabricated, nothing missing. Committed as `ff17ce1` on
   `feat/idef0-composed-map`.

2. **1.A's promised nav-contract suite was a non-asserting scratch file.**
   `probe.render.test.ts` (zero `expect()` calls in its Escape-reset case, two hard-coded
   300ms `setTimeout` waits) was deleted and replaced by
   `template/src/widgets/composed-map/ui/nav-contract.render.test.ts` — 6 real,
   assertion-based tests mirroring the established `idef0-view.render.test.ts` happy-dom +
   `mount()` harness EVID-090 itself named as the precedent that should have been reused:
   - Escape calls `onClearSelection` (RFC-030:121-125).
   - Click on empty canvas (no prior drag) also calls `onClearSelection`.
   - A drag >3px suppresses the following click (RFC-030 §15 drag suppression).
   - A drag ≤3px does NOT suppress the following click (discriminating case).
   - Plain wheel pans the transform by exactly `-deltaX/-deltaY`; Ctrl/Cmd+wheel's manual-pan
     branch does not double-apply (two happy-dom environment gaps discovered and worked
     around with documented `TODO(...)` comments: `WheelEvent` doesn't forward
     `ctrlKey`/`metaKey` from its init dict, and `SVGPoint` lacks a working
     `matrixTransform()` that d3-zoom's own gesture code needs once the ctrl-wheel event is
     correctly routed to it — the test asserts only this repo's own contract, not d3-zoom's
     internal math, and cites the existing Playwright render-proof for the real-browser case).

3. **1.B (NodeCard dimming) had no dedicated test.** Added one case to the same file: toggling
   a flow chip dims a node outside the flow's `node_ids` and leaves a member node undimmed
   (verified against the fixture's real `flow.init` data).

## Verification

- `npx vitest run` (from `template/`): **485/485 passed**, 0 failures (baseline was 477;
  +8 net: −2 removed vacuous `probe.render.test.ts` cases, +6 `nav-contract.render.test.ts`,
  +2 `validate.test.ts` rule-15 cases, +2 from the second commit's NodeCard-dim addition —
  arithmetic reconciles against EVID-090's own +4 midpoint count before this fix-loop's
  further additions).
- `npx svelte-check --tsconfig ./tsconfig.json`: **0 errors / 1156 files**, 2 pre-existing
  a11y warnings on `ComposedMapView.svelte:375` (unrelated to this diff, present before
  EVID-089's audit even started).
- `git log --oneline -3` on `feat/idef0-composed-map`: `f2d8dc9` (NodeCard dim test) →
  `ff17ce1` (the 1.A/1.B/1.C fix + nav-contract suite) → `80c9015` (pre-fix checkpoint) —
  both new commits present, nothing left uncommitted in the working tree for these files.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test


