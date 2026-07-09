---
depth: standard
id: RFC-035
kind: rfc
last_modified_at: 2026-07-07T11:18:04.582081+00:00
last_modified_by: claude-code/2.1.202
links:
- target: RFC-034
  relation: based_on
status: active
title: Chat panel v2 — floatable/dockable/resizable window + agent Info tab (status, model, settings, token usage, instance discovery)
---

## Summary

Extends the RFC-034 onboarding chat (Pillar C) from a fixed right-docked
drawer into a **floatable, dockable, resizable** chat window with a two-tab
layout (**Chat** + **Info**), a simplified status header (🟢 online / 🔴
offline), and an **Info tab** surfacing live agent diagnostics: model,
read-only settings, cumulative token usage (input/output), and how many
*other* forgeplan-web agent instances are running on the machine.

`based_on` RFC-034. The daemon lifecycle fix (lazy `query()` start + close
teardown + `fetch /health` probe, commit `e42040e`) is a prerequisite —
this RFC assumes the daemon no longer leaks subprocesses.

## Motivation

The chat is currently a fixed panel a user cannot move, cannot widen for a
long answer, and which exposes nothing about the agent behind it. Three
concrete user asks drive this RFC:

1. **Get it out of the way, keep it there.** The window must float (drag to
   move, stays where dropped) AND dock (pin to an edge), resizable in either
   mode — so it adapts to how the user is working with the map.
2. **Know at a glance if the agent is alive.** A compact 🟢 online / 🔴
   offline status, not a verbose model string.
3. **See what the agent is and what it costs.** An Info tab with model,
   settings, token usage (input/output), and cross-project awareness — "the
   info from the agent that helps me work." This turns the chat from a black
   box into an instrument panel, and is the concrete UI that justifies the
   protocol + registry work in FR-5/FR-6.

Without this, the agent's cost and capabilities stay invisible and the panel
stays in the user's way — friction that undercuts the onboarding value the
whole Pillar-C arc was built for.

## Context / Problem

Today the chat is a fixed panel pinned bottom/right. Users want to (a) move
it out of the way and keep it where they dropped it, (b) widen it for long
answers, and (c) see *what the agent is* — model, settings, cost — not just
its replies. None of that is visible today. The token-usage and
instance-count data physically do not reach the browser yet: the daemon
never forwards the SDK's `result.usage`, and the agent daemon is not in the
`~/.forgeplan-web/instances.json` registry that already powers the web
instance switcher (PRD-027 / RFC-023 / ADR-004).

## Proposed Direction

### FR-1 — Window: float + dock + resize (both modes)

The chat window supports BOTH placement modes, remembered across reloads:

- **Docked** (default): pinned to the right edge, as today. Drag the LEFT
  edge to resize width. Stays pinned.
- **Floating**: dragging the header detaches it into a free-floating window
  that moves with the pointer and stays where dropped. Drag any edge/corner
  to resize.
- **Re-dock**: dragging a floating window back onto the right edge snaps it
  back to docked (a snap zone ~24px from the edge), or an explicit dock/undock
  toggle in the header.
- Resize works in BOTH modes.

Persisted state (localStorage, one key, versioned): `{ mode: "docked" |
"floating", x, y, width, height }`. Clamp to the viewport on restore
(never restore off-screen). Min width/height enforced. Pointer-events use
Pointer Events API (pointerdown/move/up + setPointerCapture) — not
mouse-only — and are reduced-motion-aware. Keyboard: header is focusable;
Esc closes; the resize handle is operable (arrow keys nudge width) for a11y.

### FR-2 — Simplified status header

The header shows a compact status: a colored dot + word — **🟢 online** when
the daemon probe is up, **🔴 offline** when down. The verbose
"forgeplan-web-agent (claude-agent-sdk)" model string moves OUT of the header
into the Info tab (FR-4). Header also carries: New chat, sessions menu, the
Chat/Info tab switch, dock/undock toggle, close.

### FR-3 — Tabbed layout (Chat | Info)

The panel body is a two-tab surface using the existing `shared/ui` Tabs
primitive (rule 24 — compose, do not re-skin): **Chat** (the current
transcript + input) and **Info** (FR-4). Switching tabs never interrupts a
streaming answer; the Chat tab keeps its scroll position and in-flight state.

### FR-4 — Info tab (agent diagnostics)

The Info tab is a read-only diagnostics panel. Rows, each degrading
gracefully when its datum is unavailable:

- **Status**: online/offline + protocol version.
- **Model**: the agent label from the `ready` frame (moved from the header).
- **Settings**: the read-only profile — allowed tools (Read/Glob/Grep +
  show_on_map), disallowed (Write/Edit/Bash), workspace cwd. These are
  known/static from the daemon; surfaced verbatim.
- **Token usage** (FR-5 data): input tokens / output tokens, this session
  and cumulative for the connection. "—" until the first `usage` frame.
- **Other projects** (FR-6 data): "sees N other forgeplan-web agents" with a
  small list (project name + port). "0" / "just this one" when alone.

### FR-5 — Daemon forwards SDK token usage (protocol addition)

The Agent SDK's `result` message carries `usage` (input_tokens,
output_tokens, and cost fields). The daemon emits a new versioned frame
`{ type: "usage", inputTokens, outputTokens, costUsd? }` on each turn's
`result`, accumulated per connection. The web client sums per-session and
cumulative and renders them in the Info tab. Additive to the wire schema in
`agent/lib/protocol.mjs`; unknown frames already degrade to null on the web
side (forward-compatible). The `ready` frame is extended to advertise a
`capabilities`/`features` list so an older web build feature-detects the
`usage` frame instead of assuming it.

### FR-6 — Agent instance discovery (registry integration)

On start, the daemon registers itself in the existing
`~/.forgeplan-web/instances.json` registry via a NEW `kind: "agent"` row
(reusing `bin/lib/registry.mjs` `register`/`heartbeat`(30s tick)/`deregister`
/`sweepStale`/`isAlive`). The row shape mirrors the web-instance row plus
`kind`. The web client reads the registry (via a small read-only surface —
either the existing `/api/instances` extended with `kind`, or a dedicated
`ready`-time count) and shows the count of OTHER live agent rows in the Info
tab. Same liveness sweep (`process.kill(pid,0)` + heartbeat freshness) as
the web switcher — no new discovery mechanism.

## Alternatives considered

- **A1 — docked-resize only (no float).** Simpler, but the user explicitly
  wants "move it and leave it where dropped." Rejected as insufficient.
- **A2 — a bits-ui primitive for the window.** bits-ui has Dialog/ScrollArea
  but no draggable+resizable floating window; shadcn-svelte Resizable
  (paneforge) is for split panes, not a free-floating movable window. So the
  window shell is a hand-rolled `shared/ui` primitive, carrying a
  rule-24-bits-ui header justification (no upstream equivalent exists), and
  showcased on /playground per rule 24.
- **A3 — mDNS/UDP for instance discovery.** Heavier than the file registry
  that already exists and works same-machine. Rejected; reuse the registry.
- **A4 — token counting on the web side.** The browser cannot count tokens
  the model actually consumed; only the SDK `result.usage` is authoritative.
  Rejected; must come from the daemon.

## Function signatures / contracts

- `agent/lib/protocol.mjs`: add `usageMessage({inputTokens, outputTokens,
  costUsd?})` encoder + `decodeUsage`; extend `readyMessage` with
  `capabilities: string[]`. Additive; PROTOCOL_VERSION bump.
- `template/src/widgets/map-chat/model/agent-client.ts`: `AgentHandlers`
  gains optional `onUsage?(u)`; `ServerMsg` union gains `usage`; parse +
  route additively (unknown → null, unchanged).
- `template/src/widgets/map-chat/model/chat-store.svelte.ts`: window state
  (`mode/x/y/width/height` + persistence), tab state (`chat|info`), usage
  accumulators (session + cumulative), instance-count getter.
- New `shared/ui/<window-shell>/` primitive (drag/resize/dock) + barrel +
  `shared/ui/index.ts` re-export + `/playground` showcase (rule 24).
- `agent/bin/agent.mjs`: register/heartbeat/deregister with the registry on
  start/exit; emit `usage` on `result`; advertise capabilities on `ready`.

## Invariants

- **I1 — read-only preserved.** The Info tab and registry integration add NO
  mutation path; the agent daemon stays read-only (Read/Glob/Grep + show_on_map),
  rule 22 untouched (browser↔daemon direct, not via /api).
- **I2 — no subprocess regressions.** The window/tab/registry work must not
  reintroduce eager `query()` starts; a probe/idle window still spawns zero
  `claude` subprocesses (commit `e42040e` invariant holds).
- **I3 — forward-compatible wire.** New `usage`/`capabilities` are additive;
  an older web build ignores unknown frames (degrades to null), never crashes.
- **I4 — never restore off-screen.** Persisted floating geometry is always
  clamped to the current viewport on restore.
- **I5 — single registry writer.** Agent rows reuse `bin/lib/registry.mjs`'s
  atomic write + heartbeat reconcile; the web `/api/*` reader never mutates
  the registry (rule 22 verification for `/api/instances`).

## Implementation Phases

- **Wave 1 (web-only, no backend dep)**: FR-1 window (float/dock/resize +
  persistence), FR-2 status header, FR-3 tabs, FR-4 Info tab scaffold showing
  what's already known (status, model, settings). Ships visible value with
  zero daemon change. New `shared/ui` window primitive + /playground showcase.
- **Wave 2 (daemon/protocol)**: FR-5 usage frames + FR-6 registry
  integration → fills the Info tab's token + instance rows with live data.
  Protocol version bump + capabilities handshake + smoke coverage.

## Rollback Plan

- Wave 1 is pure web/localStorage; reverting the commits restores the fixed
  drawer with no data migration (a stale window-geometry key is ignored by a
  version guard, or cleared).
- Wave 2 is additive to the wire: if the `usage`/registry work regresses,
  revert the daemon commits — the web Info tab rows fall back to "—" / "just
  this one" via their graceful-degrade path (I3), and the chat keeps working.
- The registry rows self-expire via the existing heartbeat/`sweepStale`
  liveness so a rolled-back agent leaves no stale rows beyond the sweep window.

## Risks

- **Off-screen restore**: a persisted floating position can land off-screen
  after a monitor change — MUST clamp to viewport on restore (I4).
- **Registry contention**: agent + web instances writing the same
  `instances.json` — reuse the existing atomic-write + heartbeat reconcile;
  do not fork the writer (I5).
- **Rule 24**: the window shell MUST be a `shared/ui` primitive with a
  /playground showcase, not an inline widget hack, or the catalogue lies.
- **Pointer capture leaks**: a drag interrupted by a lost pointer MUST release
  capture on pointercancel; never wedge the UI.
- **Reduced motion / a11y**: drag+resize must be keyboard-operable and honor
  `prefers-reduced-motion`.

## Test strategy

- Unit (vitest): window-state persistence (save/restore/clamp-off-screen),
  dock↔float transitions, min-size clamp, tab switch preserves streaming,
  usage accumulation (session vs cumulative), instance-count getter, probe
  status → dot color. `usage` frame parse (present/absent/malformed → null).
- Daemon (smoke.mjs): `usage` frame round-trips protocol encode/decode;
  registry register→heartbeat→deregister lifecycle; capabilities on `ready`.
- Live (Playwright): drag-move persists position; drag-left-edge resizes;
  dock/undock; 🟢/🔴 flips with daemon up/down; Info tab shows model +
  settings; after a turn, token counts populate; instance count reflects a
  second daemon.
- svelte-check 0 errors; rule-24 grep (no `:global()` re-skin of primitive
  internals from map-chat).




