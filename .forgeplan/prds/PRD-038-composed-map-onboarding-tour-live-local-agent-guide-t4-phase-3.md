---
depth: standard
id: PRD-038
kind: prd
last_modified_at: 2026-07-05T22:15:59.878886+00:00
last_modified_by: claude-code/2.1.201
links:
- target: EPIC-001
  relation: refines
- target: PRD-036
  relation: based_on
- target: PRD-037
  relation: based_on
status: draft
title: Composed-map onboarding tour + live local-agent guide (T4 Phase-3)
---

# PRD-038: Composed-map onboarding tour + live local-agent guide (T4 Phase-3)

> **Shaping note (SPARC Specification phase).** This is the SHAPE step. The user has **APPROVED** the
> architecture direction below; the fixed decisions are captured here as constraints and are **not
> re-opened**. An **RFC** (module topology, WebSocket message schema, daemon packaging) and an **ADR**
> (the `bin/` allow-list tension for the Agent SDK — see Open Questions Q1) **follow this PRD** and
> resolve the Open Questions. This PRD states capability + ship-or-not criteria only: functional
> requirements are phrased as observable behaviour; the fixed technical choices (local Claude Code, the
> Agent SDK, a localhost WebSocket, a read-only tool profile) live in **Fixed decisions** and
> **Constraints**, not baked into FR wording, per rule 11.
>
> **ADI note (HARD RULE 2).** `forgeplan_reason PRD-038` was invoked and returned *"LLM provider
> unavailable or not configured"* — the workspace MCP server is stale for reasoning (the same gap
> PRD-037 / RFC-031 recorded, despite the configured `claude-code/claude-opus-4-8` provider). The
> Abduction → Deduction → Induction cycle was therefore run **manually** over the three contested design
> surfaces before finalising the acceptance criteria; it is recorded in **§ ADI reasoning (manual)**
> below and folded into the FRs, Open Questions, and Risks.

## Problem

Phase 1 (PRD-036 / SPEC-006 / RFC-030) proved the composed-map renderer against a hand-written document
and shipped it as the 9th view with click-to-detail. Phase 2 (PRD-037 / RFC-031) made a large real map
navigable by drill-down (descend / climb / breadcrumb). Two gaps remain before the composed map delivers
its headline value — "a newcomer opens the project and *understands* it" (§17, §23; the user's "next big
thing"):

1. **Comprehension is still shallow at depth.** The Phase-1/2 map shows zones, cards, and edges, but a
   newcomer landing on a code-module node (a node with a `description_ru` but **no** `artifact_id`) has no
   detail affordance, and a drilled-into zone is laid out by the *client-derived* fallback
   (`deriveSubDocument`, RFC-031) even when `forgeplan-map-pack` v0.7.1 has already emitted a curated,
   architecture-quality per-zone layer at `.forgeplan/map/layers/<zone>.json`. The richer emitted layer
   is on disk and unused; and a zone with no emitted layer gives the user no way forward.

2. **There is no guided way in, and no live guide.** The map is a passive canvas: no calm onboarding
   surface that walks a newcomer zone-by-zone, and no conversational guide that answers "what is this
   system / where does Create live / how does the init flow work" grounded in the actual project. §17/§23
   fixed a `/onboard` route + tour + a chat, but only sketched the chat as client-side. The user has now
   fixed the full shape: a **two-tier** chat whose upper tier is a **live agent session** backed by the
   user's **own local Claude Code** — the project's real headline feature.

This is **Phase 3 of the T4 composed-map program** (§23 phased order: P0 render → drill/onboard → P2
onboarding → P3 chat). Parent: **EPIC-001 T4** ("composed graft", GATE-C), building directly on the
Phase-1 render-proof (**PRD-036**, which staged exactly this work as its FR-010 onboarding tour + FR-011
map-grounded chat) and the Phase-2 drill-down (**PRD-037 / RFC-031**, whose `deriveSubDocument` seam and
camera this feature reuses). Trigger: Phase-2 drill-down has landed and map-pack v0.7.1 now emits
architecture-quality zones/nodes with `description_ru`, 6+ flows, and per-zone generated layers — the
material a real guide needs.

**Load-bearing constraint that shapes the whole design (verified, §23 "Headless bridge"):** *a SvelteKit
route CANNOT spawn `claude`* — `template/src/shared/server/forgeplan.ts` only spawns the `forgeplan`
binary and refuses every subcommand outside `READ_ONLY_SUBCOMMANDS` (rule 22). The live agent therefore
cannot live in the web server. It lives in a **local daemon co-process the user starts explicitly** in
the project directory; the browser talks to it over a **localhost-bound WebSocket**; the SvelteKit server
stays a pure read-only file mirror and never learns the daemon exists.

## Goals

Observable outcomes, not implementation:

- **Goal 1 — Legible nodes at every altitude.** A newcomer clicking any node with a RU description
  (including a code-module node with no `artifact_id`) sees that description plus an accurate,
  auto-derived list of its connections; a node with an `artifact_id` still opens the right artifact tab.
- **Goal 2 — Curated depth when it exists, honest guidance when it does not.** Descending into a zone
  shows the map-pack-emitted layer when one exists (richer than the client-derived fallback), falls back
  to the derived sub-map when it does not, and — when the zone has no layer at all — tells the user
  plainly how to generate one.
- **Goal 3 — A calm way in.** A newcomer can open a dedicated onboarding surface that reuses the same map
  and takes a guided, camera-moving tour of the project, grounded in the map's real narration, with a
  legible first impression within a few seconds.
- **Goal 4 — A guide that always answers, and a live guide when invited.** The user can ask questions and
  always get a map-grounded, source-cited answer with zero setup and no model call; and — when they have
  explicitly started the local guide — get a real conversational agent that reasons over the project and
  moves the map's camera as it explains.
- **Goal 5 — No new trust surface, no regression.** The whole feature adds no browser-initiated forgeplan
  mutation and no ability to spawn an agent from the web server; the dashboard map, drill-down, and the 8
  other views behave exactly as before; the base (Tier-0) experience works fully offline and model-free.

## Non-Goals / Out of scope

- **Out of scope — the deeper-scan / append loop (PRD-036 FR-012 / ADR-008 / §23 "Phase 5").** This PRD's
  live agent is **read-only**: it never appends to `map.json`, never writes a job file, never triggers
  `/map-build --refresh`. The browser→job-file→`forgeplan map serve` write loop, its `POST
  /api/onboard/scan` carve-out, and the rule-22 **write** amendment stay a **separate, later,
  human-gated phase** (ADR-008, draft-only). The Tier-1 chat here is a distinct capability from that
  append loop and must not be conflated with it.
- **Out of scope — cloud / hosted anything.** No API keys in the web app or bundle, no cloud relay, no
  hosted inference. The only model access is the user's own local Claude Code, invoked by the local
  daemon (fixed decision).
- **Out of scope — multi-user / shared sessions.** The daemon serves the single local user on
  `127.0.0.1`; no auth server, no remote access, no multi-tenant session model.
- **Out of scope — the map-pack emitter itself.** Emitting `.forgeplan/map/layers/<zone>.json`,
  `description_ru`, flows, and the `/map-build-layer` command are `forgeplan-map-pack` (marketplace repo)
  concerns; this arc **consumes** those outputs and their contract, and changes no emitter code.
- **Out of scope — any `map.json` / layer schema change.** The feature reads the fields map-pack already
  emits; if a schema-level need surfaces it is an Open Question handed to a follow-on SPEC in the
  marketplace repo, never built here.
- **Out of scope — Agent SDK packaging decision.** *Where* the Agent SDK lands (given the `bin/`
  citty-only allow-list, ADR-003) is a genuine tension recorded as **Open Question Q1** with options; it
  is **not decided in this PRD** and is an ADR deliverable.
- **Out of scope — replacing or regressing any existing surface:** the 8 legacy views, the Phase-1 flat
  map, and the Phase-2 drill-down all behave unchanged.
- **Out of scope — animation/motion polish** beyond "works + honors reduced-motion": FLIP transitions,
  easing curves, fly-in of a revealed sub-level are deferred.

## Target users / actors

- **Newcomer** on a large forgeplan-instrumented workspace — primary consumer; needs the guided tour, the
  legible node cards, and a guide that answers "what is this / where does X live".
- **Returning maintainer** — opens the map to a specific zone, reads the curated emitted layer, asks the
  guide a grounded question, climbs out.
- **Curator / map author (human)** — runs `/map-build-layer "<zone>"` to generate the emitted layer a
  zone is missing; verifies narration reads from real docs.
- **The composed-map view (system actor)** — reuses the same `ComposedMap` widget across the dashboard
  host and the `/onboard` host; owns the tour state machine and the chat panel.
- **The read-only `/api/map/layers/<zone>` endpoint (system actor)** — GET-only file mirror of an emitted
  layer; the **only** new server surface in this arc.
- **The local guide daemon (system actor, external to the SvelteKit server)** — a user-started
  co-process that runs the Agent SDK against local Claude Code with a read-only tool profile, binds
  `127.0.0.1`, and relays `show_on_map` over a localhost WebSocket to the browser.
- **The browser client (system actor)** — probes the daemon's localhost port directly (never via a
  SvelteKit route) and lights up Tier-1 chat when the daemon answers.
- **Reviewer / guardian agents** — verify rule-22 read-only compliance, the no-secrets-in-bundle
  property, and the read-only tool profile from the diff.

## Fixed decisions (constraints, not options — do NOT re-open)

These are the user's approved architecture choices, baked in as constraints:

- **FD-1 — Local model only.** The live agent uses the user's **own local Claude Code** installation. No
  API keys in the web app, no cloud relay, no hosted inference.
- **FD-2 — Reuse the existing protocol.** The bridge uses the **Claude Agent SDK**
  (`@anthropic-ai/claude-agent-sdk`: stream-json over stdio, custom in-process MCP tools, permission
  profiles) as the agent protocol — no new protocol is invented.
- **FD-3 — The web consumes ready-made things.** The SvelteKit server stays a **read-only proxy** (rule
  22 untouched — it never spawns `claude`). The agent lives in a **local daemon co-process** the user
  starts explicitly in the project directory. Browser ⇄ daemon is a **localhost-bound WebSocket**. The
  web **detects** the daemon via a probe and lights the chat up.
- **FD-4 — Read-only agent profile.** The Tier-1 agent runs with a read-only tool profile: `Read` /
  `Glob` / `Grep` + the read-only forgeplan MCP; `Write` / `Edit` / `Bash` are **denied**.
- **FD-5 — One relayed tool.** The daemon exposes exactly **one** custom SDK tool,
  `show_on_map(zone|node|flow)`, which it relays over the WebSocket to the browser so the camera moves
  while the agent narrates.
- **FD-6 — Prefer-emitted-with-fallback.** On descend, prefer the map-pack-emitted
  `.forgeplan/map/layers/<zone>.json` over the client-derived `deriveSubDocument` fallback (the RFC-031
  seam).
- **FD-7 — Language rule (§15).** Card/zone **labels are EN**, verbatim; **descriptions and narration are
  RU**. Never fabricate narration — a source-less zone/node is shown without narration, never faked.

## Functional Requirements

Capability language only; component/file mapping is informative and lives in Constraints → Affected
surfaces. Priorities: `must` / `should` / `could`. FRs are grouped by the three pillars.

### Pillar A — Comprehension base

### FR-001 — Node detail card for described nodes (incl. code-module nodes)
- **Description**: Clicking a node that carries a RU description shall show that description plus an
  **auto-derived "Connections" list** (`→ target (relation)` / `← source (relation)`) computed from the
  document's `edges[]` — never hand-written. A node that also carries an `artifact_id` shall continue to
  open the corresponding artifact in the right-hand tab; a node with a description but no `artifact_id` (a
  code-module node) shall still get the full detail card.
- **Priority**: must
- **Acceptance criteria**:
  - Given a code-module node with a `description_ru` and no `artifact_id`, when clicked, then the detail
    surface shows its RU description and a Connections list whose entries match exactly the edges incident
    to that node in the document.
  - Given a node with an `artifact_id`, when clicked, then the right-hand artifact tab opens that
    artifact, unchanged from Phase-1/2 behaviour.

### FR-002 — Render map-pack-emitted per-zone layers on descend
- **Description**: On descending into a zone, the system shall **prefer the emitted layer document**
  retrieved from the workspace path `.forgeplan/map/layers/<zone>.json` over the client-derived
  `deriveSubDocument` fallback (FD-6; the RFC-031 seam). The emitted layer shall be retrieved via a new
  **GET-only, read-only** endpoint `/api/map/layers/<zone>` (mirroring the `/api/map` read-only pattern;
  requires a **read-only** rule-22 allow-list amendment — see Constraints → Governance, distinct from
  ADR-008's write amendment). When no emitted layer exists for the zone, the system shall fall back to the
  client-derived sub-map (unchanged RFC-031 behaviour).
- **Priority**: must
- **Acceptance criteria**:
  - Given a zone with an emitted `.forgeplan/map/layers/<zone>.json`, when the user descends into it, then
    the rendered sub-map is driven by the emitted layer (not the client-derived fallback), verified by a
    distinguishing fixture before the arc PR merges.
  - Given a zone with no emitted layer, when the user descends into it, then the client-derived
    `deriveSubDocument` sub-map renders exactly as in Phase 2 (no regression).
  - Given a request to `/api/map/layers/<zone>`, when reviewed, then the endpoint is GET-only, performs no
    spawn / write / network, and rule-22 verification greps report 0 new mutating call sites.

### FR-003 — Honest empty-state for a zone with no emitted layer
- **Description**: When a zone has no emitted layer, in addition to the client-derived fallback the system
  shall surface a **copyable command hint** `/map-build-layer "<zone>"` (mirroring the existing
  `/map-build` empty-state pattern) so the user can generate the curated layer out-of-band. The hint shall
  never be shown as an error and shall never block the fallback render.
- **Priority**: should
- **Acceptance criteria**:
  - Given a zone with no emitted layer, when the user descends into it, then a copyable
    `/map-build-layer "<zone>"` hint is presented alongside the fallback sub-map, and copying it yields
    exactly that string with the real zone id substituted.

### Pillar B — `/onboard` route + tour

### FR-004 — Separate `/onboard` route reusing the same map widget
- **Description**: The system shall provide a separate, full-bleed **calm-chrome** onboarding route
  (`/onboard`: project name from `map.meta`, an "Exit to standard view →" affordance, no Filters/Insights
  rail) that reuses the **same `ComposedMap` widget** that backs the dashboard's 9th view (one widget, two
  hosts — §23). The route shall be **additive**: the dashboard map, drill-down, and the 8 other views are
  untouched.
- **Priority**: must
- **Acceptance criteria**:
  - Given a valid map document, when the user opens `/onboard`, then the same composed map renders inside
    the calm onboarding chrome, and the dashboard view and 8 legacy views render identically to the base
    branch.

### FR-005 — Data-driven guided tour (deterministic, no model)
- **Description**: The onboarding route shall run a **data-driven tour state machine** (a small state
  machine, not a framework) that reads data **already in the map** (`composition.entry_zone`, the
  `zones[]` reading order, `flows[]`, `zone_connectors[]`) and drives the existing camera zone-by-zone
  with short tweens (~600 ms). Narration shall be the map's RU descriptions (`description_ru`); a
  zone/node with no sourced narration shall be shown **without** narration (the tour skips its narration),
  never fabricated (FD-7). The tour shall be **deterministic** and require **no model call**.
- **Priority**: must
- **Acceptance criteria**:
  - Given a map with an `entry_zone`, a reading order, and at least one flow, when the tour runs, then the
    camera visits the zones in reading order and narrates each from its `description_ru`, and a zone with
    no `description_ru` is visited without any fabricated narration.
  - Given the same map, when the tour is run twice, then the visited sequence and narration are identical
    (deterministic, no model).

### FR-006 — Tour is a suggestion; user drives; accessible first impression
- **Description**: The tour shall be interruptible: **any canvas click pauses** it (the user drives);
  **Esc / "I got it" / reaching the last zone** exits to free browse; a **reduced-motion** preference
  shall snap with 0 ms motion and start the tour **paused**. The first impression shall be **legible
  within a few seconds** — mega-nodes collapsed, a bounded visible node set, zoom-to-fit the whole map
  (§23 target: < 3 s).
- **Priority**: must
- **Acceptance criteria**:
  - Given the tour is running, when the user clicks the canvas, then the tour pauses and the click's
    normal select/pan behaviour applies; when the user presses Esc or activates "I got it" or the tour
    reaches the last zone, then the view is in free-browse mode.
  - Given a reduced-motion preference, when `/onboard` loads, then camera moves are 0 ms snaps and the
    tour starts paused.
  - Given the checkpoint/real map, when `/onboard` first paints, then the whole map is fit to view with
    mega-nodes collapsed, within the §23 first-impression budget (target < 3 s; measured value recorded in
    the prove-phase EvidencePack).

### Pillar C — Live agent chat (`widgets/map-chat`), two tiers

### FR-007 — Tier 0: client-side, map-grounded chat (always available, no model)
- **Description**: The chat panel shall answer questions **client-side from the loaded `map.json`** (zone
  and node RU descriptions, auto-derived Connections, flows) — instant, no model call, no write, works
  fully offline. Every answer shall **cite its source inline** (e.g. `→ ADR-003`, `z.storage`,
  `…/projection/mod.rs`). An answer that cannot be grounded shall say so honestly and offer a deeper scan
  instead of guessing (e.g. "недостаточно данных — запусти глубокий скан?") — never a confident
  hallucination. The chat may **move the camera** ("покажи Create" → `tour.go`).
- **Priority**: must
- **Acceptance criteria**:
  - Given a question answerable from the loaded map, when the user asks it with no daemon running, then
    the answer is produced client-side with no model call and cites at least one inline source present in
    the document.
  - Given a question not groundable in the map, when asked, then the reply honestly states the data gap
    and offers a deeper scan, and makes no unsourced factual claim.
  - Given a question naming a flow or zone present in the map, when asked, then the chat can move the
    camera to it.

### FR-008 — Daemon detection probe (browser-side, not a server route)
- **Description**: The web client shall **detect** the local guide daemon by probing its localhost port
  **directly from the browser** — **not** via any SvelteKit route (keeping the SvelteKit server a pure
  read-only file mirror, rule 22). When the daemon answers the probe, the client shall light up Tier-1
  chat; when it does not, the chat shall remain fully functional at Tier 0 and present an honest
  "live guide not detected" state.
- **Priority**: must
- **Acceptance criteria**:
  - Given no daemon running, when the app loads, then no SvelteKit route is used to probe, Tier-1 stays
    dark, and Tier-0 chat works fully.
  - Given the daemon running and reachable on its localhost port, when the client probes, then Tier-1 chat
    becomes available.

### FR-009 — Tier 1: live agent session via the local daemon (read-only)
- **Description**: When the daemon is detected, the chat shall offer a **real agent session**: the daemon
  runs the Agent SDK (FD-2) against the user's **local Claude Code** (FD-1) in the project working
  directory with a **read-only tool profile** (`Read`/`Glob`/`Grep` + read-only forgeplan MCP;
  `Write`/`Edit`/`Bash` denied — FD-4). Browser ⇄ daemon messages flow over the **localhost-bound
  WebSocket** (FD-3). The agent shall ground its answers in `map.json` + emitted layers + `.forgeplan` +
  code. No secrets shall appear in the web bundle.
- **Priority**: must
- **Acceptance criteria**:
  - Given a running daemon, when the user sends a Tier-1 message, then a live agent session answers over
    the WebSocket, and the agent's tool profile denies `Write`/`Edit`/`Bash` (verified against the daemon
    permission profile).
  - Given the shipped web bundle, when scanned, then it contains no API keys or agent credentials (no
    secrets in the bundle).
  - Given the daemon, when started, then it binds `127.0.0.1` only (verified from the bind configuration).

### FR-010 — `show_on_map` tool relays camera moves over the WebSocket
- **Description**: The daemon shall expose exactly **one** custom SDK tool, `show_on_map(zone|node|flow)`
  (FD-5). When the agent calls it, the daemon shall relay the target over the WebSocket to the browser,
  which shall move the camera to that zone/node/flow **while the agent narrates** — so explanation and
  camera motion are coupled.
- **Priority**: must
- **Acceptance criteria**:
  - Given a Tier-1 session, when the agent calls `show_on_map` with a zone/node/flow id present in the
    map, then the browser camera moves to that target and the agent's narration for it is shown together.
  - Given `show_on_map` called with an id not present in the loaded map, when relayed, then the client
    degrades honestly (no camera jump to a non-existent target, no crash).

### FR-011 — Guided onboarding mode (agent walks the newcomer through the project)
- **Description**: The Tier-1 agent shall support a **guided onboarding mode** in which it walks a
  newcomer through the project step by step — grounded in `map.json` + emitted layers + `.forgeplan` +
  code — using `show_on_map` to move the camera as it explains each step.
- **Priority**: should
- **Acceptance criteria**:
  - Given a running daemon and a "walk me through the project" request, when guided mode runs, then the
    agent narrates the project in ordered steps and drives the camera via `show_on_map` at each step,
    grounded in real project data (no fabricated structure).

## Non-Functional Requirements

### NFR-001 — Governance / security (rule 22 + local-only + read-only agent)
- **Category**: security
- **Threshold**: the SvelteKit server adds **exactly one** new endpoint, the GET-only read-only
  `/api/map/layers/<zone>` mirror; **0** browser-initiated forgeplan mutations; **0** ability to spawn an
  agent from the web server; the daemon binds `127.0.0.1` only; the Tier-1 agent profile denies
  `Write`/`Edit`/`Bash`; **0** secrets in the web bundle; the daemon probe is browser-side (no SvelteKit
  route).
- **Measurement**: rule-22 verification greps (spawn/execFile/fetch/write scans over route + shared/server
  files); grep the built bundle for key/token patterns; inspect the daemon bind config and the agent
  permission profile; reviewer diff check before merge.

### NFR-002 — Non-regression
- **Category**: reliability
- **Threshold**: all pre-existing template static checks and tests stay green; the dashboard map, the
  Phase-2 drill-down, and the 8 legacy views behave unchanged; Tier-0 chat + the tour work fully offline /
  model-free.
- **Measurement**: CI `svelte-check` (0 errors) + unit suite (0 failures); manual smoke across all view
  ids + the drill-down path; an offline run exercising the tour + Tier-0 chat with no daemon.

### NFR-003 — Determinism & honesty of the tour and Tier-0 chat
- **Category**: reliability
- **Threshold**: the tour visits the same sequence with the same narration on every run (no model);
  Tier-0 answers are reproducible from the loaded document; no fabricated narration at any point (FD-7).
- **Measurement**: unit tests over the tour state machine (same map → same script) + the Tier-0 grounding
  layer (grounded answer cites a real source; ungroundable → honest fallback, no unsourced claim).

### NFR-004 — Accessibility, theming, language
- **Category**: accessibility
- **Threshold**: EN labels + RU descriptions/narration (FD-7, §15); reduced-motion honored on the tour and
  camera moves; chat panel and tour controls keyboard-reachable; 0 raw color literals in new components
  (token-only, dual-theme; neutral zones §16 preserved at every altitude).
- **Measurement**: manual keyboard + reduced-motion pass on `/onboard`; grep for hex/rgb literals in new
  components; language-rule review of narration surfaces.

### NFR-005 — Responsiveness
- **Category**: performance
- **Threshold**: `/onboard` first impression legible within the §23 budget (target **< 3 s** on the
  reference machine); emitted-layer fetch + render on descend within **TBD ms**; Tier-1 first-token
  latency **TBD** (bounded by the local model; measured, not invented). Tier-0 answers present with **no**
  model call (perceived-instant).
- **Measurement**: manual timing on the real map at prove-phase, recorded in the EvidencePack (CL3
  measurement); the TBD budgets are set from the measured baseline in the RFC, never guessed.

## Constraints

### Technical
- **A SvelteKit route cannot spawn `claude`** (verified, §23; `READ_ONLY_SUBCOMMANDS` in
  `template/src/shared/server/forgeplan.ts`). The live agent lives in the local daemon; the web server
  never spawns it (FD-3).
- **`bin/` allow-list tension (ADR-003 / rule 23).** `bin/` is restricted to `node:*` + `citty`; the Agent
  SDK **cannot** land in `bin/`. Where the daemon and the SDK live is therefore a **real** packaging
  question recorded as **Open Question Q1** (options weighed there) — **not decided in this PRD**.
- **Rule 22 read-only.** The only new server surface is the GET-only `/api/map/layers/<zone>` file mirror,
  which needs a **read-only** allow-list amendment to `.claude/rules/22-readonly-proxy.md` (mirroring the
  `/api/map` and `/api/instances` precedents) — categorically distinct from **ADR-008**'s human-gated
  **write** amendment for the append loop. The daemon probe is **browser-side**, not a server route, so it
  adds no SvelteKit surface at all.
- **Reuse, don't fork:** the `/onboard` route reuses the same `ComposedMap` widget as the dashboard's 9th
  view; the emitted-layer path reuses the RFC-031 `deriveSubDocument` seam as its fallback; the tour + the
  Tier-0/Tier-1 chat drive the existing d3-zoom camera and Phase-2 drill/select wiring.
- **Language rule (§15 / FD-7):** labels EN, descriptions + narration RU; never fabricate narration.
- **Determinism:** the tour and Tier-0 chat are deterministic and model-free; per-altitude no-x/y +
  pinned-cols + append-stability (SPEC-006 C3, PRD-037) hold for any emitted-layer render too.

### Affected surfaces (informative, from §17/§23 + RFC-030/RFC-031 — not requirements)
- New: `routes/api/map/layers/[zone]/+server.ts` (GET, file read of `.forgeplan/map/layers/<zone>.json`,
  ENOENT → empty), the matching `shared/server` read helper, a `/onboard` route + calm chrome, a tour
  state machine + `ComposedPanel` node/zone detail extension in `widgets/composed-map`, `widgets/map-chat`
  (Tier-0 grounding + Tier-1 WebSocket client + daemon probe), and the local guide daemon (packaging per
  Q1).
- Touched: `.claude/rules/22-readonly-proxy.md` (read-only allow-list amendment, build wave); the map
  entity poller/layer wiring; app stylesheet tokens for the chat/onboarding chrome.
- Out of this repo: the `forgeplan-map-pack` emitter (`.forgeplan/map/layers/*.json`, `description_ru`,
  flows, `/map-build-layer`) and the local Claude Code binary.

### Business
- Build order fixed by §23: render-proof (done) → drill/onboard (done) → **onboarding + chat (this)** →
  append loop (later, ADR-008-gated). This is **T4 Phase-3**.
- The RFC (topology + WebSocket schema + daemon packaging) and an ADR (Q1 `bin/` allow-list) **follow this
  PRD**. Activation of this PRD is the orchestrator's, after an EvidencePack (rule 11, R_eff > 0) — the
  author leaves it `draft`.

### Regulatory
- None external. Internal bars: local-only (no data leaves the machine beyond the user's own local model
  invocation), no secrets in the bundle, reduced-motion + keyboard reachability, neutral token-only
  theming.

## SMART Acceptance Criteria (Phase-3 — ship-or-not for this arc)

Each is Specific, Measurable, Achievable, Relevant, and Time-bound (bound to the Phase-3 arc PR, matching
the repo convention in PRD-036 / PRD-037).

1. **AC-1 — comprehension base (FR-001, FR-002, FR-003):** On the real map-pack v0.7.1 map, clicking a
   code-module node (RU description, no `artifact_id`) shows its RU description + an edge-derived
   Connections list; descending into a zone with an emitted `.forgeplan/map/layers/<zone>.json` renders
   the emitted layer (a distinguishing fixture proves it beat the client-derived fallback); descending
   into a zone with no layer renders the fallback plus a copyable `/map-build-layer "<zone>"` hint — all
   demonstrated end-to-end before the arc PR merges.
2. **AC-2 — onboarding tour (FR-004, FR-005, FR-006):** `/onboard` renders the same map in calm chrome and
   runs a deterministic, model-free tour that visits zones in reading order narrating from `description_ru`
   (source-less zones un-narrated, never faked), pauses on any canvas click, exits on Esc / "I got it" /
   last zone, snaps at 0 ms + starts paused under reduced-motion, and fits the whole map on first paint —
   verified (determinism by unit test; behaviour + first-impression timing by manual pass recorded in the
   EVID) before the arc PR merges.
3. **AC-3 — two-tier live guide (FR-007..FR-011):** With no daemon, Tier-0 chat answers map-grounded
   questions client-side with inline source citations, honestly refuses ungroundable questions, and can
   move the camera — fully offline. With the user-started daemon detected (browser-side probe), Tier-1
   runs a live read-only agent session against local Claude Code (profile denies `Write`/`Edit`/`Bash`,
   daemon binds `127.0.0.1`) whose `show_on_map` tool moves the camera while it narrates — demonstrated
   end-to-end, with the read-only profile and `127.0.0.1` bind verified, before the arc PR merges.
4. **AC-4 — governance & no-regression (NFR-001, NFR-002):** rule-22 greps report the only new endpoint is
   the GET-only `/api/map/layers/<zone>` mirror with 0 spawn/write/network; the built bundle contains no
   secrets; the daemon probe uses no SvelteKit route; and the dashboard map, drill-down, and 8 legacy
   views render exactly as on the base branch — verified in CI/review before the arc PR merges.
5. **AC-5 — quality gate:** `svelte-check` reports 0 errors and the unit suite (`vitest`) reports 0
   failures on the arc branch at PR time.

## ADI reasoning (manual — `forgeplan_reason` unavailable)

Manual Abduction → Deduction → Induction over the three genuinely contested surfaces (the fixed decisions
FD-1..FD-7 are inputs, not re-litigated here). Hidden assumptions surfaced and conflicts flagged:

### Cycle 1 — Live-agent topology (where the agent process lives)
- **Abduction.** H1: local user-started daemon co-process, browser⇄daemon over localhost WebSocket. H2:
  the SvelteKit server spawns `claude`. H3: a cloud relay holding API keys.
- **Deduction.** H2 is **impossible** — verified: the web server refuses every non-read-only subcommand
  and only spawns the `forgeplan` binary (rule 22, `READ_ONLY_SUBCOMMANDS`). H3 is **refused** by FD-1 (no
  keys, no cloud) and leaks data off-machine. H1 keeps the web server a pure read-only mirror, keeps all
  model access on the user's own machine, and matches FD-3.
- **Induction.** **H1 (fixed).** Hidden assumption surfaced: the browser must reach the daemon **without**
  a SvelteKit route, or the server re-enters the trust surface — hence FR-008's browser-side probe.

### Cycle 2 — Chat grounding model (one tier vs two)
- **Abduction.** H1: two tiers — Tier-0 client-side grounded (always on, no model) + Tier-1 live agent
  (when daemon present). H2: agent-only. H3: client-only.
- **Deduction.** H2 breaks Goal 5 / NFR-002 "works fully offline, model-free" and makes the base
  experience depend on a user-started process. H3 loses the guided, reasoning walkthrough the user's
  headline feature needs. H1 gives an always-available honest baseline **and** a live superset.
- **Induction.** **H1 (two-tier).** Conflict flagged (**C-1**): PRD-036 FR-011 framed the chat as
  "client-side, no model call". This PRD **extends** that: Tier-0 preserves the no-model guarantee
  verbatim; Tier-1 is the model-backed superset, gated on an explicitly user-started daemon and read-only.

### Cycle 3 — Sub-level data source for comprehension (emitted vs derived)
- **Abduction.** H1: prefer emitted `.forgeplan/map/layers/<zone>.json`, fall back to client-derived
  `deriveSubDocument`. H2: always client-derived. H3: always emitted.
- **Deduction.** H2 ignores the richer curated layer already on disk (v0.7.1) — comprehension loss. H3
  dead-ends on a zone with no emitted layer. H1 uses the best available and degrades honestly (the
  `/map-build-layer` hint).
- **Induction.** **H1 (prefer-emitted-with-fallback, FD-6).** Hidden assumption surfaced: reading the
  emitted layer needs a **new server surface** — resolved as a GET-only read-only mirror (FR-002), a
  read-only rule-22 amendment, **not** ADR-008's write amendment.

### Conflicts flagged (carried into Open Questions / Risks)
- **C-1** (Cycle 2): PRD-036 FR-011 "no model call" vs Tier-1's real model call — resolved by tiering.
- **C-2**: rule 23 / ADR-003 (`bin/` = citty only) vs the Agent SDK needing to run locally — the daemon
  **cannot** live in `bin/`; packaging unresolved → **Q1** (options, no decision here).
- **C-3**: the deterministic tour (drives the camera) vs the Tier-1 agent's `show_on_map` (also drives the
  camera) — interplay/hand-off unresolved → **Q4**.
- **C-4**: this Tier-1 read-only live chat vs the ADR-008 append/write loop — kept strictly separate
  (Non-Goals); the read-only `/api/map/layers` amendment must not be conflated with ADR-008's write
  amendment.

## Open Questions

Handed to the T4 Phase-3 **RFC** and **ADR**:

- **Q1 (daemon / Agent SDK packaging — the `bin/` allow-list tension) — ADR.** ADR-003 caps root deps at
  `citty`; the Agent SDK cannot land in `bin/`. Options the RFC/ADR must weigh — **(a)** a separate,
  optional npm package for the daemon; **(b)** a bundled `dist-agent/` image (esbuild-inlined like the
  existing `dist*` images); **(c)** a new ADR amending the ADR-003 allow-list. **No decision in this
  PRD.** — owner: ADR (with the RFC).
- **Q2 (browser⇄daemon WebSocket message schema).** Handshake, `show_on_map` relay frames, narration
  streaming, error frames, versioning of the protocol. — owner: RFC.
- **Q3 (daemon-probe UX).** Which localhost port, how the browser discovers it, the handshake, retry
  cadence, and the "not detected" affordance / how the web lights the chat up. — owner: RFC.
- **Q4 (tour-vs-agent interplay).** When both the deterministic tour and the Tier-1 agent guided mode want
  the camera, who drives and how they hand off (does starting Tier-1 guided mode suspend the tour?). —
  owner: RFC.
- **Q5 (daemon start mechanism).** A `bin/` subcommand (e.g. `forgeplan-web agent`) vs a separately-run
  script — interacts with Q1's packaging choice. — owner: RFC/ADR.
- **Q6 (emitted-layer freshness / caching).** How `/api/map/layers/<zone>` staleness relates to
  `map.json`'s `meta.version`; caching + poll cadence; behaviour when a layer is regenerated
  out-of-band. — owner: RFC.
- **Q7 (Tier-1 latency budget).** First-token target + descend-render budget for NFR-005 — measured on the
  real map and recorded in the EVID, not invented here. — owner: RFC + EVID.
- **Q8 (read-only forgeplan MCP surface for the Tier-1 agent).** Exactly which read-only forgeplan MCP
  tools the agent profile allows (list/get/graph/score…), and confirming none can mutate. — owner: RFC.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tier-1 conflated with the ADR-008 append/write loop → an unintended write surface slips in | med | high | Non-Goals fix Tier-1 as **read-only** (FD-4); the only new server surface is the GET-only `/api/map/layers` mirror; ADR-008's write amendment stays a separate human-gated phase; rule-22 greps in AC-4 |
| Agent SDK can't live in `bin/` (ADR-003) → packaging forced late or a rule bent under pressure | high | med | Recorded as **Q1** with three concrete options; ADR decides before build; the daemon is out-of-`bin/` by construction |
| Daemon probe implemented as a SvelteKit route → server re-enters the trust surface | med | high | FR-008 fixes the probe as **browser-side**; NFR-001 greps assert no new server route beyond `/api/map/layers` |
| Secrets (local model / SDK) leak into the shipped web bundle | low | high | FD-1 (local model, no keys) + FR-009 AC (bundle secret-scan); the daemon holds no cloud credentials |
| Tour and Tier-1 agent both grab the camera → jitter / fight | med | med | **Q4** owns the hand-off; the tour is a suggestion that any interaction pauses (FR-006); guided mode's camera is `show_on_map`-driven |
| Narration fabricated when a zone has no `description_ru` | low | high | FD-7 + FR-005/NFR-003: source-less zones shown without narration, tested; the emitter (map-pack) owns real narration |
| Emitted-layer path drifts from the client-derived fallback → inconsistent depth UX | med | low | FR-002 keeps the RFC-031 fallback verbatim; a distinguishing fixture proves prefer-emitted; parity smoke on a no-layer zone |
| Tier-1 latency on a large local model feels slow | med | med | Tier-0 is the perceived-instant baseline; Tier-1 latency measured + budgeted in EVID (Q7), not assumed; guided mode streams narration with camera moves |
| `bin/` daemon-start subcommand tempts adding SDK deps to `bin/` (rule 23) | low | high | Q1/Q5 keep the SDK out of `bin/`; any `bin/` subcommand only *launches* the separately-packaged daemon, importing no SDK |

## Related Artifacts

- **EPIC-001** (`refines` — program parent): IDEF0 decomposition surfaces, T4 "composed graft" row +
  GATE-C. This PRD is Phase 3 of the T4 track.
- **PRD-036** (`based_on` — Phase-1 parent): Composed-map graft + onboarding (T4). This PRD **delivers**
  PRD-036's staged **FR-010** (onboarding tour) and **FR-011** (map-grounded chat), and extends FR-011's
  "no model call" framing into the Tier-0 (no model) / Tier-1 (local model) split (conflict C-1).
- **PRD-037 / RFC-031** (`based_on` — Phase-2 parent): Recursive IDEF0 drill-down. This PRD reuses the
  `deriveSubDocument` seam as the **fallback** for the emitted-layer render (FR-002) and the drill camera
  the tour/chat drive.
- **SPEC-006** — the `forgeplan.map/v1` render contract; the map document, `description_ru`, `flows`, and
  `MapEdge` connections this feature reads (no schema change).
- **RFC-030** — Phase-1 render + the §15 nav/interaction contract the tour and chat extend.
- **ADR-008** — the rule-22 **write** amendment for the append/deeper-scan loop (Phase 5, draft-only,
  human-gated). **Deliberately separate** from this arc's read-only `/api/map/layers` amendment; the
  append loop is a **Non-Goal** here.
- **ADR-003 / rule 23** (`.claude/rules/23-bin-zero-deps.md`) — the `bin/` = `node:*` + `citty` allow-list
  that forces the daemon/Agent-SDK packaging question (Q1).
- **Rule 22** (`.claude/rules/22-readonly-proxy.md`) — the read-only proxy boundary; gains a read-only
  `/api/map/layers/<zone>` allow-list section in the build wave.
- **`docs/PROJECT-MAP-SPEC.md` / MASTER-SPEC** §15 (interaction + EN/RU language rule), §16 (neutral
  zones), §17 (onboarding layout + conversational agent), §22 (canonical composition, fit-vs-scroll), §23
  (FINAL design — `/onboard` route, data-driven tour engine, chat, headless-bridge "a SvelteKit route
  CANNOT spawn `claude`").
- **`forgeplan-map-pack` v0.7.1** (marketplace) — emits architecture-quality zones/nodes with
  `description_ru`, 6+ flows, per-zone `.forgeplan/map/layers/<zone>.json`, and the `/map-build-layer
  "<zone>"` command this feature consumes; unchanged by this arc.
- **Following this PRD**: T4 Phase-3 **RFC** (module topology, WebSocket schema Q2/Q3, tour/agent interplay
  Q4, layer endpoint Q6/Q8) and **ADR** (daemon/Agent-SDK packaging Q1/Q5).
- **EvidencePack** — Phase-3 checkpoint evidence (AC-1..AC-5 headline + Tier-1 read-only + first-impression
  timing), minted at prove-phase and linked `informs` before any activation (rule 11, R_eff > 0).








