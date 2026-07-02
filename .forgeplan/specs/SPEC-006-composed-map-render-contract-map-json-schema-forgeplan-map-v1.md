---
depth: standard
id: SPEC-006
kind: spec
last_modified_at: 2026-07-02T12:53:31.235873+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-036
  relation: based_on
status: draft
title: Composed-map render contract + map.json schema (forgeplan.map/v1)
---

# SPEC-006: Composed-map render contract + map.json schema (forgeplan.map/v1)

## Summary

Frozen Phase-1 (RENDER-PROOF) technical contract for the composed-map view, `based_on` PRD-036: (C1) the `forgeplan.map/v1` document schema at `.forgeplan/map/map.json`; (C2) the `MapResponse` transport whose edges are a strict additive superset of the existing `GraphEdge` — the edges-only compatibility guarantee; (C3) the pure, deterministic, pinned-cols `computeComposedLayout` function that owns ALL geometry (the document carries no x/y); (C4) the never-throwing web-side validator with honest per-error `{ path, message, severity }` reporting; (C5) the rule-22-compliant `GET /api/map` readFile endpoint with honest missing-file → empty degradation; (C6) restated view-integration constraints. Six Given/When/Then scenarios pin the ship-or-not behaviours. Authoritative design source: `docs/PROJECT-MAP-SPEC.md` §4/§8/§15/§16/§17/§19/§20/§22/§23.

## Problem

PRD-036 (parent, `based_on`) fixes the T4 Phase-1 goal: prove the composed-map renderer against a HAND-WRITTEN map document, agent-free, before any emitter exists. That render-proof needs a frozen technical contract that four parties can build and test against independently: (a) the human curator authoring the checkpoint `map.json`, (b) the pure layout function, (c) the web-side validator, (d) the GET endpoint + poller. This SPEC is that contract. Authoritative design source: `docs/PROJECT-MAP-SPEC.md` §4 (layered schema), §8 (files + edges-only compatibility), §15 (EN/RU content rule), §16 (neutral zone chrome), §17 (RU descriptions consumed by later phases), §19 (grid engine), §20 (three-call-site validation), §22 (canonical composition + kind→treatment table), §23 (build order + safety controls).

ADI on PRD-036 (this wave) confirmed: H1 — a pure virtual-grid layout function computing all x/y itself (no DOM measurement) is the only shape satisfying FR-004/NFR-001; H3 — the map view owns its node model outright, compatibility with the existing graph transport is edges-only. H2 (browser-grid hybrid) is rejected: DOM measurement breaks deep-equal determinism across runs.

## Contract

Six sub-contracts. Everything here is normative for Phase 1 (RENDER-PROOF) unless marked *carried, Phase 2+* — those fields MUST exist in the schema (PRD-036 constraint: nothing shipped may need re-doing for Phases 2–4) but no Phase-1 behaviour depends on them.

### C1 — `map.json` document schema `forgeplan.map/v1`

One JSON document at `<workspaceRoot>/.forgeplan/map/map.json`. Layered per §4; field names below are canonical (the working sketch's `title_en` / `title_ru` / `decision_color` map onto `label` / `description_ru` / kind-derived treatment respectively — see the naming reconciliation note in Data Models).

- **`schema`** (required): the literal string `"forgeplan.map/v1"`. Any other value → validation error, no render.
- **`meta`** (required): `{ map_id, status: "proposed" | "confirmed", project_type, composition_id, source_fingerprint, version: number, agent_run? }`. `version` is the refresh/poll change key. The hand-written checkpoint uses `status: "confirmed"` (no guardian exists yet; the human author IS the gate).
- **`canvas`** (required) — L1 grid POLICY, knows nothing of zones/nodes: `{ grid: { cols, rows }, gap: { x, y }, margin, cell: { card_w, card_h, card_gap, zpad: { top, side, bottom } } }`. `col_weights` / `row_weights` *carried, Phase 2+*. Phase 1 exercises the single-column `stack-ttb` path (§19) but the schema is multi-track from day one.
- **`composition`** (required) — L2 Open/Closed seam: `{ template, arrangement: "stack-ttb", entry_zone, placements: [{ zone, cell: { row, col, col_span?, row_span? } }], zone_connectors: [{ from, to, label }] }`. `entry_zone` MUST name an existing zone (it anchors the reading spine, §18, and the Phase-2 tour, §17/§23). `arrangement` values other than `stack-ttb` and freeform explicit-coords placement (§22 escape hatch) are *carried, Phase 2+*. `zone_connectors` endpoints MUST be zone ids.
- **`zones[]`** (required, ≥1) — L3 identity + look: `{ id, label, sub?, description_ru?, kind, accent, altitude?, treatment, rule_edge, layout_rule, cols, layers?, capacity?, overflow? }`.
  - `label` / `sub` are ENGLISH verbatim (§15). `description_ru` is the RUSSIAN panel/tour text (§15/§17) — optional in Phase 1 (no description → panel omits it, tour later skips it; never faked).
  - `treatment` defaults to `"neutral-dashed"`; `rule_edge` defaults to `"off"` (§16 FINAL: neutral fill `var(--zone)` + dash-dot border `var(--zone-line)`; NO per-zone accent fill, NO rule bar). `accent` is a TOKEN NAME, never a raw color; the renderer uses it ONLY for a faint hover/selected hint.
  - `cols` is REQUIRED and PINNED — the renderer/layout uses it verbatim and never derives it from node count (§4 L3, §10 H1).
  - `layout_rule` Phase 1 = `"grid"` only; other strategies *carried, Phase 2+*. `capacity` / `overflow` (`grow` | `spill` | `collapse`) *carried, Phase 2+*; Phase-1 behaviour is always `grow`.
- **`layers[]`** (optional) — L4 drill-down band, *carried, Phase 2+*: `{ id, zone, label, order }`. Omitted for flat maps; the checkpoint document omits it.
- **`nodes[]`** (required, ≥1) — L5, **carry NO x/y (load-bearing invariant, §4)**: `{ id, label, kind, zone, layer?, meta?, status?, r_eff?, artifact_id?, description_ru?, provenance?, found_at, is_new? }`.
  - `id`: content-hash string, stable across re-emits (checkpoint: any unique string; emitter later: `sha1(kind+':'+path_or_slug)[:12]`).
  - `label` / `meta` ENGLISH verbatim; `description_ru` RUSSIAN (§15).
  - `zone` MUST name an existing zone; `found_at` (ISO timestamp) is the append-stability sort key.
  - **No color field exists.** Card color is DERIVED from `kind` via the token table (§16/§22): kind-colored borders ONLY for decision-trail artifact kinds (prd/rfc/adr/epic/spec/problem/note/evidence) + the two semantic specials (`gate` = clay, `truth` = olive); every other kind renders the neutral `var(--line)` border. Tokens only, never hex.
  - `artifact_id?` links a node to the artifact graph (later drill affordance); a pure code-dep node has none.
  - Mega-node fields (`is_mega`, `children`, `collapsed`) *carried, Phase 2+*; if present, validated (children ∈ nodes, no nesting cycle) but Phase 1 renders them as ordinary cards.
- **`edges[]`** (required, may be empty) — L6, STRICT SUPERSET of the graph transport edge (see C2): `{ from, to, relation, namespace?, trust?, verified_by?, path? }`. `from`/`to` MUST be node ids. Backward-compat default (lives ONLY in the map entity, never in the graph entity): missing `namespace` ⇒ `typed-link` if `relation` ∈ the 11 VALID_RELATIONS (`informs, based_on, supersedes, contradicts, refines, supports, demonstrates, covers, triangulates, references, belongs_to`), else `code-dep`. `path` (hand-routed override) *carried, Phase 2+*.
- **`flows[]`** (optional): `{ id, name, node_ids: string[], edge_ids?: string[], steps?: string[] }` (§22 extension; `steps` are RU per §15). All referenced ids MUST exist. Phase 1 renders flow chips + dim/highlight; numbered flowcap *carried, Phase 2+*.
- **`increments[]`** (optional, *carried, Phase 2+*): `{ version, added_node_ids: string[], stale_node_ids: string[] }` — consumed by the append loop / FLIP animation later; Phase 1 only schema-validates it.

### C2 — `MapResponse`: superset of the graph transport

The map view OWNS `MapNode`/`MapZone` — never shared with the 8 existing views (they consume `ArtifactSummary` from a different poller; §8, ADI H3). The ONLY compatibility guarantee is **edges-only**:

- `MapEdge` extends the existing `GraphEdge` transport shape `{ from, to, relation }` with ADDITIVE OPTIONAL keys only (`namespace?`, `trust?`, `verified_by?`, `path?`).
- **Liskov invariant (normative):** for every `MapEdge` e, `{ from: e.from, to: e.to, relation: e.relation }` IS a valid `GraphEdge` — dropping the extra keys yields exactly today's graph edge, byte-compatible. A future change that renames/retypes any of the 3 base fields is a breaking change to this SPEC.
- `MapResponse` is the transport type the poller consumes: the standard endpoint envelope (C5) whose `data` is either a full `forgeplan.map/v1` document or the empty map `{}`. The poller is a separate instance of the existing generic poller (map entity) — it never mutates the graph poller's state.
- Type placement per §8: `MapResponse` subtypes live with the map entity; nothing under the existing graph entity imports map types.

### C3 — `computeComposedLayout` PURE-function contract

`computeComposedLayout(canvas, composition, zones, nodes) → ComposedLayout` (equivalently: `(doc: MapDocument) → ComposedLayout`). Lives in the composed-map widget model, runs inside reactive derivation, unit-tested (§8/§19).

Normative properties:

1. **PURE**: no DOM access, no measurement of rendered output, no randomness, no clock reads, no global/module mutable state, no I/O. Output is a deterministic function of its arguments and nothing else.
2. **Deterministic / idempotent**: deep-equal input → deep-equal output, every run, every process (the §19 determinism bet). Byte-identical JSON → byte-identical positions.
3. **cols PINNED**: each zone lays its nodes into exactly `zone.cols` columns, wrapping into additional rows as needed (`grow`); the function NEVER computes column count from node count.
4. **Geometry ownership**: the document carries NO x/y; every coordinate in the output originates here. Macro grid first (canvas grid + composition placements → zone rects, track size = max of the zones in that track), then zone sub-grid (nodes into pinned cols, stable sort `(zone, layer, found_at → id)`), then edges routed relative to those positions (§19 grid-first build order).
5. **Bounded output**: every zone rect and node position is finite and lies within the computed canvas bounds; the output carries total `{ width, height }`. No NaN/Infinity for any valid input.
6. **Append stability** (pinned cols + stable sort): appending one node that does not increase its zone's row count leaves every other position byte-identical; an append that adds a row translates only zones later in reading order by the row delta — intra-zone relative positions everywhere else unchanged (minimal delta, §19). The normative unit test exercises the non-wrapping case (PRD-036 FR-004 AC); the wrapping translation case is covered as a second test.
7. **Total on validated input**: the function's precondition is a document that passed C4 validation. Feeding an unvalidated document is a caller contract violation; the function is not required to defend against structurally invalid input (the validator is the single gate — §20 "never render garbage").

`ComposedLayout` output shape: `{ width, height, zoneRects, nodePositions, edgePaths, connectorPaths }` (names indicative; the properties above are the contract, the exact field spelling is the RFC/implementation's — see Data Models).

### C4 — `validate.ts` contract (web call site of the §20 three-site validation)

`validateMapDocument(input: unknown) → { ok: true, doc: MapDocument } | { ok: false, errors: MapValidationError[] }` in the map entity's lib.

- **Never throws.** Any input — `undefined`, `null`, a string, a truncated object, a hostile 10-level-deep object — returns a typed result. Exceptions escaping this function are a contract violation.
- **Honest per-error reporting**: collects ALL failures found (no fail-fast on the first), each as `MapValidationError = { path: string, message: string, severity: "error" | "warning" }` with a JSON path (`zones[3].cols`, `edges[2].to`) and a human-readable message (§20 linter style).
- **Rule set** (web-side subset of the shared §20 rule list; each rule has a fixture in the unit suite — see Errors):
  - schema tag is exactly `forgeplan.map/v1`;
  - required top-level blocks present and correctly typed (`meta`, `canvas`, `composition`, `zones`, `nodes`, `edges`);
  - every `node.zone` ∈ zones; every edge endpoint (`from`, `to`) ∈ nodes; every `flow.node_ids[*]` ∈ nodes; every `zone_connectors[*].from/to` ∈ zones; `composition.entry_zone` ∈ zones; every `placements[*].zone` ∈ zones;
  - no duplicate node ids, zone ids, or flow ids;
  - every zone has a pinned numeric `cols` ≥ 1;
  - placement cells do not overlap on the macro grid and fit inside `canvas.grid`;
  - mega-node integrity when present: every `children[*]` ∈ nodes, no nesting cycle;
  - nodes carry NO `x`/`y` keys (load-bearing invariant — presence is an error, not silently ignored);
  - unknown `edge.relation` is NOT an error — the backward-compat namespace default (C1) classifies it; unknown extra keys anywhere are ignored (forward-compatible reads), severity `warning` at most.
- **Consumer obligation**: on `ok: false` the view surfaces the structured errors to the user and the canvas REFUSES to render (no partial render of a broken document). On `ok: true` the doc flows to C3 unchanged.

### C5 — Endpoint contract: `GET /api/map`

Rule 22 compliant in full — this arc adds zero write surface.

- **Method**: `GET` only. No `POST`/`PUT`/`PATCH`/`DELETE`/`OPTIONS` export.
- **Behaviour**: `readFile` of `<workspaceRoot>/.forgeplan/map/map.json`, where `workspaceRoot` resolves exactly like every other route (from the init-written config or `FORGEPLAN_CWD` — never hard-coded; rule 21). No spawn, no `forgeplan` invocation, no network, no filesystem write, no path interpolation from user input (the path is a constant relative to the resolved workspace).
- **Envelope** (mirrors the standard `/api/*` shape): `{ ok: boolean, data: MapDocument | {}, cmd: "map:read", error?: string }`, HTTP 200 in all handled cases.
  - **File present, parseable JSON** → `{ ok: true, data: <parsed file content verbatim>, cmd: "map:read" }`. The endpoint does NOT run C4 validation — structural validation is the web client's job (§20 site 3); the endpoint is a dumb honest mirror.
  - **File missing (ENOENT)** → `{ ok: true, data: {}, cmd: "map:read" }` — honest empty degradation (§20/§22, PRD-036 FR-003): no map yet is a NORMAL state, not an error; the view renders an explicit empty state.
  - **File unreadable (permissions, I/O) or unparseable JSON** → `{ ok: false, data: {}, cmd: "map:read", error: "<reason>" }` — never a thrown exception, never a 5xx from the handler's own logic.
- **Verification** (enforceable from the diff): the rule-22 greps report no spawn/execFile/fetch/write in the new route file; the route exports `GET` only.

### C6 — View integration constraints (inherited, restated for testability)

- `map` registers as the 9th view via the verified triple (view union + registry array + id Set) and a dispatch branch inserted BEFORE the fallback branch — otherwise the map silently renders as Lanes (§8).
- Zone chrome per §16 (neutral-dashed, no accent fill, no rule bar); card labels EN per §15; all colors token-only, dual-theme with no caller intervention.
- The 8 pre-existing views (force, tree, radial, matrix, lanes, sankey, sunburst, idef0) are byte-untouched by this contract.

## Data Models

Indicative TypeScript shapes (normative structure; exact identifier spelling finalised in the T4 RFC):

```ts
// ===== transport (entities/map) =====
interface MapResponse { ok: boolean; data: MapDocument | Record<string, never>; cmd: "map:read"; error?: string }

interface MapDocument {
  schema: "forgeplan.map/v1";
  meta: MapMeta;
  canvas: MapCanvas;
  composition: MapComposition;
  zones: MapZone[];
  layers?: MapLayer[];            // carried, Phase 2+
  nodes: MapNode[];
  edges: MapEdge[];
  flows?: MapFlow[];
  increments?: MapIncrement[];    // carried, Phase 2+
}

interface MapMeta { map_id: string; status: "proposed" | "confirmed"; project_type: string;
  composition_id: string; source_fingerprint: string; version: number; agent_run?: string }

interface MapCanvas { grid: { cols: number; rows: number }; col_weights?: number[]; row_weights?: number[]; // weights carried, Phase 2+
  gap: { x: number; y: number }; margin: number;
  cell: { card_w: number; card_h: number; card_gap: number; zpad: { top: number; side: number; bottom: number } } }

interface MapComposition { template: string; arrangement: "stack-ttb"; // other arrangements carried, Phase 2+
  entry_zone: string;
  placements: Array<{ zone: string; cell: { row: number; col: number; col_span?: number; row_span?: number } }>;
  zone_connectors: Array<{ from: string; to: string; label: string }> }

interface MapZone { id: string; label: string; sub?: string; description_ru?: string;
  kind: string; accent: string;                       // TOKEN name, hover-hint only (§16)
  altitude?: string; treatment: "neutral-dashed"; rule_edge: "off"; // §16 defaults; other values carried
  layout_rule: "grid";                                 // other strategies carried, Phase 2+
  cols: number;                                        // PINNED, required
  layers?: string[]; capacity?: number; overflow?: "grow" | "spill" | "collapse" } // carried, Phase 2+

interface MapLayer { id: string; zone: string; label: string; order: number } // carried, Phase 2+

interface MapNode {                                    // NO x, NO y — ever
  id: string; label: string; kind: string; zone: string; layer?: string;
  meta?: string; status?: string; r_eff?: number; artifact_id?: string;
  description_ru?: string;
  provenance?: { source: string; ref: string; confidence: number };
  found_at: string;                                    // ISO — append sort key
  is_new?: boolean;
  is_mega?: boolean; children?: string[]; collapsed?: boolean } // carried, Phase 2+

// ===== edges-only compatibility seam =====
// GraphEdge (existing transport, unchanged): { from: string; to: string; relation: string }
interface MapEdge extends GraphEdge {                  // STRICT SUPERSET — additive optional keys only
  namespace?: "typed-link" | "code-dep"; trust?: "high" | "medium" | "low";
  verified_by?: string; path?: string }                // path carried, Phase 2+

interface MapFlow { id: string; name: string; node_ids: string[]; edge_ids?: string[]; steps?: string[] }
interface MapIncrement { version: number; added_node_ids: string[]; stale_node_ids: string[] }

// ===== layout output (widgets/composed-map) =====
interface ComposedLayout { width: number; height: number;
  zoneRects: ReadonlyMap<string, { x: number; y: number; w: number; h: number }>;
  nodePositions: ReadonlyMap<string, { x: number; y: number }>;
  edgePaths: ReadonlyArray<{ edge: MapEdge; d: string }>;
  connectorPaths: ReadonlyArray<{ from: string; to: string; label: string; d: string }> }

// ===== validation (entities/map/lib) =====
interface MapValidationError { path: string; message: string; severity: "error" | "warning" }
type ValidateResult = { ok: true; doc: MapDocument } | { ok: false; errors: MapValidationError[] };
```

Naming reconciliation with the working sketch: `title_en` → `label` (EN verbatim, §15); `title_ru` → `description_ru` (RU panel/tour text, §15/§17); `decision_color` → derived from `node.kind` via the §22 token table — the document NEVER stores a color value (token-only rule, §16); zone "grid area" → `composition.placements[].cell` (§19 macro grid; placement stays out of the zone object — the L2 Open/Closed seam, §4).

## Errors

Complete taxonomy. Every class below has at least one unit-test fixture.

### E1 — Endpoint (`GET /api/map`)

| Condition | Response | HTTP | Notes |
|---|---|---|---|
| File present, valid JSON | `{ ok: true, data: <file>, cmd: "map:read" }` | 200 | Mirror; no server-side C4 validation |
| File missing (ENOENT) | `{ ok: true, data: {}, cmd: "map:read" }` | 200 | NORMAL state — honest empty, not an error |
| Unparseable JSON | `{ ok: false, data: {}, cmd: "map:read", error: "map: invalid JSON — <detail>" }` | 200 | Never throws |
| Read failure (EACCES / I/O) | `{ ok: false, data: {}, cmd: "map:read", error: "<detail>" }` | 200 | Never throws |

### E2 — Validator (`validateMapDocument`)

Structured `{ path, message, severity }`, all errors collected, never thrown. Representative catalog (messages indicative):

| Rule | Example error |
|---|---|
| schema tag | `{ path: "schema", message: "expected 'forgeplan.map/v1', got 'forgeplan.map/v2'", severity: "error" }` |
| missing block | `{ path: "zones", message: "required array missing", severity: "error" }` |
| dangling node zone | `{ path: "nodes[4].zone", message: "zone 'z.storage' not in zones", severity: "error" }` |
| dangling edge endpoint | `{ path: "edges[2].to", message: "endpoint 'n_ghost' not in nodes", severity: "error" }` |
| entry zone | `{ path: "composition.entry_zone", message: "zone 'z.start' not in zones", severity: "error" }` |
| duplicate id | `{ path: "nodes[7].id", message: "duplicate node id 'n_proj'", severity: "error" }` |
| missing pinned cols | `{ path: "zones[3].cols", message: "cols missing or < 1 (must be pinned)", severity: "error" }` |
| cell overlap | `{ path: "composition.placements[1].cell", message: "zone 'z.a' cell overlaps 'z.b'", severity: "error" }` |
| cell out of grid | `{ path: "composition.placements[2].cell", message: "row 5 outside canvas.grid.rows=4", severity: "error" }` |
| mega-node child | `{ path: "nodes[9].children[0]", message: "'n_missing' not in nodes", severity: "error" }` |
| mega-node cycle | `{ path: "nodes[9]", message: "mega-node nesting cycle mn_a → mn_b → mn_a", severity: "error" }` |
| forbidden geometry | `{ path: "nodes[0].x", message: "nodes must not carry x/y — geometry is layout-owned", severity: "error" }` |
| flow reference | `{ path: "flows[0].node_ids[2]", message: "'n_gone' not in nodes", severity: "error" }` |
| connector endpoint | `{ path: "composition.zone_connectors[0].from", message: "'z.nope' not in zones", severity: "error" }` |
| unknown extra key | severity `warning` at most — forward-compatible reads |
| unknown edge relation | NOT an error — classified `code-dep` by the namespace default (C1) |

### E3 — Renderer behaviour on error

- Validator `ok: false` → the view surfaces the error list (path + message) and the canvas REFUSES to render — never a partial/garbage render (§20).
- Endpoint `ok: true, data: {}` (missing file) → explicit empty state ("no map yet" affordance), zero impact on the other 8 views.
- Endpoint `ok: false` → the same error surface as validation failure, with the endpoint's `error` string.
- Layout: not an error source — its precondition is a validated document (C3 property 7); it is total (finite, bounded output) on that domain.

## Scenarios

#### Scenario: render-proof (hand-written map.json renders zones + nodes + edges)
- **Given** the hand-authored checkpoint document at `.forgeplan/map/map.json` (≥2 zones, ≥3 distinct node kinds, ≥1 edge, ≥1 flow, ≥1 zone connector — PRD-036 FR-007) and no agent/generator tooling installed,
- **When** the user selects the `map` view,
- **Then** every zone slab, node card, edge, flow chip, and labelled zone connector in the document renders; each edge visually attaches to its endpoint cards; an edgeless node is still visible inside its zone.

#### Scenario: empty-workspace degradation (missing file)
- **Given** a workspace with no `.forgeplan/map/map.json`,
- **When** the map view loads,
- **Then** `GET /api/map` answers `{ ok: true, data: {}, cmd: "map:read" }` (HTTP 200, no exception) and the view renders an explicit empty state; the other 8 views are unaffected.

#### Scenario: malformed-json degradation
- **Given** `.forgeplan/map/map.json` containing truncated/invalid JSON — or valid JSON violating the schema (e.g. an edge endpoint not in `nodes`),
- **When** the map view loads,
- **Then** for unparseable content the endpoint returns `{ ok: false, data: {}, error }` without throwing; for schema violations `validateMapDocument` returns ALL structured errors (`{ path, message, severity }`, e.g. `edges[2].to → endpoint 'n_ghost' not in nodes`); in both cases the canvas refuses to render and the errors are surfaced to the user.

#### Scenario: 9-views-no-regression
- **Given** the arc branch with `map` registered as the 9th view,
- **When** each of the 8 pre-existing view ids (force, tree, radial, matrix, lanes, sankey, sunburst, idef0) is selected,
- **Then** each renders identically to the base branch (additive registration only), and selecting `map` renders the map — NOT the Lanes fallback (dispatch branch precedes the fallthrough).

#### Scenario: EN-label + neutral-zone-chrome conformance (§15/§16)
- **Given** the checkpoint document rendered in light theme and in dark theme,
- **When** zones and cards are inspected,
- **Then** all card and zone labels are the document's ENGLISH strings verbatim; zone chrome is neutral (subtle `var(--zone)` fill, dash-dot `var(--zone-line)` border, serif title, mono sub) with 0 per-zone accent fills and 0 accent rule bars; kind-colored borders appear ONLY on decision-trail artifact cards + `gate`/`truth`; every color resolves from a theme token (0 raw hex/rgb literals in the new components).

#### Scenario: pure-layout determinism (+ append stability)
- **Given** the same validated document passed to `computeComposedLayout` twice (fresh calls),
- **When** the two outputs are compared,
- **Then** they are deep-equal (byte-identical positions);
- **And given** the same document with one node appended to a zone without increasing that zone's row count,
- **When** laid out,
- **Then** every other node's position is byte-identical to the pre-append layout (pinned cols + stable `(zone, layer, found_at → id)` sort); a row-adding append translates only downstream zones by the row delta, intra-zone relative positions unchanged.

## Out of scope

- **Phase 2+ behaviours** whose fields this schema carries but Phase 1 does not implement: `col_weights`/`row_weights` weighted tracks, `capacity`/`overflow` (`spill`/`collapse`), mega-node collapse/expand, `layers` drill-down band, `increments`-driven FLIP append animation, `edges[].path` hand-routing, freeform explicit-coords zone placement, arrangements other than `stack-ttb`.
- The emitter-side and CLI validation call sites (§20 sites 1–2) — they live in the marketplace/core repos; this SPEC fixes only the web call site against the same rule list.
- The agent pipeline, guardian script, onboarding route/tour, chat panel, append-loop job intake (PRD-036 FR-010–FR-012; Phase 4 is HUMAN-GATED on the rule-22 amendment ADR).
- Any write endpoint, any forgeplan mutation, any subprocess spawn from `/api/*` — rule 22 stays byte-intact this arc.
- Interaction design beyond what C6 restates (pan/zoom mechanics, minimap wiring, click-to-detail panel layout) — owned by the T4 RFC (PRD-036 Q1/Q2).
- The lens/heatmap overlay and colorful zone tinting — explicitly dropped/rejected (§15/§16).

## SMART Acceptance Criteria

1. **AC-1 (validator honesty)**: `validateMapDocument` ships with a unit fixture for EVERY rule row in the E2 catalog (≥14 failing fixtures + ≥1 fully-valid fixture); each failing fixture yields the expected `{ path, message, severity }` entries, the multi-error fixture yields ALL its errors in one call, and 0 fixtures throw — measured by the unit suite green in CI at arc-PR time.
2. **AC-2 (layout determinism)**: the layout unit suite covers same-input-twice deep-equality, the non-wrapping append (all other positions byte-identical), the wrapping append (downstream-translation-only), pinned-cols (column count never derived from node count), and bounded/finite output — all green in CI at arc-PR time.
3. **AC-3 (endpoint honesty + rule 22)**: contract tests cover the 3 automatable E1 rows (present → mirror; missing → `ok:true` empty; malformed → `ok:false` + error, no throw), and the rule-22 verification greps over the new route report 0 spawn/execFile/fetch/write findings and a `GET`-only export — verified in CI/review before the arc PR merges.
4. **AC-4 (edges-only compatibility)**: a compile-time or unit assertion proves every `MapEdge` narrows to a valid `GraphEdge` by dropping the optional keys (the Liskov invariant of C2), and the checkpoint document's edges pass that narrowing — green at arc-PR time.
5. **AC-5 (checkpoint document conformance)**: the committed hand-written `map.json` passes `validateMapDocument` with 0 errors and satisfies the FR-007 minima (≥2 zones, ≥3 node kinds, ≥1 edge, ≥1 flow, ≥1 zone connector) — asserted by a unit test that loads the real file, green at arc-PR time.

## Open Questions

- Q1: `MapResponse.data` for the empty case — literal `{}` vs a typed empty document: does the poller/view branch on `"schema" in data`? — owner: TBD (T4 RFC; this SPEC fixes the envelope, the RFC fixes the discriminant)
- Q2: Poll interval for the map poller (existing pollers use ~8–10 s; §23 mentions 8 s) — owner: TBD (T4 RFC)
- Q3: Severity taxonomy alignment — should web-side `warning`s render as a non-blocking notice while `error`s block the canvas, and does the shared §20 rule list distinguish them the same way? — owner: TBD (T4 RFC, with the map-pack repo)
- Q4: Checkpoint document content — which real ForgePlanWeb zones/flows it depicts (inherits PRD-036 Q5) — owner: TBD (curator)

## Related Artifacts

- **PRD-036** (`based_on` — parent): Composed-map graft + onboarding (T4); this SPEC is the technical contract for its Phase-1 FR-001–FR-007 and AC-1–AC-4.
- **EPIC-001**: T4 child row + GATE-C (ordering superseded — hand-written render-proof first, §23 safety control #1).
- **docs/PROJECT-MAP-SPEC.md**: §4 schema, §8 files/compatibility, §15 EN/RU, §16 neutral chrome, §19 grid engine, §20 three-site validation, §22 canonical composition, §23 build order — the authoritative design source this contract freezes for Phase 1.
- **Rule 22** (`.claude/rules/22-readonly-proxy.md`): governance boundary the C5 endpoint contract is written against.
- **PRD-034 / RFC-029**: T2 idef0 view — the 9-view baseline of the no-regression scenario.
- **Planned this wave**: T4 RFC (interaction design, budgets, Q1–Q3) · rule-22 amendment ADR (draft-only, human-gated; Phase 4 only).
- **EvidencePack**: Phase-1 checkpoint evidence (CL3 test) minted at prove-phase; activation of this SPEC requires it (R_eff > 0, rule 11) and belongs to the guardian/orchestrator.


