---
depth: standard
id: PRD-036
kind: prd
last_modified_at: 2026-07-02T13:43:46.521476+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EPIC-001
  relation: refines
status: draft
title: Composed-map graft + onboarding (T4)
---

# PRD-036: Composed-map graft + onboarding (T4)

## Problem

The 8 existing graph views (force/tree/radial/matrix/lanes/sankey/sunburst/idef0) render the artifact **link graph** — they answer "what connects to what", not "what is this system and where does X live". A newcomer opening forgeplan-web on a large workspace gets link spaghetti at every altitude: no curated zones, no entry anchor, no reading spine, no narrated composition (`docs/PROJECT-MAP-SPEC.md` §18). This is the T4 track of EPIC-001 (parent).

The full T4 program (§23) ends in an orchestrated agent pipeline emitting `map.json`, an onboarding tour, a map-grounded chat, and an append loop — but the renderer for the `forgeplan.map/v1` document contract has never been proven. Building the multi-agent emitter first would target an unproven render surface. **Program decision — recorded here, in this PRD (product-scope, PRD-authored, guardian-gated at activation):** EPIC-001's original GATE-C mitigation "не строим рендерер, пока картограф не эмитит реальный map.json" is superseded; the order flips to **prove the renderer against a HAND-WRITTEN map document first** (§23 safety control #1), agent-free. Rationale: a render-proof against a hand-written `map.json` de-risks the renderer without waiting for the cartographer — every later phase of the program then targets a proven render surface instead of an untested one. (The wave's ADR-008 records only the rule-22 write carve-out; it deliberately does NOT record this supersession — this PRD is the decision's home. EVID-076 finding 1 resolved.)

Trigger: EPIC-001 Phase 3 (GATE-C) opens; the arc branch stacks on the T2 view work (PRD-034 / RFC-029).

## Goals

Observable outcomes, not implementation:

- Goal 1: A user can select a "map" view alongside the existing views and see a curated zoned composition — zones with calm neutral chrome, node cards with EN labels, connecting edges, flow chips, labelled zone-to-zone connectors — rendered from a validated map document.
- Goal 2 (checkpoint): the view renders correctly from a **hand-authored** map document committed in the workspace, with no generator or agent involved (FR-007) — de-risking every later phase of the program.
- Goal 3: layout is deterministic — the same document yields identical positions on every run, so future appends keep everything else still (the program's determinism bet, §19).
- Goal 4: degradation is honest — a missing document yields an explicit empty state; an invalid document yields structured errors and no canvas render; the 8 existing views are untouched either way (FR-006).
- Goal 5: the later program phases — onboarding tour (FR-010), map-grounded chat (FR-011), append loop (FR-012) — are explicitly staged behind their own gates, so this arc ships value without opening any governance hole.

## Non-Goals / Out of scope

- **Out of scope (this arc and this repo): any browser-initiated forgeplan mutation.** Rule 22's write boundary (`.claude/rules/22-readonly-proxy.md`) stays intact in this arc — every endpoint added here is GET-only file-read. (The rule file itself gains a read-only allow-list section for the new endpoint, owned by the T4 RFC's build wave — an allow-list text amendment, not a write-surface change.)
- **Out of scope (this repo, permanently): spawning any coding-agent / LLM process.** The daemon that consumes deeper-scan job files lives in forgeplan CORE (`forgeplan map serve`), never in this repo.
- **Out of scope (this arc): Phases 2–4** (FR-010, FR-011, FR-012). Phase 2 onboarding route + tour, Phase 3 chat, Phase 4 append-loop endpoints are requirements of THIS PRD but deliverables of LATER arcs. Phase 4's write endpoint (job-file intake) requires a rule-22 amendment via ADR — that ADR is authored DRAFT-ONLY in this wave; its activation and the rule-file edit are HUMAN-GATED and happen in a later wave with explicit user OK.
- Out of scope: the agent pipeline that emits `map.json` (`forgeplan-map-pack`, marketplace repo) — only the document contract is consumed here.
- Out of scope: lens / heatmap overlay (explicitly dropped, §15); colorful per-zone tinting or accent rule bars (explicitly rejected, §16).
- Out of scope: replacement or regression of any of the 8 existing views (EPIC-001 out-of-scope).
- Out of scope (this arc): weighted multi-column tracks, `spill`/`collapse` overflow, FLIP append animation — Phase 2+ of the layout engine (§19). The engine's schema shape must already carry those fields; this arc does not build the behaviours.

## Target users / actors

- **Newcomer** to a forgeplan-instrumented project — primary consumer; needs the "what is this system & where does X live" altitude (later phases: the guided tour).
- **Returning maintainer** — scans composition; later phases: drift badge, deeper scans.
- **Curator / map author (human)** — hand-authors the Phase-1 checkpoint document; in later phases the emitter pipeline (external repo) takes over as producer.
- **Web server process** (system actor) — serves the document read-only from the workspace.
- **Later-phase system actors (staged):** deterministic tour engine (no model), query-only chat panel, append-loop daemon (external, forgeplan core).
- **Reviewer / guardian agents** — verify rule-22 compliance from the diff.

## Functional Requirements

Capability language only; component/file mapping is informative and lives in Constraints → Affected surfaces. FR-001…FR-009 are Phase 1 (this arc); FR-010+ are later phases, explicitly staged.

### FR-001 — Zoned composed-map rendering
- **Description**: The system shall render a curated map document (`forgeplan.map/v1`: zones, nodes, edges, flows, zone connectors, composition metadata) as a zoned composition view: zone slabs, node cards placed inside their zone, curved edges between nodes, flow chips, and labelled zone-to-zone connectors.
- **Priority**: must
- **Acceptance criteria**:
  - Given a valid map document, when the user selects the map view, then every zone, node, and edge in the document renders, and each edge visually attaches to its endpoint node cards.
  - Given a node with no edges, when rendered, then it is still visible inside its zone (edgeless components must be visible — §10).

### FR-002 — Presentation rules: EN labels + restrained color
- **Description**: Card and zone labels shall render in ENGLISH verbatim from the document. Zone chrome shall be NEUTRAL: subtle neutral fill + dash-dot neutral border, serif title, mono sub (§16). Color shall appear ONLY as kind-colored borders on decision-trail artifact cards plus the two semantic specials (`gate`, `truth`); every color resolves from a theme token, never a raw value (§15/§16/§22).
- **Priority**: must
- **Acceptance criteria**:
  - Given the checkpoint document, when rendered in light and in dark theme, then no per-zone accent fill or rule bar appears and all colors resolve from theme tokens.

### FR-003 — Read-only document retrieval with honest degradation
- **Description**: The system shall retrieve the map document from the workspace path `.forgeplan/map/map.json` via a GET-only read. An absent file shall yield an empty-map response and the view shall show an explicit empty state. The read shall never mutate the workspace, never spawn a subprocess, never reach the network.
- **Priority**: must
- **Acceptance criteria**:
  - Given no map file, when the view loads, then the endpoint returns the empty envelope and the view renders the empty state (no error garbage, no impact on other views).
  - Given the file present, when requested, then the response mirrors the file content.

### FR-004 — Deterministic pure layout
- **Description**: Positions shall be computed by a single pure function (canvas, composition, zones, nodes → positions) with pinned per-zone column counts, a stable node sort, and no measurement of rendered output; the same document yields identical positions on every run (§19).
- **Priority**: must
- **Acceptance criteria**:
  - Given the same document twice, when laid out, then the two position sets are deep-equal.
  - Given a document with one node appended to a zone, when laid out, then positions of nodes in all other zones are unchanged (append stability via pinned cols).

### FR-005 — Document validation before render
- **Description**: The view shall validate the document on load; an invalid document produces structured errors (path + message) surfaced to the user, and the canvas refuses to render it (§20, web-side call site — never render garbage).
- **Priority**: must
- **Acceptance criteria**:
  - Given an edge whose endpoint is not in `nodes`, when loaded, then a structured error names the offending edge and no canvas render occurs.

### FR-006 — Additive view registration, zero regression
- **Description**: The map view shall register as the 9th selectable view. The 8 existing views (force, tree, radial, matrix, lanes, sankey, sunburst, idef0) shall remain unchanged. The map view shall own its node model and its own document polling, never sharing node state with the existing views — the compatibility guarantee is edges-only (§8).
- **Priority**: must
- **Acceptance criteria**:
  - Given any of the 8 existing view ids, when selected, then rendering is identical to the base branch.

### FR-007 — Agent-free render checkpoint
- **Description**: A hand-authored map document committed in the workspace shall drive the full render, proving the schema + renderer BEFORE any generator exists (§23 safety control #1; supersedes the old GATE-C ordering — decision recorded in § Problem above). The checkpoint document shall exercise: at least 2 zones, node cards of at least 3 distinct kinds, at least 1 edge, at least 1 flow, and at least 1 zone connector.
- **Priority**: must
- **Acceptance criteria**:
  - Given a checkout of the arc branch and no agent tooling installed, when the app starts, then the map view renders the checkpoint document completely.

### FR-008 — Click-to-detail panel
- **Description**: Clicking a zone shall show its label + sub, a full RU description, and a "what's inside" node list; clicking a node shall show label + meta, a full RU description, and an auto-derived connections list computed from edges — never hand-written (§15).
- **Priority**: should (stretch within Phase 1; see Q2)
- **Acceptance criteria**:
  - Given a node with edges, when clicked, then the connections list matches exactly the edges incident to that node in the document.

### FR-009 — Document refresh by version
- **Description**: The view shall re-read the document periodically; a changed document version re-renders the canvas without a page reload, preserving pan/zoom state.
- **Priority**: should
- **Acceptance criteria**:
  - Given the document's version field changes on disk, when the next poll lands, then the canvas reflects the new content without navigation.

### Later phases — staged requirements, NOT deliverables of this arc

### FR-010 — Onboarding tour (Phase 2; gated on the Phase-1 checkpoint)
- **Description**: A separate full-bleed onboarding route shall reuse the same map view widget and run a data-driven guided tour: the camera moves zone-by-zone along the document's reading order, narrating from RU descriptions carried in the document; any canvas click pauses the tour (the user drives); Esc / "I got it" / the last zone exits to browse; a reduced-motion preference snaps with no animation and starts paused; a node carrying an artifact reference drills into the standard views with that artifact selected. Deterministic; no model call; zones without sourced narration are shown without narration, never faked (§17/§23).
- **Priority**: must (Phase 2)

### FR-011 — Map-grounded chat (Phase 3; gated on Phase 2)
- **Description**: A chat panel shall answer questions client-side from the loaded document (RU descriptions, auto-derived connections, flows) — instant, no model call, no write. Every answer cites its source inline; an answer that cannot be grounded says so and offers a deeper scan instead of guessing; chat may move the camera (§23).
- **Priority**: must (Phase 3)

### FR-012 — Append-loop job intake (Phase 4; HUMAN-GATED)
- **Description**: A deeper-scan request shall record a validated job file (unique request id + zone validation) under the workspace map job directory, and a job-status read shall report progress. The web layer performs FILE I/O ONLY and never spawns any agent; consuming job files is the external daemon's responsibility (forgeplan core). GATE: implementation is forbidden until the rule-22 amendment ADR is activated by a human and the rule file is amended with explicit user OK.
- **Priority**: must (Phase 4)

## Non-Functional Requirements

### NFR-001 — Determinism / idempotency
- **Category**: reliability
- **Threshold**: identical document → identical computed positions across runs (deep-equal); appends keep untouched zones byte-stable (FR-004)
- **Measurement**: unit tests — repeated layout equality + append-stability case.

### NFR-002 — Governance / security (rule 22)
- **Category**: security
- **Threshold**: 100% of endpoints added in this arc are GET-only, spawn-free, mutation-free, network-free (FR-003)
- **Measurement**: rule-22 verification greps (spawn/execFile/fetch/write scans over route files) + reviewer diff check before merge.

### NFR-003 — Theming & accessibility
- **Category**: accessibility
- **Threshold**: zero raw color literals in new view components (token-only); dual theme correct with no caller intervention; reduced-motion honored wherever motion exists (FR-002)
- **Measurement**: grep for hex/rgb literals in the new components; manual dual-theme check on the checkpoint document.

### NFR-004 — Render performance
- **Category**: performance
- **Threshold**: initial render of the checkpoint document (≈ ≤20 visible nodes) within TBD ms on the reference machine; the program-level Phase-2 target fixed by the spec is first-impression < 3 s on the onboarding route (§23)
- **Measurement**: TBD — Phase-1 budget and method to be fixed in the T4 RFC; manual timing acceptable at checkpoint.

### NFR-005 — Non-regression
- **Category**: reliability
- **Threshold**: all pre-existing template static checks and tests stay green; the 8 existing views' behaviour unchanged (FR-006)
- **Measurement**: CI static-check + unit suite; manual smoke across the 8 view ids.

## Constraints

### Technical
- Rule 22 (`.claude/rules/22-readonly-proxy.md`): `/api/*` is a GET-only read-only proxy — fully honored this arc. The Phase-4 write endpoint (FR-012) is impossible without a human-gated amendment ADR (precedents inside the rule itself: the OPTIONS/CORS carve-out on `/api/instance-status`; the `/api/instances` filesystem-read extension).
- Rule 21 (template purity), rule 24 (shared/ui ownership), FSD layering for all new files.
- Edges-only compatibility (§8): the map node model is never shared with the existing views' node model; edge shape stays byte-compatible with the existing graph edge contract.
- View registration is the verified triple (view union + view registry array + id set) plus a dispatch branch inserted BEFORE the fallback branch — otherwise the map silently renders as Lanes (§8).
- Token-only colors from the app stylesheet; zone tokens ported verbatim from the spike (§8/§16).
- The layout engine's document schema must already carry the multi-track / capacity / overflow fields (§19) even though Phase 1 exercises only the single-column stack path.

### Affected surfaces (informative, from §8/§23 — not requirements)
- New: `entities/map/` (document types + poller + `lib/validate.ts`), `routes/api/map/+server.ts` (GET, file read, 404→empty), `widgets/composed-map/` (`model/layout.ts` pure `computeComposedLayout`; `ui/` ZoneSlab · NodeCard · EdgeLayer · ComposedMap; Minimap reused), hand-written `.forgeplan/map/map.json`.
- Touched: view registry (`shared/config/ui-prefs.ts`), view dispatcher (`widgets/dependency-graph/ui/DependencyGraph.svelte`), home page poller wiring, app stylesheet tokens.

### Business
- Build order fixed by §23: render-proof → process → onboarding → chat → append loop. Only Phase 1 (render-proof) in this arc.
- Program decision «делаем сразу хорошо» (build the full target) constrains DESIGN, not this arc's scope: nothing shipped here may need re-doing for Phases 2–4.
- MVP refresh path: the user regenerates the document out-of-band; the periodic re-read (FR-009) picks up the version bump — no push channel, no write endpoint.
- ADR activation + rule-file edit are human-gated; the guardian + orchestrator own artifact activation — the author leaves everything draft.

### Regulatory
- None external. Internal accessibility bar: reduced-motion respected; view switcher keyboard-reachable.

## SMART Acceptance Criteria (Phase 1 — ship-or-not for this arc)

1. **AC-1** (FR-001, FR-002, FR-007): On the arc branch with the hand-authored checkpoint document present, the `map` view is selectable from the view switcher and renders 100% of the document's zones, nodes, and edges with EN labels and neutral dashed zone chrome (0 per-zone accent fills, 0 rule bars), verified against §15/§16 via the PR review checklist before the arc PR merges.
2. **AC-2** (FR-003, FR-005): The map endpoint answers GET with the document verbatim when the file exists and with an empty-map envelope when it does not (honest 404→empty degradation), and the rule-22 verification greps report 0 new spawn/network/write call sites in the added routes — both verified in CI/review before the arc PR merges.
3. **AC-3** (FR-006): All 8 pre-existing views (force, tree, radial, matrix, lanes, sankey, sunburst, idef0) render exactly as on the base branch — additive registration only — verified by the existing test suite plus a manual smoke of every view id before the arc PR merges.
4. **AC-4** (FR-004): The pure layout function ships with unit tests covering determinism (same input twice → deep-equal positions) and pinned-cols append stability, all passing in CI at PR time.
5. **AC-5**: `svelte-check` reports 0 errors and the unit test suite (`vitest`) reports 0 failures on the arc branch at PR time.

## Open Questions

- Q1: Fit-to-screen vs scroll render mode (§22) — does Phase 1 ship fit-only for the small checkpoint map, deferring scroll + zoom-at-cursor? — owner: TBD (T4 RFC)
- Q2: Is the click-to-detail panel (FR-008) inside this arc or the immediate fast-follow? — owner: TBD (orchestrator)
- Q3: Phase-1 render performance budget number (NFR-004) — owner: TBD (T4 RFC)
- Q4: Which wave activates the rule-22 amendment ADR and edits the rule file (Phase-4 gate for FR-012)? — owner: TBD (user — human gate)
- Q5: Exact checkpoint document content — which real ForgePlanWeb zones/flows does the hand-authored map depict? — owner: TBD (curator)

## Related Artifacts

- **EPIC-001** (parent — this PRD refines it): T4 child row + GATE-C. NOTE: the epic's original risk mitigation "не строим рендерер, пока картограф не эмитит реальный map.json" is superseded by the program decision recorded in THIS PRD (§ Problem) — §23 step 1 renders against a HAND-WRITTEN map.json first. (ADR-008 records only the rule-22 write carve-out, not this supersession.)
- **docs/PROJECT-MAP-SPEC.md** — authoritative design spec: §8 files, §15 UX/EN-RU, §16 neutral zones, §17/§22 onboarding + canonical composition, §19 grid engine, §20 validation, §23 final build order + safety controls.
- **PRD-034 / RFC-029** — T2 standalone idef0 view; this arc's branch stacks on that work; the 8-view baseline includes `idef0`.
- **RFC-028 / ADR-006 / ADR-007** — T1 shared core + its ADRs (reuse-not-fork context for any decomposition logic the map later grafts).
- **Rule 22** (`.claude/rules/22-readonly-proxy.md`) — governance boundary; Phase 4 requires its amendment ADR (authored draft-only this wave, human-gated activation).
- **Planned this wave**: T4 RFC (design, layout budgets, Q1/Q3) · rule-22 amendment ADR (draft-only).
- **EvidencePack** — Phase-1 checkpoint evidence, minted at prove-phase and linked before any activation (activation requires R_eff > 0 per rule 11).

