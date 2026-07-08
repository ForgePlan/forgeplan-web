---
depth: standard
id: RFC-034
kind: rfc
links:
- target: PRD-038
  relation: based_on
- target: ADR-010
  relation: based_on
- target: RFC-033
  relation: refines
status: active
title: 'Onboarding live-agent bridge (Pillar C): daemon + Agent SDK + show_on_map camera relay + two-tier chat'
---

## Status

draft

> **SPARC Architecture phase.** Architects **HOW** PRD-038 **Pillar C** (the live
> onboarding agent) is built, PRESUMING **ADR-010** (Agent SDK + daemon ship as a
> **separate optional npm package** `@forgeplan/web-agent`, launched by a
> spawn-only `bin/ onboard-agent` subcommand). Design is FIXED by FD-1..FD-7 —
> this RFC records the module/protocol/seam decisions underneath, it does not
> re-open the direction.

## Summary

Give the composed-map a **live local onboarding agent** without breaking the
package's two hardest invariants (rule 22 read-only web, rule 23 lean `bin/`).

A **localhost daemon-bridge** — shipped as the optional `@forgeplan/web-agent`
package (ADR-010), started by the user via `npx @forgeplan/web onboard-agent`
(a spawn-only `bin/` subcommand) — boots a **persistent Claude Agent SDK
session** in a **read-only profile** (Read/Glob/Grep + read-only forgeplan MCP;
Write/Edit/Bash denied), `cwd` = the project root, and binds a **WebSocket on
127.0.0.1 only**. The browser's new **`widgets/map-chat`** talks to that daemon
**directly** (not through `/api/*`, so rule 22 is untouched). The daemon
registers **one** SDK tool — `show_on_map(kind, id)` — and relays each call over
the WebSocket to the browser, which dispatches it to the **already-built tour
camera** (RFC-033). So the agent answers in prose **and** drives the map in one
turn.

The chat is **two-tier and graceful**: **Tier 0** answers client-side from the
already-loaded `map.json` (zone/node `description_ru`, auto-Connections from
edges, flows) — instant, model-free, offline, ~80% of onboarding questions; the
web **probes** for the daemon and **upgrades to Tier 1** (the live agent) when it
is present. No daemon → Tier 0 still works. No web `/api/*` change, no `map.json`
change, no core-package weight change.

## Motivation

PRD-038 Pillar C: the map should not just be *looked at* — a newcomer should be
able to **ask** "where does artifact recording live?" and get an answer that both
explains and **moves the camera** to the right zone/flow. Pillars A (comprehension
base) and B (deterministic tour camera) shipped; the camera exists (RFC-033:
`ComposedMapView.fitToRect` + the tour controller). Pillar C adds the *voice*: a
real Claude Code session, using the user's own subscription, reading the actual
repo + `.forgeplan/` + `map.json` — grounded, not hallucinated.

**Load-bearing constraints (why the design is shaped this way):**

- **Rule 22** keeps the SvelteKit server a read-only mirror — it *structurally
  cannot* spawn `claude`. The agent therefore lives in a **separate user-launched
  process**, and the browser talks to **it**, not to `/api/*`.
- **ADR-010** keeps the heavy Agent SDK out of the core `bin/` (rule 23): the
  daemon + SDK are the optional `@forgeplan/web-agent` package; `bin/` only
  `spawn`s it.
- **The camera already exists** (RFC-033). Pillar C **wires to** it via one new
  seam; it does not re-implement navigation.
- **Graceful degradation** is mandatory (FD-3 / PRD-038 NFR): the chat must be
  useful with **no** daemon (Tier 0), so the feature ships value before the user
  ever installs the agent package.

## Options Considered

The direction (local CC + Agent SDK + localhost daemon + read-only + one relayed
tool + two-tier chat) is FIXED (FD-1..7). Two implementation surfaces were
genuinely contested; both ADI cycles were run manually (`forgeplan_reason`
provider unavailable, same gap PRD-038/RFC-032/033 recorded).

### ADI cycle A — how the browser discovers the daemon's WebSocket

- **A1 — fixed default port + probe.** Daemon binds a fixed `127.0.0.1:<PORT>`
  (e.g. 7431); the web probes it (a `ready` frame / a tiny HTTP `GET /health`)
  and upgrades to Tier 1 on success.
- **A2 — discovery file.** Daemon writes `~/.forgeplan-web/agent.json`
  `{port, pid, protocolVersion, startedAt}`; the web reads it via a **read-only**
  `/api/*` mirror (like `/api/instances`) to learn the port, then connects
  directly to the daemon WS.
- **A3 — the SvelteKit server proxies the WS.** Rejected on sight: it would put
  the agent path back through `/api/*`, violating rule 22.

**Deduction / Induction.** A3 is out (rule 22). **A1 (fixed port + probe) is
chosen for the MVP** — zero new `/api/*` surface, simplest, and the port
collision risk is low + recoverable (the daemon fails loudly and suggests
`--port`). **A2 is recorded as the graduation path** (multi-instance / port-in-use
robustness) and reuses the existing `~/.forgeplan-web/` registry precedent
(PRD-027) — **OQ1**.

### ADI cycle B — the show_on_map camera seam into RFC-033

- **B1 — imperative store.** Add a tiny widget-scoped store with a
  `showOnMap({kind,id})` the chat writes and `ComposedMapView` `$effect`-reacts to
  by calling the existing `fitToRect` / select / highlight.
- **B2 — prop callback.** Thread an `onExternalTarget` prop down through
  HomePage → DependencyGraph → ComposedMapView.
- **B3 — custom DOM event.** `window.dispatchEvent(new CustomEvent('show-on-map'))`.

**Induction.** **B1 (a small dedicated store) is chosen** — it avoids threading a
prop through two shared, heavily-trafficked files (the same cost that deferred the
RFC-033 route auto-start), keeps the seam **testable in isolation**, and matches
the widget's existing rune-store patterns (`node-tabs.svelte.ts`,
`tour-state.ts`). The store exposes `showOnMap(target)`; `ComposedMapView`
consumes it and reuses `fitToRect` (zone) / node-select (node) / flow-highlight
(flow) — **no camera redesign**.

## Proposed Direction

### Module Breakdown

**Agent package — `@forgeplan/web-agent` (NEW, separate npm package; ADR-010):**

- **`bin/agent.mjs`** — the daemon entry. Boots the Agent SDK persistent session
  with the read-only profile, binds the 127.0.0.1 WebSocket, registers the
  `show_on_map` tool, and relays. This is where the third-party SDK dependency
  lives — never in the core `@forgeplan/web` `bin/`.
- **`lib/profile.mjs`** — the read-only agent profile: `allowedTools`
  Read/Glob/Grep + the read-only forgeplan MCP subcommands; `disallowedTools`
  Write/Edit/Bash. `cwd` = project root.
- **`lib/protocol.mjs`** — the versioned WebSocket message schema (shared shape,
  see contracts). One source of truth for both ends.
- **`lib/relay.mjs`** — pumps SDK stream-json events → WS frames (`token`,
  `show_on_map`, `done`, `error`) and WS `user_message` → the SDK session.

**Core `@forgeplan/web`:**

- **`bin/commands/onboard-agent.mjs`** (NEW, spawn-only) — resolves + `spawn`s the
  `@forgeplan/web-agent` binary (validates presence; on absence prints an
  actionable `npx @forgeplan/web-agent` / install hint, never a raw ENOENT). **No
  import of the agent package** (rule 23 grep must still pass). Registered in
  `bin/cli.mjs` (citty subcommand).

**Web (`template/`):**

- **`widgets/map-chat/` (NEW)** — the chat UI. `model/chat-store.svelte.ts`
  (messages, tier, daemon-status), `model/tier0.ts` (client-grounded answering
  from the loaded `MapDocument` — reuse the `MapNodePanel` connection derivation +
  flows + zone descriptions), `model/agent-client.ts` (the read-only WebSocket
  client: probe → connect → stream tokens → dispatch `show_on_map`), and
  `ui/MapChat.svelte` (composes `shared/ui`, rule 24).
- **`widgets/composed-map/model/camera-bus.svelte.ts` (NEW)** — the B1 store:
  `showOnMap(target)` + a `$state` current target; the ONE seam the chat uses to
  drive the camera.
- **`widgets/composed-map/ui/ComposedMapView.svelte` (CHANGED, small)** — consume
  `camera-bus`: on a new target, `fitToRect(zoneRect)` (zone) / select (node) /
  set `activeFlow` (flow), reusing the RFC-033/030 machinery. No `/api/*` touched.

### Component Diagram (prose)

`MapChat` (browser) owns the chat store. On mount it **probes** `127.0.0.1:<PORT>`
(A1). **No daemon** → the store stays **Tier 0**; a user question is answered by
`tier0.ts` purely from the loaded `MapDocument`. **Daemon present** → the store
flips to **Tier 1**; `agent-client.ts` opens the WebSocket to the daemon. A user
message goes `MapChat → agent-client → WS → daemon relay → Agent SDK session →
local Claude Code`. Claude reads the repo/`.forgeplan/`/`map.json` (read-only) and
streams back: prose `token` frames render in the chat; a `show_on_map` tool-call
becomes a WS frame that `agent-client` hands to `camera-bus.showOnMap(target)`,
which `ComposedMapView` reacts to by driving the **existing** tour camera. Data is
one-way per leg; the SvelteKit `/api/*` server is **never** in this path (rule 22).

### Data Flow

**Tier 0 (no daemon).** `MapChat` question → `tier0.answer(doc, q)` matches the
question against zone/node labels + `description_ru` + edges (auto-Connections) +
flows → renders an answer + optionally calls `camera-bus.showOnMap` to point the
map at the referenced zone/node. Zero network, zero model.

**Tier 1 (daemon up).** probe `ready` → Tier 1. Question → WS `{user_message}` →
daemon feeds the SDK session → stream: `{token}`* (streamed into the chat bubble),
`{show_on_map, target}` (→ `camera-bus`), `{done}`. Errors → `{error}` →
non-fatal chat notice + stay connected. The daemon holds ONE persistent session so
context accrues across questions.

**Probe / upgrade.** On mount + on an interval, the web checks the daemon health
frame; `up → Tier 1`, `down → Tier 0` (graceful, reversible mid-session).

### Function Signatures / Contracts

```ts
// @forgeplan/web-agent lib/protocol.mjs — the versioned WS schema (both ends)
type ClientMsg =
  | { type: "user_message"; text: string }
  | { type: "cancel" };
type ServerMsg =
  | { type: "ready"; protocolVersion: number; model: string }
  | { type: "token"; delta: string }
  | { type: "show_on_map"; target: { kind: "zone" | "node" | "flow"; id: string } }
  | { type: "done" }
  | { type: "error"; message: string };
```

```ts
// widgets/composed-map/model/camera-bus.svelte.ts — the B1 seam (NEW)
export type CameraTarget = { kind: "zone" | "node" | "flow"; id: string };
export function showOnMap(t: CameraTarget): void;     // chat writes
export function consumeCameraTarget(): CameraTarget | null; // view reacts (rune $state)
```

```ts
// widgets/map-chat/model/tier0.ts — client-grounded answering (NEW, pure)
export function answerFromMap(doc: MapDocument, question: string):
  { text: string; target?: CameraTarget };            // never throws; model-free
```

```ts
// widgets/map-chat/model/agent-client.ts — read-only WS client (NEW)
export function probeDaemon(port: number): Promise<{ up: boolean; model?: string }>;
export function connectAgent(port: number, handlers: {
  onToken(d: string): void; onShowOnMap(t: CameraTarget): void;
  onDone(): void; onError(m: string): void; onClose(): void;
}): { send(text: string): void; cancel(): void; close(): void };
```

```
bin/commands/onboard-agent.mjs  (core, spawn-only)
  - resolve @forgeplan/web-agent bin; if absent -> print install hint, exit 1
  - child_process.spawn(agentBin, ["--cwd", workspaceRoot, "--port", PORT], {stdio})
  - NO import of the agent package (rule 23)
```

### Rule invariants preserved

- **Rule 22**: no new `/api/*` mutation; the chat's live path is browser↔daemon,
  not browser↔SvelteKit. (If A2 discovery graduates, the only `/api/*` addition is
  a **read-only** `agent.json` mirror — a fresh amendment, OQ1.)
- **Rule 23 / ADR-010**: core `bin/` imports stay `node:*`+citty+siblings; the
  subcommand only `spawn`s.
- **Rule 24**: `MapChat` composes `shared/ui` primitives, no re-skin.

## Implementation Phases

- **Phase 1 — camera-bus seam + Tier 0 chat (web-only, ships value with NO
  daemon).** `camera-bus.svelte.ts`, `tier0.ts`, `MapChat.svelte` (Tier 0 mode),
  `ComposedMapView` consumes the bus. Unit-test tier0 answering + the bus.
- **Phase 2 — the agent package skeleton.** `@forgeplan/web-agent`:
  `protocol.mjs`, `profile.mjs` (read-only), `bin/agent.mjs` (WS bind + SDK
  session boot + `show_on_map` tool + relay). Use context7 for the real Agent SDK
  API. Smoke: daemon boots, binds 127.0.0.1, answers a canned question.
- **Phase 3 — spawn-only subcommand + probe/upgrade.** `bin/commands/onboard-agent.mjs`
  (+ cli registration), `agent-client.ts` (probe → connect → stream), Tier 0→1
  upgrade wiring. Rule-23 grep green.
- **Phase 4 — Prove.** Tier 0 offline demo; Tier 1 end-to-end (question → prose +
  camera move) on the real map; rule 22/23 verification greps; EVID linked
  `informs` before activation (rule 11, R_eff > 0).

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Localhost WS reachable by any local process / other browser tab | med | high | Bind 127.0.0.1 only; read-only agent profile (no write surface even if reached); daemon is user-launched + ephemeral; consider origin check / one-time token (OQ2) |
| Agent SDK version skew vs the daemon / model changes | med | med | `ready.protocolVersion`; web tolerates missing/old daemon by staying Tier 0 |
| Port already in use | med | low | Fail loudly with `--port`; A2 discovery-file graduation (OQ1) |
| Daemon crash / hang mid-answer | med | med | `agent-client` timeouts + `onClose` → revert to Tier 0; session disposable, relaunch cheap |
| rule 22 / 23 drift (agent routed through `/api/*` or SDK imported in core `bin/`) | low | high | Verification greps; the subcommand is spawn-only by contract |
| Tier 0 answers feel worse than Tier 1 → confusion | med | low | Clear tier affordance; Tier 0 is grounded (real `description_ru`), not guessed |

## Test Strategy Hooks

- **tier0.ts** — question→answer over a fixture doc: matches a zone by label; a
  node by path; returns a `target`; never throws; model-free.
- **camera-bus** — `showOnMap` then `consumeCameraTarget` round-trips; zone target
  → `fitToRect(zoneRect)`; node → select; flow → highlight.
- **protocol** — encode/decode every `ServerMsg`/`ClientMsg`; unknown type
  ignored; version negotiated.
- **agent-client** — probe up/down; token stream assembles; `show_on_map` frame →
  `onShowOnMap`; close → revert.
- **onboard-agent subcommand** — spawns the agent bin; absent → install hint +
  non-zero exit, no raw ENOENT; rule-23 grep over `bin/` still OK.
- **profile** — the SDK options deny Write/Edit/Bash and bind localhost.
- **Non-regression** — no `/api/*` change; the 9 views + drill-down + tour
  unchanged with the chat closed.

## Open Questions

- **OQ1 — daemon discovery.** MVP = fixed port + probe (A1); graduate to a
  `~/.forgeplan-web/agent.json` discovery file + a **read-only** `/api/agent`
  mirror (A2, rule-22 amendment) for multi-instance / port-in-use.
- **OQ2 — localhost auth.** Whether to add an origin check / one-time handshake
  token beyond 127.0.0.1-bind + read-only profile.
- **OQ3 — Tier-0 answering depth.** How far the model-free matcher goes before
  "ask the live agent" — measured, not guessed.
- **OQ4 — camera-target vocabulary.** The `show_on_map` `id` space depends on the
  map-pack **stable-id** fix (marketplace CM-02) — until node ids are
  altitude-stable, `show_on_map(node)` is best-effort.

## Related Artifacts

- **PRD-038** — parent (`based_on`); Pillar C, FD-1..FD-7, Q1..Q8.
- **ADR-010** — (`based_on`) the packaging decision this RFC presumes.
- **RFC-033** — (`refines`) the tour camera this agent drives via the new
  `camera-bus` seam; no camera redesign.
- **RFC-030 / SPEC-006** — the `forgeplan.map/v1` render contract Tier 0 reads.
- **Rule 22 / Rule 23 (ADR-003) / Rule 24** — the invariants this design keeps.
- **`docs/MAP-PACK-FINDINGS-FOR-MARKETPLACE.md`** — CM-02 (stable node ids) that
  `show_on_map(node)` depends on for precise deep targeting.
- **EvidencePack (pending)** — Tier-0 offline + Tier-1 end-to-end checkpoint,
  linked `informs` before activation (rule 11).



