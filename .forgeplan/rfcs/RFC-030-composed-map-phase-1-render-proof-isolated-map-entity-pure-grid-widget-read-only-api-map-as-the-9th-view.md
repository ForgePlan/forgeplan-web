---
depth: standard
id: RFC-030
kind: rfc
last_modified_at: 2026-07-02T13:18:20.768481+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-036
  relation: based_on
- target: SPEC-006
  relation: based_on
status: draft
title: 'Composed-map Phase-1 render-proof: isolated map entity + pure-grid widget + read-only /api/map as the 9th view'
---

# RFC-030: Composed-map Phase-1 render-proof: isolated map entity + pure-grid widget + read-only /api/map as the 9th view

## Summary

Design for Phase 1 (RENDER-PROOF) of the T4 composed-map program (PRD-036, contract frozen in SPEC-006): three new module clusters — `entities/map` (document types + `validate.ts` + ref-counted `mapPoller`), `shared/server/map.ts` + `routes/api/map/+server.ts` (GET-only `readFile` of `<workspaceRoot>/.forgeplan/map/map.json`, ENOENT → honest empty), and `widgets/composed-map` (`lib/composed-layout.ts` pure `computeComposedLayout` with pinned cols per §19; `ZoneSlab` neutral-dashed per §16; `NodeCard` EN + decision-color-only per §15/§22; `EdgeLayer` curved edges; Minimap reused via the host's existing `onViewState` wiring) — plus additive registration of `map` as the **9th** view (verified count: `GRAPH_VIEWS` in `template/src/shared/config/ui-prefs.ts` holds exactly 8 entries today, `idef0` included; the parent-task hint "10th" is wrong against the real registry). A hand-written checkpoint `map.json` describing this repo's real zones (cli / web / core / docs) proves the render with zero agent involvement. ADI on PRD-036 ran this wave: H1 (strict FSD isolation + pure layout engine) adopted; H2 (shared graph-core extension) refuted; H3 (validation-first) folded in as the §20 web call-site, not a server-side gate. Rule 22 stays GET-only-compliant; the read-only allow-list amendment this endpoint needs is driven by this RFC (mirroring the `/api/instances` precedent) and is distinct from ADR-008's human-gated Phase-4 write amendment.

## Motivation

PRD-036 Goal 2 / FR-007: prove the `forgeplan.map/v1` renderer against a HAND-WRITTEN document before any emitter exists (§23 safety control #1, superseding EPIC-001's original GATE-C ordering "no renderer until the cartographer emits a real map.json"). SPEC-006 froze the six sub-contracts (C1 schema, C2 edges-only superset, C3 pure layout, C4 never-throwing validator, C5 GET endpoint, C6 view integration) but deliberately left the RFC to own: the concrete module/file topology against the REAL integration surfaces, the data-wiring decision (who starts the poller), the empty-response discriminant (SPEC Q1), the poll interval (SPEC Q2), the severity behaviour (SPEC Q3), render mode (PRD Q1), the click-to-detail staging (PRD Q2), the perf-budget method (PRD Q3), and the checkpoint content (PRD Q5). This RFC pins all of those so the pseudocode/build wave can proceed without re-litigating.

Real surfaces verified in code this wave (not from the spec's stale line numbers):

- `template/src/shared/config/ui-prefs.ts` — `GraphView` union (8 members), `GRAPH_VIEWS` array (8 entries), `GRAPH_VIEW_IDS` auto-derived Set. `map` becomes the 9th member of all three.
- `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` — dispatch chain ends `{:else if view === 'idef0'} … {:else} <LanesView/>`; the new `{:else if view === 'map'}` branch MUST precede the final `{:else}` (currently line 182), else `map` silently renders Lanes. §8's "before line 155" is stale — the invariant is structural (before the fallback), not a line number.
- `template/src/entities/graph/api/store.ts` — `graphPoller = createPoller<GraphResponse>('/api/graph')`; `entities/graph/model/types.ts` — `GraphEdge { from, to, relation }` (the C2 narrowing target, verified byte-exact).
- `template/src/shared/api/poller.svelte.ts` — generic `createPoller<T>(path, intervalMs = 10_000)` with stale-while-error semantics; `envelope.ts` — `ApiEnvelope<T>`.
- `template/src/shared/server/forgeplan.ts` — `readWorkspaceRoot()`: `FORGEPLAN_CWD` env → `forgeplan-web.json#workspaceRoot` → parent-dir fallback; exported as `workspaceRoot()`. The map endpoint resolves its path through this exact helper — never hard-coded (rule 21).
- `template/src/shared/server/registry.ts` + `snapshot.test.ts` — the precedent shape for a non-forgeplan read-only server helper with colocated unit tests; `/api/map` mirrors it.
- `template/src/widgets/mosaic/ui/MosaicCanvas.svelte` (`nextAvailableView()`, `onAddPane()`) + `widgets/mosaic/lib/persist.ts` (`allViewsKnown`) — second registry consumer: registering `map` auto-enrols it as a mosaic pane option and into layout persistence (RFC-029's F4 finding applies verbatim to this registration).
- `template/src/widgets/dependency-graph/ui/idef0-view.render.test.ts` — the happy-dom + `mount()` render-harness precedent the map view's conformance tests mirror.

## Options Considered

ADI cycle (`forgeplan_reason PRD-036`, this wave) produced three hypotheses; deduction and the code-verification pass above resolve them:

### Option 1: Strict FSD isolation + pure layout engine (ADI H1) — CHOSEN
- **Pros**: satisfies FR-006 zero-regression by construction (additive registration, no shared node model); `computeComposedLayout` is 100% unit-testable in node env (NFR-001, SPEC AC-2); edges-only compatibility (SPEC C2) enforced by module boundaries — nothing under `entities/graph` imports map types; rollback is one revert.
- **Cons**: some conceptual duplication with existing view plumbing (own poller, own types); the map view accepts the standard view-component props but ignores `nodes`/`edges` (documented below).

### Option 2: Shared graph-core extension (ADI H2) — REFUTED
- **Pros**: less plumbing; one node model.
- **Cons**: directly contradicts PRD-036 FR-006 and SPEC-006 C2 (the map view must OWN `MapNode`; compatibility is edges-only); refactoring 8 stable views destroys the AC-3 no-regression guarantee and inflates blast radius; §8 explicitly forbids sharing nodes with the existing views' `ArtifactSummary` poller. Deduction confidence: Low. Rejected.

### Option 3: Validation-first middleware — server-side validation gate (ADI H3) — FOLDED, NOT ADOPTED AS SHAPE
- **Pros**: guarantees the client never sees a malformed document.
- **Cons**: contradicts SPEC-006 C5 ("the endpoint is a dumb honest mirror" — §20 places structural validation at the WEB call site, site 3 of 3); server-side validation would fork the rule list between server and client and hide errors from the error-surface UX (E3). Folded: validation is first-class, but it lives in `entities/map/lib/validate.ts`, gating the canvas, not the wire.

Sub-decisions (each weighed, not defaulted):

**SD-1 — Who consumes the map poller: HomePage wiring (§8 suggestion) vs widget-owned consumption. CHOSEN: widget-owned.** §8 sketches "HomePage starts mapPoller + $derived layout" and threads the document down. Rejected because (a) it widens the `DependencyGraph.svelte` prop contract for one view; (b) the mosaic auto-enrol means the map view can mount inside a mosaic pane where HomePage wiring does not reach — widget-owned consumption covers both hosts for free; (c) polling only runs while a map view is actually mounted (zero cost for users who never open it). `ComposedMapView.svelte` imports the ref-counted poller from `entities/map` (widgets → entities is FSD-legal) and acquires/releases it on mount/destroy. Documented as a deliberate refinement of §8.

**SD-2 — Layout function placement: `entities/map/lib` (ADI recommendation wording) vs `widgets/composed-map/lib` (SPEC C3 / §8). CHOSEN: `widgets/composed-map/lib/composed-layout.ts`.** Repo convention places pure per-view layout functions in the owning widget's `lib/` (`tree-layout.ts`, `sankey-layout.ts`, `idef0-layout.ts` all live in `widgets/dependency-graph/lib/`); the layout consumes widget-owned output types; `entities/map` keeps only document-shaped concerns (types, validator, poller). §8's `model/layout.ts` spelling is normalised to the repo's `lib/` convention for pure functions.

**SD-3 — Checkpoint document vs rule 21 (template purity). CHOSEN: fixture-in-template as the canonical test vector + workspace copy for live render.** Rule 21 forbids `template/` referencing this repo's `.forgeplan/`, so the SPEC AC-5 unit test cannot read `../../.forgeplan/map/map.json`. The canonical checkpoint lives at `template/src/entities/map/lib/fixtures/checkpoint-map.json` (loaded by the conformance test); `.forgeplan/map/map.json` at the workspace root is a byte-identical copy for the live render-proof. Drift risk named in Risks with a review-checklist mitigation. Alternative (test outside `template/`) rejected: no vitest harness exists at repo root and creating one for one test is worse than the acknowledged drift risk.

## Proposed Direction

### Module Breakdown

- **`entities/map`** (new) — owns the `forgeplan.map/v1` document model on the client: transport types, the never-throwing validator, the document discriminant, the ref-counted poller. Never imported by `entities/graph`.
- **`shared/server/map.ts`** (new) — server-side read helper `readMapFile()`: path resolution via `workspaceRoot()`, `readFile` + JSON parse, envelope construction per SPEC E1. Colocated unit tests (the `registry.ts`/`snapshot.test.ts` precedent).
- **`routes/api/map/+server.ts`** (new) — thin GET handler delegating to `readMapFile()`. GET export only.
- **`widgets/composed-map`** (new) — the view: pure layout (`lib/composed-layout.ts`), output types (`model/types.ts`), UI (`ui/ComposedMapView.svelte`, `ui/ZoneSlab.svelte`, `ui/NodeCard.svelte`, `ui/EdgeLayer.svelte`). Owns `MapNode` rendering exclusively.
- **Registration** (edits) — `shared/config/ui-prefs.ts` (9th union member + 9th `GRAPH_VIEWS` entry, icon `@lucide/svelte/icons/map`, label "Map", hint "Curated zoned composition"; `GRAPH_VIEW_IDS` auto-derives) + one `{:else if view === 'map'}` branch in `DependencyGraph.svelte` before the final `{:else}` fallback.
- **`app/styles/app.css`** (edit) — `--zone` / `--zone-line` (+ the §22 kind-accent tokens not already present), ported token-for-token from the spike `:root` / `html.dark`; no raw hex in components.
- **Checkpoint document** (new content) — `template/src/entities/map/lib/fixtures/checkpoint-map.json` (canonical) + `.forgeplan/map/map.json` (workspace copy).
- **`.claude/rules/22-readonly-proxy.md`** (edit, build wave) — read-only allow-list amendment for `/api/map` (see Governance below). NOT edited in this wave.

### Component Diagram (prose)

> `ComposedMapView` (widget ui) acquires the ref-counted `mapPoller` from `entities/map` on mount. The poller GETs `/api/map` every 10 s (the shared `createPoller` default). The route handler calls `shared/server/map.ts#readMapFile()`, which resolves `<workspaceRoot()>/.forgeplan/map/map.json` and returns the SPEC E1 envelope; it never spawns, never validates, never writes. Client-side, `ComposedMapView` runs `isMapDocument()` on `poller.state.data`; an empty/absent document renders the explicit empty state. A present document flows through `validateMapDocument()` (entities/map lib); `ok:false` renders the structured error list and REFUSES the canvas. `ok:true` feeds `computeComposedLayout()` (widget lib) inside `$derived.by`; the resulting `ComposedLayout` drives `ZoneSlab` (one per zone rect), `NodeCard` (one per node position), `EdgeLayer` (edge + connector paths) inside one SVG under a d3-zoom behaviour. `ComposedMapView` reports `{ nodes, transform, viewport }` upward through the existing `onViewState` prop, so the `Minimap` instance already hosted by `DependencyGraph.svelte` works unchanged (zero new minimap code); `panTo`/`resetZoom` are exposed via the same `bind:this` contract the other 8 views implement. Node clicks on cards carrying `artifact_id` relay `{ id: artifact_id }` through the existing `onSelect` prop, opening the existing artifact panel. Nothing in `entities/graph`, the 8 existing view components, or the forgeplan spawn path is touched.

### Data Flow

**Happy path (render-proof):** checkpoint `map.json` on disk → `GET /api/map` → `{ ok: true, data: <document>, cmd: "map:read" }` → poller state → `isMapDocument` true → `validateMapDocument` → `ok: true` → `computeComposedLayout` (macro grid from `canvas` + `composition.placements`; then per-zone sub-grid with pinned `zone.cols` and stable sort `(zone, layer, found_at → id)`; then edge/connector paths routed against those positions — §19 grid-first order) → SVG render: zone slabs (neutral-dashed), node cards (EN labels, kind-derived border color), curved edges, flow chips, labelled zone connectors → initial transform = zoom-to-fit the computed `{width, height}`.

**Failure path A (missing file — NORMAL):** ENOENT → `{ ok: true, data: {}, cmd: "map:read" }` → `isMapDocument` false → explicit "no map yet" empty state. No error chrome, zero effect on the other 8 views.

**Failure path B (malformed):** unparseable JSON → `{ ok: false, data: {}, error }` (endpoint, never throws) → error surface. Parseable but schema-violating → validator returns ALL `{ path, message, severity }` errors → error list rendered, canvas refused (§20 "never render garbage"). Severity behaviour (resolves SPEC Q3, web side): `severity: "error"` blocks the canvas; `severity: "warning"` alone renders the canvas plus a non-blocking notice chip. Alignment with the shared map-pack rule list stays open for Phase 2 (map-pack repo owns the shared list).

**Refresh (FR-009):** poll returns a document whose `meta.version` differs → validate → recompute layout (pure, same `$derived` cycle) → re-render; pan/zoom transform preserved (no auto-fit on refresh; fit only on first document).

### Function Signatures / Component Contracts

- `entities/map/model/types.ts` — `MapDocument`, `MapMeta`, `MapCanvas`, `MapComposition`, `MapZone`, `MapNode`, `MapEdge extends GraphEdge`, `MapFlow`, `MapLayer`, `MapIncrement`, `MapValidationError`, `ValidateResult` — exactly the SPEC-006 Data Models shapes (Phase-2+ fields carried).
- `entities/map/lib/validate.ts` — `validateMapDocument(input: unknown): ValidateResult` — never throws; collects ALL errors; the 14-rule SPEC E2 catalog, each rule with a fixture.
- `entities/map/lib/is-map-document.ts` — `isMapDocument(data: unknown): data is MapDocument` — discriminant is `data.schema === "forgeplan.map/v1"` (resolves SPEC Q1: the view branches on the schema tag, not on object emptiness).
- `entities/map/api/store.ts` — `mapPoller = createPoller<MapDocument | Record<string, never>>('/api/map')` (shared 10 s default, resolves SPEC Q2: consistency with `graphPoller`/`listPoller` beats the spike's 8 s; no distinct cadence is justified for Phase 1) + `acquireMapPolling(): () => void` — ref-counted start/stop so N mounted map panes (dashboard + mosaic) share one poll loop and the last unmount stops it.
- `shared/server/map.ts` — `readMapFile(): Promise<MapFileResult>` where `MapFileResult = { ok: true, data: unknown, cmd: "map:read" } | { ok: false, data: Record<string, never>, cmd: "map:read", error: string }` — ENOENT → `ok:true` empty; parse/EACCES/IO failure → `ok:false` + reason; never throws; no validation.
- `routes/api/map/+server.ts` — `export const GET: RequestHandler` → `json(await readMapFile())`, HTTP 200 for all handled cases per SPEC E1. No other method export.
- `widgets/composed-map/lib/composed-layout.ts` — `computeComposedLayout(doc: MapDocument): ComposedLayout` — PURE (SPEC C3 properties 1–7: no DOM, no clock, no randomness, cols pinned, bounded finite output, append-stable, total on validated input).
- `widgets/composed-map/model/types.ts` — `ComposedLayout { width, height, zoneRects: ReadonlyMap<string, Rect>, nodePositions: ReadonlyMap<string, Point>, edgePaths: ReadonlyArray<{ edge: MapEdge, d: string }>, connectorPaths: ReadonlyArray<{ from, to, label, d: string }> }`.
- `widgets/composed-map/ui/ComposedMapView.svelte` — props mirror the sibling views' contract: `{ selectedId?, onSelect?, onViewState? }` plus the standard `nodes`/`edges`/`scores`/filters accepted-and-ignored (marked in the component with a rule-10 inline marker, reason `map-data-source`: the map's data comes from `mapPoller`, not the host's artifact pollers); exposes `resetZoom()` and `panTo(x, y, k?)` via `bind:this`.
- `ui/ZoneSlab.svelte` — `{ zone: MapZone, rect: Rect, selected?: boolean }` — neutral fill `var(--zone)` + dash-dot `var(--zone-line)` border, serif title, mono sub; `accent` used ONLY for the faint hover/selected hint (§16 FINAL — no per-zone tint, no rule bar).
- `ui/NodeCard.svelte` — `{ node: MapNode, pos: Point, dims: { card_w, card_h } }` — EN label/meta verbatim (§15); border color derived from `node.kind` via the §22 token table (decision-trail kinds + `gate`/`truth` specials; default `var(--line)`); no color field read from the document.
- `ui/EdgeLayer.svelte` — `{ edgePaths, connectorPaths, highlightedIds? }` — curved (bezier) edge rendering per the spike's `curve()`; gutter-routing and `edges[].path` overrides stay Phase 2 (§22).

### Governance: rule-22 posture (must-state)

`/api/map` invokes no `forgeplan` subcommand — it is a **non-forgeplan endpoint**, and rule 22 states any such endpoint "requires a new Forgeplan artifact and a fresh amendment to this rule". Posture fixed by this RFC: (a) PRD-036 / SPEC-006 / RFC-030 are that updating artifact chain; (b) the build-wave PR adds a read-only allow-list section to `.claude/rules/22-readonly-proxy.md` mirroring the `/api/instances` precedent verbatim in shape — GET only; the file path is `join(workspaceRoot(), ".forgeplan", "map", "map.json")` with no interpolation, no env override beyond the standard workspace resolution, no user input; no spawn, no write, no network; envelope + never-throw; verification greps enumerated; (c) this read-only amendment goes through normal PR review — it is categorically distinct from ADR-008's Phase-4 WRITE amendment, which stays draft-only and HUMAN-GATED. This arc adds zero write surface and zero non-GET exports.

### Registration count (verified)

`GRAPH_VIEWS` today: force, tree, radial, matrix, lanes, sankey, sunburst, idef0 — **8 entries**. `map` registers as the **9th** union member, 9th array entry, 9th auto-derived Set member, and the 8th `{:else if}` branch (before the Lanes `{:else}` fallback). Anywhere upstream documents say "8th view" (§8) or "10th" (task hint), the real count above governs.

### Decisions resolving open questions

- **PRD Q1 (fit vs scroll):** one interaction shell — the SVG under a d3-zoom behaviour (pan + Ctrl/⌘-wheel zoom per §15) with **initial transform = zoom-to-fit** the computed layout. A dedicated no-interaction "poster" fit mode is deferred to the Phase-2 onboarding route (§22 keeps it a render option). Both consume the same `computeComposedLayout`.
- **PRD Q2 (click-to-detail / FR-008):** staged as the immediate fast-follow, not this checkpoint. Phase 1 ships the cheap subset: node click with `artifact_id` relays through the existing `onSelect` → existing artifact panel. `ComposedPanel.svelte` (zone RU descriptions, auto-derived connections list) is the first post-checkpoint increment — FR-008 is `should`-priority in PRD-036 and nothing in this design blocks it.
- **PRD Q3 (perf budget):** no invented number. The sourced program anchor is §23's first-impression < 3 s (Phase-2 onboarding target); Phase 1 inherits it as an upper bound and records the actual checkpoint render timing in the prove-phase EvidencePack (EVID, CL3 measurement). A tighter Phase-1 budget, if wanted, is set from that measured baseline, not guessed.
- **PRD Q5 (checkpoint content):** the document depicts THIS repo's real surfaces in four zones — `z.cli` (bin/ CLI: init/start/update), `z.web` (template/ SvelteKit app: pollers, views, api proxy), `z.core` (build pipeline + dist images: scripts/build.mjs, dist/, dist-nightly/), `z.docs` (docs/ + .forgeplan governance: rules, artifacts). Node kinds exercise ≥3 of the vocabulary: `gate` (READ_ONLY_SUBCOMMANDS runtime backstop), `truth` (.forgeplan markdown source of truth), `store` (dist images), decision-trail cards (e.g. ADR-003 bin allow-list), default components. ≥1 flow (e.g. "init scaffolds the web app": cli → core → web), ≥1 zone connector (`z.cli → z.web`, label "scaffolds/spawns"), ≥1 edge, satisfying FR-007 minima and SPEC AC-5. `meta.status: "confirmed"` (human author is the gate; no guardian exists yet).
- **SPEC Q1/Q2/Q3:** resolved above (schema-tag discriminant; 10 s shared default; error-blocks / warning-notice split, shared-list alignment deferred to map-pack).

## Invariants

What must NEVER be violated by this design, in any phase:

1. **Zero write surface**: every route added by this RFC exports `GET` only; no spawn, no filesystem write, no network from `/api/map` (rule 22; NFR-002).
2. **Edges-only compatibility**: `MapEdge` minus its optional keys IS a `GraphEdge` byte-exact; `MapNode` is never shared with, or imported by, `entities/graph` or the 8 existing views (SPEC C2).
3. **Geometry is layout-owned**: the document never carries x/y; every coordinate originates in `computeComposedLayout` (§4 load-bearing invariant; the validator rejects x/y on nodes).
4. **Pinned cols**: column count per zone comes from `zone.cols` verbatim, never derived from node count (§19; append-stability foundation).
5. **Never render garbage**: a document that fails validation with `severity: "error"` never reaches the canvas (§20 site 3).
6. **Additive registration only**: the 8 pre-existing views and `entities/graph` stay byte-untouched; removal of the registry entry + branch + new files is a complete rollback.
7. **Token-only color**: no raw hex/rgb literals in any new component; all chrome resolves through theme tokens, dual-theme without caller intervention (§16, NFR-003).

## Implementation Phases

Ordered so every phase lands testable and the checkpoint is the terminal proof. No step edits `entities/graph` or any existing view component.

1. **Document model + validator (pure, no UI).** `entities/map/model/types.ts`, `lib/validate.ts`, `lib/is-map-document.ts`, barrel `index.ts`; the checkpoint fixture JSON; full E2 fixture suite (≥14 failing + ≥1 valid + multi-error + never-throws) and the compile-time `MapEdge → GraphEdge` narrowing assertion (SPEC AC-4). Gate: vitest green in node env.
2. **Server read path + endpoint + rule-22 amendment.** `shared/server/map.ts` + colocated tests (3 automatable E1 rows: present→mirror, ENOENT→ok-empty, malformed→ok-false-no-throw); `routes/api/map/+server.ts` GET-only; the rule-22 read-only allow-list amendment text in the same PR. Gate: endpoint contract tests green + rule-22 verification greps report 0 spawn/execFile/fetch/write in the new files.
3. **Pure layout.** `widgets/composed-map/lib/composed-layout.ts` + `model/types.ts` + unit suite: determinism (same input twice → deep-equal), pinned-cols (count never derived from node count), non-wrapping append (all other positions byte-identical), wrapping append (downstream-translation-only), bounded/finite output (SPEC AC-2). Gate: vitest green.
4. **UI + registration + poller.** `entities/map/api/store.ts` (ref-counted poller); the four `ui/*.svelte` components; app.css tokens; the `ui-prefs.ts` triple + the `DependencyGraph.svelte` branch. Render-harness tests mirroring `idef0-view.render.test.ts` (happy-dom pragma, `mount()`, macOS `pool:'threads'` convention): render-proof scenario, empty-state, error-surface/refuse-to-render, EN-label + neutral-chrome token conformance (0 raw hex), registry no-regression (9 ids, map ≠ Lanes fallback), and the mosaic extension of AC-3 (map tiles in a pane; `persist.allViewsKnown` round-trips a layout containing `map`; constrained-pane render does not overflow). Gate: full suite + `svelte-check` 0 errors.
5. **Checkpoint render-proof + evidence.** Copy the fixture to `.forgeplan/map/map.json`, manual dual-theme + EN/neutral-chrome pass per §15/§16, timing measurement, all 8 pre-existing views smoke-checked → mint the CL3 EvidencePack (`verdict` / `congruence_level` / `evidence_type` structured fields), link `informs` to PRD-036/SPEC-006/RFC-030. Activation of any artifact stays with the guardian/orchestrator (R_eff > 0, rule 11).

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Registry blast radius: `map` auto-enrols into the mosaic pane picker + layout persistence (second `GRAPH_VIEWS` consumer; RFC-029 F4 precedent) | high (it is automatic) | med | In-scope by design; Phase-4 mosaic no-regression tests (tile, persist round-trip, constrained-pane render); widget-owned poller (SD-1) makes pane-hosting data-correct; rollback de-enrols automatically since both consumers derive from the registry |
| Branch placed after the `{:else}` fallback → map silently renders Lanes | low | high | Structural rule stated here (before the final `{:else}`); registry no-regression test asserts the map branch renders `ComposedMapView`, not `LanesView` |
| Checkpoint fixture (template) vs workspace `.forgeplan/map/map.json` copy drift (SD-3, rule-21 constraint) | med | low | Byte-identical copy asserted in the PR review checklist; the fixture is canonical; if drift bites twice, promote to a repo-level sync check |
| Committed-vs-gitignored tension: §5 marks `map.json` "gitignored, derived", but PRD FR-007 requires the Phase-1 checkpoint COMMITTED | med | low | Phase 1 commits it (it IS the source; no generator exists). The gitignore flip happens in the wave that ships the emitter — recorded as an open question so it is not forgotten |
| Rule-22 amendment for the read-only `/api/map` forgotten → endpoint lands against an unamended rule | med | med | Amendment text is a named deliverable of Implementation Phase 2, same PR as the endpoint; the rule-22 greps in AC verify the shape |
| `ComposedMapView` accepting-but-ignoring host `nodes`/`edges` props confuses future maintainers | med | low | Rule-10 inline marker (reason `map-data-source`) in the component + this RFC's contract section; the prop subset actually consumed is explicit (`selectedId`, `onSelect`, `onViewState`) |
| d3-zoom interaction shell is real budgeted work, not free spike reuse (§8 warning) | med | med | Interaction scope pinned to pan + Ctrl/⌘-wheel zoom + fit-on-first-load; flows/drift/panel staged out; the existing views' d3-zoom wiring is the in-repo pattern to copy |
| Ref-counted poller edge cases (two mosaic map panes, unmount ordering) | low | low | `acquireMapPolling` unit-tested: N acquires → 1 loop; last release stops; re-acquire restarts |
| Render performance on large future documents | low (Phase 1: ≤ ~20 nodes) | med | Out of Phase-1 scope; measured baseline recorded in EVID (PRD Q3 resolution); §23 mega-node collapse is the Phase-2 lever |

## Test Strategy Hooks

Hooks for the downstream tester agent (not test cases):

- **Contract tests** at the `shared/server/map.ts` boundary — the 3 automatable SPEC E1 rows; plus GET-only export and rule-22 grep conformance over the new route.
- **Property/fixture tests** on `validateMapDocument` — one fixture per E2 rule row, the all-errors-collected property, and the never-throws property against hostile inputs (`undefined`, strings, deep garbage).
- **Determinism properties** on `computeComposedLayout` — repeat-equality, pinned-cols, both append-stability cases, bounded output (SPEC AC-2 enumerates them).
- **Type-level assertion** — `MapEdge` narrowing to `GraphEdge` (SPEC AC-4), living next to the entity types.
- **Render-harness tests** mirroring `idef0-view.render.test.ts` — render-proof, empty state, refuse-to-render, token/EN conformance, 9-view registry no-regression, mosaic pane no-regression.
- **Checkpoint conformance** — the fixture passes validation with 0 errors and satisfies FR-007 minima (SPEC AC-5).
- **Measurement hook** — checkpoint render timing recorded in the prove-phase EVID (CL3, `evidence_type: measurement/test`) against `template/` + the running app; this is where PRD Q3's number gets a value.

## Rollback

Purely additive — one revert removes: the `GraphView` union member + `GRAPH_VIEWS` entry (mosaic de-enrols automatically; `allViewsKnown` drops persisted `map` panes gracefully, per RFC-029's verified rollback analysis), the `DependencyGraph.svelte` branch, the new `entities/map` / `widgets/composed-map` / `shared/server/map.ts` / route files, the css tokens, the checkpoint document, and the rule-22 read-only amendment (reverted in the same commit so rule text never outruns code). No migration, no data, no `/api/*` behaviour change for existing endpoints. The 8 existing views return to the exact pre-arc state.

## Related Artifacts

- **PRD-036** (based_on — parent): Composed-map graft + onboarding (T4); this RFC designs its Phase-1 FR-001–FR-009 and resolves Q1/Q2/Q3/Q5.
- **SPEC-006** (based_on — parent contract): forgeplan.map/v1 schema + C1–C6; this RFC resolves its Q1–Q3 and binds the contract to real files.
- **EPIC-001**: T4 child row; GATE-C ordering superseded (hand-written render-proof first) — recorded in PRD-036.
- **ADR-008**: rule-22 WRITE amendment (Phase 4, draft-only, human-gated) — deliberately NOT touched by this RFC; the Phase-1 read-only amendment is a separate, precedented, normal-review change.
- **RFC-029 / PRD-034**: T2 idef0 view — source of the verified registration pattern, the mosaic blast-radius finding (F4), the render-harness precedent, and the rollback analysis this RFC reuses.
- **Rule 21 / Rule 22** (`.claude/rules/`): template purity constrains the checkpoint fixture (SD-3); the read-only proxy rule gains the `/api/map` allow-list section in Implementation Phase 2.
- **EvidencePack (planned)**: Phase-1 checkpoint EVID (CL3) minted at prove-phase; required before any activation (rule 11).

## Open Questions

- OQ-1: When the emitter ships (Phase 2+ of the program), which wave flips `.forgeplan/map/map.json` from committed to gitignored (§5's end-state)? — owner: T4 Phase-2 RFC.
- OQ-2: Shared severity taxonomy alignment between `validate.ts` and the map-pack rule list (SPEC Q3 remainder) — owner: map-pack repo, Phase 2.
- OQ-3: Minimum mosaic pane size below which the map view switches to a degraded (fit-only, no-labels) render — owner: build wave, informed by the constrained-pane test.

## References

- `docs/PROJECT-MAP-SPEC.md` §4, §5, §8, §15, §16, §18, §19, §20, §22, §23 (authoritative design source).
- Verified integration surfaces: `template/src/shared/config/ui-prefs.ts` · `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` · `template/src/entities/graph/{api/store.ts,model/types.ts}` · `template/src/shared/api/{poller.svelte.ts,envelope.ts}` · `template/src/shared/server/{forgeplan.ts,registry.ts,respond.ts,snapshot.test.ts}` · `template/src/widgets/mosaic/{ui/MosaicCanvas.svelte,lib/persist.ts}` · `template/src/widgets/dependency-graph/ui/idef0-view.render.test.ts` · `template/src/pages/home/ui/HomePage.svelte`.
- ADI record: `forgeplan_reason PRD-036` (this wave) — H1 adopted, H2 refuted, H3 folded.



