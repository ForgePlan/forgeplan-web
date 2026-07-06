---
depth: standard
id: RFC-032
kind: rfc
last_modified_at: 2026-07-06T07:22:29.155536+00:00
last_modified_by: claude-code/2.1.201
links:
- target: PRD-038
  relation: based_on
- target: RFC-031
  relation: refines
status: active
title: 'Prefer-emitted layer-render seam: read-only /api/map/layers/<zone> mirror with deriveSubDocument fallback'
---

## Status

draft

> **SPARC Architecture phase.** This RFC documents **HOW** the **E3 layer-render seam** of
> PRD-038 (T4 Phase-3) is built — specifically PRD-038 Pillar A **FR-002** (render map-pack-emitted
> per-zone layers on descend) and **FR-003** (honest empty-state when no layer). It is a **THIN**
> RFC scoped to one seam; the Phase-3 daemon / WebSocket / `/onboard` tour surfaces (Pillars B & C)
> are separate work and out of scope here.
>
> **Design is FIXED, not re-opened.** The direction is the user's approved decision **FD-6**
> (prefer-emitted-with-fallback) plus a **cross-repo contract already frozen** in
> `forgeplan-map-pack` (its `/map-build-layer "<zone>"` command emits the sibling-file shape). This
> RFC records that design and the option analysis behind it; it does not re-litigate FD-6.
>
> **ADI note (HARD RULE 2).** `forgeplan_reason PRD-038` was invoked and returned *"LLM provider
> unavailable or not configured"* — the workspace MCP server is stale for reasoning (the identical
> gap PRD-038 and RFC-031 both recorded, despite the configured `claude-code/claude-opus-4-8`
> provider). The Abduction → Deduction → Induction cycle was therefore run **manually** over the two
> contested implementation surfaces (layer file shape; sub-level data source) and is recorded in
> **Options Considered**.

## Summary

Give the composed-map **curated depth when it exists, honest guidance when it does not** by teaching
the descend seam to **prefer a map-pack-emitted per-zone layer** over the RFC-031 client-derived
fallback.

The layer is a **sibling file** on disk — `<workspaceRoot>/.forgeplan/map/layers/<zone>.json`, a
full `forgeplan.map/v1` document — emitted append-only, on-demand, by `forgeplan-map-pack`'s
`/map-build-layer "<zone>"`. The web reads it through **exactly one new server surface**: a GET-only,
`readFileSync`-only, **verbatim mirror** endpoint `GET /api/map/layers/<zone>`, modelled 1:1 on the
existing `/api/map` mirror (rule 22). The server does **no** validation, spawn, write, mutation, or
network — validation stays the client's job (SPEC-006 C4).

On descend into a **top-level zone**, `ComposedMapView` fetches the layer, runs the same client-side
`validateMapDocument`, and — when a valid layer is present — renders it **as the level's document
through the same `computeComposedLayout` pipeline** the root map uses (the emitted layer is itself a
full document, so it is treated exactly like level 0). When the layer is **absent** (ENOENT) or
**invalid**, the view **falls back silently** to the existing RFC-031 `deriveSubDocument` un-hide — so
the sub-map always renders, never dead-ends — and (FR-003) surfaces a copyable `/map-build-layer
"<zone>"` hint alongside the fallback. Prefer-generated-fallback-derived buys depth without losing the
offline, model-free RFC-031 baseline.

No `map.json` change, no layer schema change (both owned by `forgeplan-map-pack`), no browser-initiated
mutation. The endpoint needs a **read-only** rule-22 allow-list amendment — categorically distinct from
ADR-008's human-gated **write** amendment.

## Motivation

PRD-038 Problem #1, verbatim: *"a drilled-into zone is laid out by the client-derived fallback
(`deriveSubDocument`, RFC-031) even when `forgeplan-map-pack` v0.7.1 has already emitted a curated,
architecture-quality per-zone layer at `.forgeplan/map/layers/<zone>.json`. The richer emitted layer is
on disk and unused; and a zone with no emitted layer gives the user no way forward."*

RFC-031's drill-down only **un-hides raw children**: it expands a collapsed mega into its child cards
and groups them deterministically. That is correct and offline, but it is not curated — it has no
sub-zones the author chose, no per-zone flows, no RU narration. The emitted layer is richer by
construction: e.g. `z.decisions` ships as **8 program-arc sub-zones + 11 decision-trail flows**, each
with its own `description_ru`. That material is already on disk; the seam's job is to prefer it when
present and degrade honestly when absent.

**Load-bearing facts that shape the design:**

- **The layer is a full `forgeplan.map/v1` document.** It carries its own `zones` / `nodes` / `edges` /
  `flows` / `composition`, so it renders through the **unchanged** `computeComposedLayout` exactly as
  the root map does at level 0 — no new render path, no `deriveSubDocument` for the emitted case.
- **The layer is a sibling file, not inline in `map.json`.** This is a frozen cross-repo contract
  (PRD-038 Pillar A / Non-Goals; `forgeplan-map-pack` `/map-build-layer` ships the sibling-file shape;
  map-pack's append-only, single-writer-per-file discipline — SPEC-003 / RFC-023 / ADR-016 / ADR-017).
  The web **consumes** that shape and changes no emitter code and no schema.
- **The SvelteKit server is a read-only mirror (rule 22).** Reading the layer is therefore a
  file-mirror endpoint (like `/api/map`, `/api/instances`, `/api/update-check`), not a forgeplan
  subcommand — and it must not validate server-side (SPEC-006 C4/C5: validation is the client's, the
  server is a "dumb honest mirror").

**Constraints this seam honours** (from PRD-038 FD-6/FR-002/FR-003/NFR-001..NFR-002, SPEC-006 C3/C4,
RFC-031): prefer-emitted-with-fallback; **read-only, GET-only, no spawn/write/network**; **client
validates, server mirrors verbatim**; ENOENT is a **normal** "no layer yet" state, never an error;
zero regression to the RFC-031 derived path, the flat map, and the 8 legacy views; the fallback (and
thus the offline/model-free baseline) needs **no** new server call; live-only (no time-travel layers,
matching RFC-031 Invariant 8).

## Options Considered

Two genuinely contested implementation surfaces. Both cycles ran manually (`forgeplan_reason`
unavailable). The **direction** (FD-6 + the sibling-file contract) is fixed; the ADI confirms it
dominates and surfaces the hidden assumptions the Proposed Direction resolves.

### ADI cycle A — Layer file shape (inline in `map.json` vs sibling files)

**Abduction (≥3 hypotheses).**
- **A1 — Sibling files.** One file per zone at `.forgeplan/map/layers/<zone>.json`, each a full
  `forgeplan.map/v1` document; fetched on-demand via `/api/map/layers/<zone>`.
- **A2 — Inline in `map.json`.** Embed each zone's sub-map under the root document (e.g.
  `zones[].layer` or a top-level `layers{}` map), served by the existing `/api/map`.
- **A3 — Single bundled `layers.json`.** All layers in one auxiliary file fetched once.

**Deduction (against: poll cost, append-stability, independent per-zone generation, rule 22,
cross-repo contract).**
- **A2** balloons `map.json`: the 170-artifact `z.decisions` layer would inflate the top-level
  document that the 10 s poller re-downloads **every cycle**, whether or not any zone is descended
  into; regenerating one zone's layer mutates the whole root doc → breaks root-level append-stability
  and forces the top-level generator to own per-zone generation. It contradicts map-pack's frozen
  **append-only, single-writer-per-file** model (`/map-build-layer` writes one sibling file).
- **A3** is a smaller version of the same coupling: one write touches every consumer's fetch; still
  pays for undescended zones; still forks the map-pack contract.
- **A1** fetches a layer **only when its zone is descended into** (zero cost for undescended zones),
  keeps `map.json` small and append-stable, lets each layer be generated and guardian-confirmed
  independently, and **is the shape map-pack already emits** — the web changes no emitter code and no
  schema.

**Induction.** **A1 (sibling files) — chosen.** It is also the frozen cross-repo contract; the ADI
confirms it dominates on poll cost, append-stability, and independent per-zone generation. Hidden
assumption surfaced: reading a sibling file needs a **new server surface** → resolved as a GET-only,
read-only, no-validation mirror (Proposed Direction), a read-only rule-22 amendment, **not** ADR-008's
write amendment.

### ADI cycle B — Sub-level data source when a layer exists (prefer-emitted-with-fallback vs replace-derived vs derived-only)

**Abduction (≥3 hypotheses).**
- **B1 — Prefer-emitted-with-fallback.** Render the emitted layer when present + valid; otherwise fall
  back to the RFC-031 `deriveSubDocument` un-hide.
- **B2 — Replace derived entirely.** Rip out `deriveSubDocument`; require an emitted layer for every
  descendable zone.
- **B3 — Derived-only (status quo).** Ignore emitted layers; keep only RFC-031.

**Deduction (against: comprehension-when-available, zero-regression floor, offline/model-free
baseline).**
- **B2** dead-ends every zone lacking a layer — and layers are **on-demand / append-only**, so most
  zones will not have one yet; it also loses the offline baseline (the derived path needs no server
  file, works from the already-loaded doc). A hard regression from RFC-031.
- **B3** leaves the richer curated layer on disk **unused** — the exact gap PRD-038 Problem #1 names;
  comprehension loss.
- **B1** uses the best available and keeps RFC-031 as the **guaranteed floor**: an absent/invalid layer
  degrades to the derived un-hide silently; the offline/model-free baseline (PRD-038 Goal 5 / NFR-002)
  is intact because the fallback needs **no** new server call.

**Induction.** **B1 (prefer-emitted-with-fallback) — chosen (FD-6).** Dominates on
comprehension-when-available + zero-regression floor + offline-preserved. Hidden assumption surfaced:
the emitted layer, being a full document, must render through the **same** `computeComposedLayout`
pipeline as the root — not through `deriveSubDocument` — so the two data sources converge on one render
path.

### Chosen

**A1 (sibling files) + B1 (prefer-emitted-with-fallback).** The seam prefers
`.forgeplan/map/layers/<zone>.json` via a read-only mirror endpoint and validates it client-side; a
valid layer renders through the unchanged `computeComposedLayout`; an absent or invalid layer falls
back to the RFC-031 `deriveSubDocument` un-hide plus the `/map-build-layer` hint. Fixed by FD-6 and the
map-pack cross-repo contract; the manual ADI confirms both.

## Proposed Direction

### Module Breakdown

- **`routes/api/map/layers/[zone]/+server.ts`** *(NEW — server)* — the GET-only mirror endpoint.
  Validates the `zone` route param, delegates the read to the `shared/server` helper, returns the
  standard envelope. No spawn / write / network / validation.
- **`shared/server/map.ts` → `readMapLayerFile(zone)`** *(CHANGED — add a sibling to `readMapFile`)* —
  resolves `<workspaceRoot>/.forgeplan/map/layers/<zone>.json`, reads it with `existsSync` +
  `readFileSync` only, asserts the resolved path stays inside the layers directory, mirrors content
  **verbatim**; ENOENT → empty, read/parse failure → error; never throws.
- **`entities/map` → `loadZoneLayer(zone)`** *(NEW — read-only client loader)* — fetches
  `/api/map/layers/<zone>`, runs the existing client `validateMapDocument` (SPEC-006 C4), and maps the
  result to a small discriminated state (`present` / `absent` / `invalid`). Never throws.
- **`entities/map/lib/validate.ts` → `validateMapDocument`** *(UNCHANGED)* — the sole validation gate,
  reused verbatim; the server never calls it (rule 22).
- **`entities/map/lib/composed-layout.ts` → `computeComposedLayout`** *(UNCHANGED)* — renders the
  emitted layer document exactly as it renders the root; the render path is shared.
- **`entities/map/lib/derive-subdocument.ts` → `deriveSubDocument`** *(UNCHANGED)* — the RFC-031
  fallback, kept verbatim as the guaranteed floor.
- **`widgets/composed-map/ui/ComposedMapView.svelte`** *(CHANGED)* — the descend host gains a per-zone
  **layer cache** and the **prefer/fallback branch** in its `activeDoc` derivation, plus the FR-003
  empty-state hint wiring. This is the only view change.
- **`.claude/rules/22-readonly-proxy.md`** *(CHANGED — build wave)* — gains a read-only allow-list
  section for `/api/map/layers/<zone>` (drafted below), mirroring the `/api/map` extension.

### Component Diagram (prose)

`ComposedMapView` is the single stateful host (as in RFC-031). It already owns the validated root
document from the widget-scoped `mapPoller` (`/api/map`, RFC-030 SD-1, unchanged) and the RFC-031
`levelStack`. On a descend into a **top-level** zone it calls the entity loader `loadZoneLayer(zone)`,
which issues a browser `fetch` to the **read-only** `GET /api/map/layers/<zone>` endpoint. That
endpoint delegates to `shared/server/map.ts#readMapLayerFile`, which reads the sibling file with
`readFileSync` and returns it verbatim in the standard envelope — it talks to no `forgeplan` binary, no
network, no filesystem write. Back in the browser, `loadZoneLayer` runs `validateMapDocument`
(`entities/map`) on the mirrored content and returns a `present` / `absent` / `invalid` state into the
view's per-zone `layerCache`. The view's `activeDoc` derivation then branches: a `present` layer flows
straight into `computeComposedLayout` (the same function the root uses); an `absent` / `invalid` layer
flows into the RFC-031 `deriveSubDocument(rootDoc, zone) → computeComposedLayout` fallback. Data is
strictly one-way — `endpoint → verbatim JSON → validate → layerCache → activeDoc → computeComposedLayout
→ SVG`. No module reaches a mutating subcommand; the SvelteKit server never learns what a "layer" means
beyond a file path.

### Data Flow

**Render — descend into a top-level zone WITH an emitted layer (primary, FR-002 / PRD-038 AC-1).** User
descends into `z.decisions`. `ensureLayer("z.decisions")` sets `layerCache["z.decisions"] = {loading}`
and, so the UI never blocks, the view **renders the RFC-031 derived fallback immediately** while the
fetch is in flight. `loadZoneLayer` fetches `/api/map/layers/z.decisions` → the endpoint returns
`{ ok:true, data:<verbatim forgeplan.map/v1 layer> }` → the client runs `validateMapDocument` → valid →
`layerCache["z.decisions"] = {present, doc}`. `activeDoc` re-derives to the layer doc; the view renders
it via `computeComposedLayout` (its 8 sub-zones + 11 flows) — swapping the fallback for the curated
layer. A `meta.status: "proposed"` (guardian-unconfirmed) but structurally valid layer is treated as
`present` and **renders** (see OQ3).

**Render — descend into a zone with NO emitted layer (FR-003, honest empty-state).**
`loadZoneLayer` fetches the endpoint → ENOENT → `{ ok:true, data:{} }` → the client maps the empty
object to `{absent}`. `activeDoc` uses the RFC-031 `deriveSubDocument` fallback (unchanged), and the
view surfaces a **copyable `/map-build-layer "<zone>"` hint** alongside the derived sub-map — never as
an error, never blocking the fallback render (mirrors the existing `/map-build` empty-state pattern).

**Failure path — the emitted layer is unreadable / malformed / fails validation.** Either the server
returns `{ ok:false, data:{}, error }` (unreadable/unparseable file), or the client's
`validateMapDocument` rejects the parsed content → `{invalid, reason}`. In both cases the view **falls
back to the derived sub-map** (so a sub-map still renders — graceful degrade) and shows the same hint;
the malformed layer is never rendered. Loudness of this case (silent vs a small notice) is **OQ4**.

**Non-top-level descend (level ≥ 2) — MVP scope.** Nested layers
(`.forgeplan/map/layers/<ancestor>/<zone>.json`) are **out of scope** (OQ1); a descend below level 1
fires **no** layer fetch and uses the RFC-031 derived path directly.

**Time-travel.** Emitted layers are **live-only** (no historical layer reconstruction), matching
RFC-031 Invariant 8 / SPEC-006 C6. When `isLive` is false the layer cache is not consulted; on resume
the flat live doc re-renders at level 0 and layers are re-fetched on re-descend.

### Function Signatures / Component Contracts

```ts
// shared/server/map.ts — ADD (sibling to the existing readMapFile)
export interface MapLayerReadResult {
  ok: boolean;
  data: unknown;          // the layer file's parsed content VERBATIM, or {} on ENOENT
  error?: string;
}

// Resolves path.join(workspaceRoot(), ".forgeplan", "map", "layers", `${zone}.json`).
// - existsSync + readFileSync ONLY — no spawn, no write, no network, no validateMapDocument.
// - Path-traversal defence: after resolution, assert the real path is a child of
//   <workspaceRoot>/.forgeplan/map/layers/ ; if not, return { ok:false, data:{}, error }.
// - ENOENT              -> { ok:true,  data:{} }            (NORMAL "no layer yet")
// - read / JSON error   -> { ok:false, data:{}, error }     (never throws)
// - present + parseable -> { ok:true,  data:<verbatim> }
export function readMapLayerFile(zone: string): MapLayerReadResult;
```

```ts
// routes/api/map/layers/[zone]/+server.ts — NEW (GET only)
// Zone ids are dotted slugs (e.g. "z.decisions"), NOT forgeplan ids, so the forgeplan
// ^[A-Z]+-[0-9]+$ regex does NOT apply. Validate against a strict slug that permits the
// dot but forbids traversal, as defence-in-depth alongside the reader's path assertion.
const ZONE_ID_RE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;   // no leading/trailing sep; bounded length in impl

export const GET: RequestHandler = ({ params }) => {
  const zone = params.zone;
  if (!ZONE_ID_RE.test(zone) || zone.includes("..")) {
    return json({ ok: false, data: {}, cmd: "map:layer:read", error: "invalid zone id" }); // HTTP 200
  }
  const r = readMapLayerFile(zone);
  return json({ ok: r.ok, data: r.data, cmd: "map:layer:read", ...(r.error ? { error: r.error } : {}) });
};
// HTTP 200 in EVERY handled case (mirrors /api/map). NO other HTTP verb is exported.
```

```ts
// entities/map — NEW read-only client loader
export type ZoneLayerState =
  | { status: "loading" }
  | { status: "present"; doc: MapDocument }   // emitted layer, passed validateMapDocument
  | { status: "absent" }                       // endpoint returned {} (ENOENT) -> fall back + hint
  | { status: "invalid"; reason: string };     // endpoint error OR validateMapDocument fail -> fall back + hint

// Fetch + client-validate + normalize. Treats network/fetch failure as { invalid } (never throws).
// Empty-object payload ({}) -> { absent }. Non-empty payload -> validateMapDocument decides present|invalid.
export async function loadZoneLayer(zone: string): Promise<ZoneLayerState>;
```

```ts
// widgets/composed-map/ui/ComposedMapView.svelte — CHANGED (view internals)
let layerCache = $state<Map<string, ZoneLayerState>>(new Map());

// Kick off (idempotent) the fetch+validate for a top-level zone on descend; populates layerCache.
function ensureLayer(zone: string): void;   // sets {loading}, awaits loadZoneLayer, stores result

// activeDoc branches per level: emitted layer when present (rendered like the root),
// else the RFC-031 derived fallback. Level 0 == rootDoc, unchanged.
const activeDoc = $derived.by<MapDocument | null>(() => {
  if (!okDoc) return null;
  const chain = focusChain(levelStack);            // RFC-031
  if (chain.length === 0) return okDoc;            // level 0: flat map, unchanged
  const zone = chain[0];                           // top-level zone (MVP: only level 1 consults a layer)
  const st = layerCache.get(zone);
  if (chain.length === 1 && st?.status === "present") return st.doc;   // PREFER emitted -> computeComposedLayout
  return chain.reduce((d, fid) => deriveSubDocument(d, fid), okDoc);   // FALLBACK (RFC-031), + FR-003 hint
});

// FR-003: show the copyable hint when the descended top-level zone's layer is absent|invalid.
const showLayerHint = $derived.by(() => { /* chain.length===1 && st is absent|invalid */ });
const layerBuildHint = $derived(`/map-build-layer "${focusChain(levelStack)[0] ?? ""}"`);
```

### Rule-22 amendment (drafted here; applied to `.claude/rules/22-readonly-proxy.md` in the build wave)

A new read-only allow-list section, modelled on the existing `/api/map` extension:

> **Allow-list extension: `/api/map/layers/<zone>` (non-forgeplan; PRD-038 / RFC-032)**
> Read-only mirror of an emitted per-zone layer at
> `<workspaceRoot>/.forgeplan/map/layers/<zone>.json` (a full `forgeplan.map/v1` document), backing
> the composed-map descend seam (PRD-038 FR-002/FR-003).
> - Method: `GET` only.
> - File path: `path.join(workspaceRoot(), ".forgeplan", "map", "layers", zone + ".json")`; the
>   `<zone>` route param is validated (`ZONE_ID_RE`, no `..`) and the resolved path is asserted to
>   stay within the layers directory. No other interpolation.
> - **No spawn, no Forgeplan invocation, no network.** Reads via `node:fs.readFileSync` only, inside
>   `shared/server/map.ts#readMapLayerFile`. Content mirrored **verbatim**; the endpoint performs
>   **NO** structural validation and MUST NOT call `validateMapDocument` (validation is the client's
>   job, SPEC-006 C4/C5 — the same "dumb honest mirror" rule as `/api/map`).
> - Envelope `{ ok, data, cmd: "map:layer:read", error? }`, HTTP 200 in every handled case: present +
>   parseable → `{ ok:true, data:<verbatim> }`; ENOENT → `{ ok:true, data:{} }` (a NORMAL "no layer
>   yet" state, never an error); unreadable/unparseable/invalid-zone → `{ ok:false, data:{}, error }`
>   — never a thrown exception.

This is a **read-only** amendment, **categorically distinct** from ADR-008's human-gated **write**
amendment for the append/deeper-scan loop (PRD-038 Non-Goals). The two must not be conflated.

## Implementation Phases

- **Phase 1 — Server mirror (`shared/server/map.ts` + `routes/api/map/layers/[zone]/+server.ts`).**
  Add `readMapLayerFile` (path resolution + traversal assertion + ENOENT/error handling) and the
  GET-only endpoint (zone-id validation + envelope). Land the endpoint/reader contract tests first
  (present / ENOENT / malformed / traversal / GET-only). Rule-22 grep must report 0 new
  spawn/write/network/validate call sites.
- **Phase 2 — Client loader (`entities/map`).** Add `loadZoneLayer` (fetch + `validateMapDocument` +
  `present`/`absent`/`invalid` mapping; never throws). Unit-test each mapping incl. fetch failure and
  empty-object payload.
- **Phase 3 — Seam wiring (`ComposedMapView.svelte`).** Add `layerCache` + `ensureLayer`, the
  `activeDoc` prefer/fallback branch (top-level only), and the FR-003 hint. Guard: level 0 + the 8
  legacy views + the RFC-031 derived path (no-layer zones) render unchanged.
- **Phase 4 — Rule-22 amendment + empty-state polish.** Apply the read-only allow-list section to
  `.claude/rules/22-readonly-proxy.md`; wire the copyable `/map-build-layer "<zone>"` hint UI
  (token-only, dual-theme; reuse `shared/ui`, rule 24).
- **Phase 5 — Prove.** Distinguishing-fixture demonstration that a zone WITH an emitted layer renders
  the emitted layer (not the derived fallback) — PRD-038 AC-1; parity smoke on a no-layer zone;
  `svelte-check` + `vitest` green; rule-22 verification greps. Latency budgets (endpoint fetch +
  render on descend) are **TBD — measured on the real map-pack v0.7.1 map and recorded in the
  EvidencePack (CL3 measurement), never invented here.** EVID linked `informs` PRD-038 / RFC-032
  before any activation (rule 11, R_eff > 0).

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Path traversal via a crafted `<zone>` param (`..`, encoded separators) reads outside the layers dir | med | high | `ZONE_ID_RE` + explicit `..` reject at the endpoint **and** a resolved-real-path prefix assertion inside `readMapLayerFile` (defence in depth); traversal unit tests incl. encoded variants |
| Endpoint mistaken for / grows into a mutation or validation surface (rule 22 drift) | low | high | Read-only allow-list amendment fixes the contract; `readFileSync`-only reader; **no** `validateMapDocument` server-side; rule-22 greps in Phase 5 assert 0 spawn/write/network/validate |
| Emitted layer schema drifts from the client `validateMapDocument` (cross-repo skew map-pack ↔ web) | med | med | Client `validateMapDocument` is the single gate — a skewed layer fails validation → **falls back** to the derived sub-map (never renders malformed); version-skew handling is **OQ2** |
| Layer references node ids no longer in the current `map.json`, or `map.json` `meta.version` bumped (staleness) | med | med | Layer renders as a **self-contained** document (its own nodes/edges); it does not cross-reference the root at render time; freshness/cache-invalidation vs `meta.version` is **OQ2**, measured not assumed |
| Layer regenerated out-of-band mid-session → cache serves a stale layer | low | low | Per-session per-zone cache; cheap re-fetch on re-descend; explicit invalidation cadence is **OQ2** |
| A `proposed` (guardian-unconfirmed) layer rendered as if authoritative | med | low | MVP renders a structurally-valid `proposed` layer (it is on disk by the user's `/map-build-layer`); whether to badge/gate on `confirmed` is **OQ3** |
| Emitted vs derived sub-maps look different for the same zone → user confusion about "which is real" | med | low | By design the emitted layer is richer and preferred; an affordance indicating curated-vs-derived is **OQ5** |
| Regression to the RFC-031 derived path, the flat map, or the 8 legacy views | low | high | `deriveSubDocument` + `computeComposedLayout` unchanged; the branch only *prefers* the layer when `present`; no-layer zones take the identical RFC-031 path; non-regression smoke across all view ids |
| Blocking the UI while the layer fetch is in flight | low | med | Render the derived fallback immediately; swap to the emitted layer only when `loadZoneLayer` resolves `present` (non-blocking) |

## Test Strategy Hooks

Targets for the downstream `tester` / `coder` (hooks, not full cases):

- **Endpoint contract** — present file → `{ ok:true, data:<verbatim> }`; ENOENT → `{ ok:true,
  data:{} }`; unreadable/malformed JSON → `{ ok:false, error }`; invalid zone id / `..` traversal →
  `{ ok:false }` with **no** file read outside the layers dir; **GET-only** (no POST/PUT/etc.
  exported); rule-22 grep over the route + reader shows **no** spawn/write/fetch and **no**
  `validateMapDocument`.
- **Reader unit (`readMapLayerFile`)** — resolved path always inside
  `<ws>/.forgeplan/map/layers/`; never throws on any input; ENOENT vs error distinguished.
- **Client loader (`loadZoneLayer`)** — valid layer → `present`; `{}` payload → `absent`;
  `validateMapDocument` fail → `invalid`; `{ ok:false }` / network failure → `invalid`; never throws.
- **Seam integration (the distinguishing fixture — PRD-038 AC-1)** — descend into a zone WITH a valid
  emitted layer → `activeDoc` is the **layer doc** (proven to beat the derived fallback); descend into
  a zone WITHOUT → RFC-031 derived fallback **plus** a copyable `/map-build-layer "<zone>"` hint whose
  text substitutes the real zone id; a valid `proposed` layer still renders; a malformed layer falls
  back and a sub-map still renders (graceful degrade).
- **Non-regression** — no-layer descend path byte-identical to RFC-031; level-0 `activeDoc` and the 8
  legacy views unchanged.
- **MVP-scope guard** — a level ≥ 2 descend fires **no** layer fetch and uses the derived path
  (nested layers out of scope, OQ1).

## Open Questions

Handed to the E3 prove-phase EVID and/or a follow-on RFC:

- **OQ1 — Nested layers.** Descent below the first level (`.forgeplan/map/layers/<ancestor>/<zone>.json`)
  is **out of scope** for this MVP (top-level zones only); the follow-up must define the ancestor-path
  addressing, the endpoint route shape, and the map-pack emitter contract for nested layers. — owner:
  follow-on RFC + `forgeplan-map-pack` (SPEC-003).
- **OQ2 — Layer staleness / freshness.** How `/api/map/layers/<zone>` staleness relates to `map.json`
  `meta.version`; cache-invalidation and poll cadence; behaviour when a layer is regenerated
  out-of-band. Ties to PRD-038 **Q6**. — owner: RFC + EVID (measured, not assumed).
- **OQ3 — Proposed-layer rendering.** Render a `meta.status: "proposed"` (guardian-unconfirmed) layer
  as-is (MVP) vs badge it / gate on `confirmed`. — owner: RFC + UX.
- **OQ4 — Invalid-layer surfacing loudness.** Silent fallback (MVP) vs a small "emitted layer failed
  validation — showing derived view" notice. — owner: UX.
- **OQ5 — Curated-vs-derived affordance.** Whether the UI should indicate that a sub-map came from an
  emitted (curated) layer rather than the derived un-hide. — owner: UX.
- **OQ6 — Latency budget.** Endpoint fetch + descend-render budget for PRD-038 NFR-005 — measured on
  the real map and recorded in the EVID, not invented. — owner: EVID.

## Related Artifacts

- **PRD-038** — parent (`based_on`). This RFC delivers its Pillar-A **FR-002** (prefer emitted layer on
  descend) and **FR-003** (honest `/map-build-layer` empty-state), realising **FD-6**
  (prefer-emitted-with-fallback) and the **read-only** rule-22 amendment (distinct from ADR-008's write
  amendment). PRD-038 **Q6** (emitted-layer freshness) is carried here as **OQ2**.
- **RFC-031** — the client-derived recursive drill-down (`refines`). This RFC extends it: the emitted
  layer becomes the preferred source; `deriveSubDocument` stays verbatim as the guaranteed fallback
  floor. The offline/model-free baseline (RFC-031) is preserved because the fallback needs no new
  server call.
- **SPEC-006 / RFC-030 / PRD-036** — the `forgeplan.map/v1` render contract. The emitted layer is
  itself a full `forgeplan.map/v1` document, validated by the same client `validateMapDocument`
  (SPEC-006 C4) and rendered by the same `computeComposedLayout` (RFC-030). No schema change (map-pack
  owns the schema).
- **Rule 22** (`.claude/rules/22-readonly-proxy.md`) — the read-only proxy boundary; gains the
  `/api/map/layers/<zone>` read-only allow-list section (modelled on the `/api/map` extension).
- **ADR-008** — the rule-22 **write** amendment for the append/deeper-scan loop (Phase 5, draft-only,
  human-gated). **Deliberately separate** from this arc's read-only amendment.
- **`forgeplan-map-pack`** (marketplace; SPEC-003 / RFC-023 / ADR-016 / ADR-017) — the emitter of
  `.forgeplan/map/layers/<zone>.json` and the `/map-build-layer "<zone>"` command; the frozen
  sibling-file cross-repo contract this RFC consumes **unchanged**.
- **EvidencePack (pending)** — E3 seam checkpoint (distinguishing-fixture prove that emitted beat
  derived; endpoint contract + rule-22 greps; latency measurement), minted at prove-phase and linked
  `informs` before any activation (rule 11, R_eff > 0).

## References

- `template/src/routes/api/map/+server.ts` — the existing `/api/map` read-only verbatim mirror this
  endpoint is modelled on 1:1.
- `template/src/shared/server/map.ts` — `readMapFile` (the ENOENT-tolerant, `readFileSync`-only mirror
  reader); `readMapLayerFile` is added as its sibling.
- `template/src/entities/map/lib/composed-layout.ts` — `computeComposedLayout`, renders the emitted
  layer document unchanged (shared render path).
- `template/src/entities/map/lib/derive-subdocument.ts` — `deriveSubDocument`, the RFC-031 fallback,
  kept verbatim.
- `template/src/entities/map/lib/validate.ts` — `validateMapDocument`, the SPEC-006 C4 client validator
  reused; the server never calls it.
- `template/src/widgets/composed-map/ui/ComposedMapView.svelte` — the descend host; gains the
  `layerCache` + prefer/fallback `activeDoc` branch + FR-003 hint.
- `.claude/rules/22-readonly-proxy.md` — the file gaining the read-only `/api/map/layers/<zone>`
  allow-list section.
- `docs/PROJECT-MAP-SPEC.md` / MASTER-SPEC — §15 (interaction + EN/RU language rule), §17 (onboarding /
  layer authoring), §23 (FINAL design — emitted per-zone layers).





