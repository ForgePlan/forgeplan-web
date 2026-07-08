---
depth: standard
id: EVID-096
kind: evidence
last_modified_at: 2026-07-06T15:34:34.875409+00:00
last_modified_by: claude-code/2.1.201
links:
- target: RFC-034
  relation: informs
status: active
title: 'Pillar C live agent works end-to-end: daemon + local CC answered grounded + drove show_on_map camera; 153 tests, smoke PASS'
---

## Status

draft

## Summary

Prove-phase checkpoint for **RFC-034** (Pillar C, the live onboarding agent) and its packaging
**ADR-010**. The live agent works **end-to-end**: the localhost daemon boots, a **real local Claude
Code session** (via the Agent SDK) answered a project question **grounded in the actual repo**, and
the model **called the `show_on_map` tool** which relayed a camera frame to the client. Plus 153
web-side tests, `svelte-check` 0, and the daemon smoke — all green.

## Observations (measured, 2026-07-06)

### Live end-to-end turn (the headline — a real model turn, not a mock)

Spawned the daemon: `node agent/bin/agent.mjs --cwd <repo> --port 7461` → printed
`onboard-agent live on ws://127.0.0.1:7461`. A WebSocket client connected, received
`{type:"ready", protocolVersion:1, model:"forgeplan-web-agent (claude-agent-sdk)"}`, and sent
*"What is this project and what is it for? … then use show_on_map to point at the most important
zone."* The daemon's persistent `query()` session streamed a **grounded** answer (verbatim):

> "**@forgeplan/web** is a tiny zero-install npm CLI that scaffolds a pre-built SvelteKit app into a
> project's `.forgeplan-web/` folder, then serves a read-only, force-directed map of that project's
> Forgeplan artifacts… run `npx @forgeplan/web start` and *see* a project's decisions and structure
> as an interactive graph — no install, no write access to the workspace."

— then emitted `{type:"show_on_map", target:{kind:"zone", id:"z.surfaces"}}`, then continued
narrating the zone flow (z.surfaces → z.core → z.ui, z.decisions records why) and offered to walk
deeper. Frames observed: `ready` → `token`* (streamed) → `show_on_map` → `token`* → `done`. The
answer is factually correct and sourced from the real repo — the read-only agent read the project.

### Automated + smoke (measured)

- `npx vitest run src/widgets/map-chat src/widgets/composed-map` → **14 files / 153 tests PASS**
  (Tier-0 tier0/chat-store/MapChat + Tier-1 agent-client/chat-store + camera-bus + tour + drill).
- `npx svelte-check` → **0 errors** (2 pre-existing a11y warnings on the map `<svg>`).
- `node agent/scripts/smoke.mjs` → **exit 0, ALL CHECKS PASS**: protocol round-trip; `buildOptions`
  denies Write/Edit/Bash + allows `mcp__onboard__show_on_map`; message-queue generator shape; daemon
  binds 127.0.0.1, `GET /health` responds, WS sends `{ready}`.
- Rule-23 allow-list grep over `bin/` → **OK** for all `.mjs` (the `onboard-agent` subcommand is
  spawn-only; no import of `@forgeplan/web-agent`; root `package.json` untouched).

### Invariants confirmed

- **ADR-010**: the Agent SDK + daemon live in the SEPARATE `@forgeplan/web-agent` package (its own
  deps `@anthropic-ai/claude-agent-sdk` ^0.3, `ws`, `zod`; own `node_modules`, gitignored). Core
  `bin/` unchanged in weight; the subcommand only `child_process.spawn`s the package.
- **Rule 22**: the live path is browser↔daemon over `ws://127.0.0.1`; the SvelteKit `/api/*` server
  is never involved.
- **Read-only**: `allowedTools` = Read/Glob/Grep + `show_on_map`; `disallowedTools` =
  Write/Edit/Bash; the model cannot mutate the workspace.

## Known scope boundary

- The daemon's `--port` default is 7431; the live turn above used 7461 (explicit). Port discovery
  (fixed-port probe vs a discovery file) is RFC-034 **OQ1**.
- `cancel` (abort mid-stream) and socket-closed-mid-tool-call are marked `TODO` (Phase-4 hardening),
  not blockers.
- `show_on_map(node)` precision depends on marketplace **CM-02** (stable node ids); `zone`/`flow`
  targeting (demonstrated) is exact.
- `@forgeplan/web-agent` is not yet published to npm — the subcommand's `npx` fallback is verified
  against the registry 404 only; re-verify post-publish.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Related Artifacts

- **RFC-034** (`informs`) — the daemon/protocol/camera/chat architecture this proves; activation
  gated on this checkpoint (rule 11, R_eff > 0).
- **ADR-010** — the packaging decision (separate optional package + spawn-only subcommand) this
  build realises and confirms.
- **RFC-033** — the tour camera the agent drives via the `camera-bus` seam (Phase 1).
- **PRD-038** — parent PRD (Pillar C, FD-1..FD-7).
- **`docs/MAP-PACK-FINDINGS-FOR-MARKETPLACE.md`** — CM-02 (stable node ids) for precise
  `show_on_map(node)`.


