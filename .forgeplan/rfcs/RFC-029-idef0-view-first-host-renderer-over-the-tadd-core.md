---
depth: standard
id: RFC-029
kind: rfc
last_modified_at: 2026-07-02T10:25:45.594256+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-034
  relation: based_on
- target: RFC-028
  relation: based_on
status: active
title: idef0 view — first host renderer over the TADD core
---

## Status

draft — EPIC-001 Phase 2 (T2 track), GATE-A. Activation is owned by the guardian gate + orchestrator once conformance EVIDENCE (SPEC-005 scenarios green) is linked and R_eff > 0 (rule 11). Ships `draft` by design.

**Revision (post-C4 CONCERNS, 2026-07-01):** two independent C4 reviews — EVID-060 (system-dev staff audit) and EVID-061 (architect review) — returned **CONCERNS (no redesign)**. This revision closes their findings by binding the tier-stack fallback layout to the core's already-bounded `diagram`, correcting the rollup/`window` data-flow to match the shipped core, specifying the focus-key resolver, and extending the blast-radius/no-regression scope to the mosaic view-tiler. The design spine (A2 hybrid render + B3 drill + one pure `Idef0Layout` + pure consumer of the frozen core) is **unchanged** — the reviewers confirmed it is sound, additive, and reversible.

Parent: PRD-034 (`based_on`), RFC-028 (`based_on` — the core this view consumes). Render contract: SPEC-005. Framing: ADR-007 (idef0 = IDEF0-STYLE projection; I=left/C=top/O=right/M=bottom; real=solid/derived=dashed ≈). This RFC owns **presentation only** — no derivation, classification, numbering, or density logic (all frozen in the T1 core).

## Summary

RFC-029 specifies the **first host renderer** over the frozen headless TADD/ICOM core (`template/src/shared/lib/idef0/`, RFC-028). It adds a **9th** dependency-graph view, `idef0`, that calls the core's single entry point `deriveIdef0(raw, opts)` once per snapshot and renders its output as an **A3 two-pane surface**: a **windowed altitude-outline pane** (real forest rows, never dashed) beside an **ICOM decomposition-diagram pane** (one materialised level: focus box + ≤6 children + rollup, with ICOM arrows on the four conventional sides), plus a **permanent ICOM legend** and an **honest mode indicator** driven by `verdict.mode`.

Both diagram-pane modes are rendered from the core's **already-bounded, non-null `Idef0Diagram`** (`computeIdef0Diagram` caps at focus + ≤6 children + rollup; `computeTierStackDiagram` caps at ≤6/tier + rollup) — the host layout **never** materialises one box per artifact off the raw `tierStack.tiers[].members`. This keeps the DOM bounded on **both** the dense path and the **live** tier-stack fallback path (density ≈0.095 today), which is the correction at the heart of this revision (EVID-061 F1). The core computes **no geometry** ("layout is a host concern" — SPEC-004 FR-007); the one genuinely new algorithmic piece here is a **pure, deterministic ICOM layout** helper (`widgets/dependency-graph/lib/idef0-layout.ts`) that turns the core's coordinate-free `Idef0Diagram` into px geometry consumed identically by the DOM boxes and the SVG arrow overlay. The view is **purely additive** (one selectable entry + one render branch), consumes the existing read-only dual-poll snapshot (no new endpoint, rule 22), and re-implements none of the core's logic (EPIC-001 Outcome 5). The two load-bearing design choices — (a) ICOM diagram rendering approach and (b) the focus/drill interaction model — are decided in Options Considered below via `forgeplan_reason RFC-029`.

## Motivation

EPIC-001 Phase 1 shipped a pure, deterministic, headless decomposition core, but **nothing renders it** — a headless core delivers zero user-visible value. PRD-034 (GATE-A) commits to a **dedicated additive view** (its ADI H1, High) as the first surface that proves the core is *renderable* (Outcome 5) and *honest* (Outcome 6) end-to-end, without forking the algorithm and without regressing the seven shipped views. SPEC-005 freezes the observable render behaviour (RC-1…RC-8, twelve `#### Scenario` blocks). This RFC turns that capability + contract into concrete modules, a component contract bound to the **exact** `deriveIdef0` options-object signature, the new ICOM layout algorithm, the registration plan, and the test-hook plan (including a synthetic DENSE fixture, since today's dogfood density ≈0.095 < 0.3 routes the core to the honest tier-stack fallback — so the dense path is otherwise unreachable under CI).

The design levers PRD-034 depends on are all realised here and — post-revision — realised **honestly against the shipped core**: (i) a windowed outline (`flattenOutline(forest, window)` is the *only* core path that honours `window`) **and** a bounded diagram (≤6 + rollup, per mode, independent of `window`) ⇒ **both panes bounded** at N≥1000 (NFR-001/AC-6/RC-5); (ii) solid/dashed provenance from per-element `provenance`; (iii) render-the-returned-mode (never upgrade a fallback). The revision removes the earlier claim that collapsed diagram children are paged by re-invoking the core with `window` (the shipped `computeIdef0Diagram`/`computeTierStackDiagram` ignore `window`), replacing it with the honest, core-backed reveal path: **drill into a real child**, or **jump via the windowed outline** (EVID-061 F2 / EVID-060 C-1).

## Module Breakdown + FSD placement

New and edited surfaces. FSD layers: `shared/lib` (pure core, already shipped) → `widgets/dependency-graph` (this view + its layout helper) → `shared/config` (registry) → the widget host. No `entities/`/`pages/` change.

- **`template/src/widgets/dependency-graph/ui/Idef0View.svelte`** *(new — the widget)* — single responsibility: adapt props → `RawSnapshot`, call `deriveIdef0` once per snapshot + focus change, and compose the two panes + legend + mode indicator from `shared/ui` primitives. Owns view-local render state (`focus`, keyboard cursor, outline window offset) and reduced-motion/theme reactivity. Sibling to `ForceView.svelte` / `SunburstView.svelte`. Consumes `shared/lib/idef0` (`deriveIdef0`) + `widgets/dependency-graph/lib/idef0-layout` (geometry) + `shared/ui` primitives.
- **`template/src/widgets/dependency-graph/lib/idef0-layout.ts`** *(new — the layout math)* — single responsibility: the **only** new algorithm. Pure/deterministic px geometry from the coordinate-free core `Idef0Diagram` in **both** modes (idef0: focus/children staircase; tier-stack: altitude bands sourced from the same bounded `diagram.boxes`, grouped by the `T<n>` number-prefix). No DOM, no core mutation, no derivation.
- **`template/src/widgets/dependency-graph/lib/idef0-layout.test.ts`** *(new)* — Vitest (`pool:'threads'` per the repo's macOS fork-limit convention; runs in `node` env — pure layout, no DOM) over a committed synthetic DENSE fixture + tier-stack fixture; asserts SPEC-005 scenarios at the layout boundary.
- **`template/src/shared/config/ui-prefs.ts`** *(edited — registry)* — three-place registration (`GraphView` union, `GRAPH_VIEWS`, `GRAPH_VIEW_IDS` auto-derives). Blast-radius: this registry has **two** consumers — the dependency-graph switcher **and** the mosaic/composed-map view-tiler (see below + Risks).
- **`template/src/widgets/dependency-graph/ui/DependencyGraph.svelte`** *(edited — host)* — one new `{:else if view === 'idef0'}` branch, placed **after** the `sunburst` branch and **before** the final `{:else}` (LanesView).
- **Auto-affected consumers of the shared registry (not edited, but in blast radius — EVID-060/061 F4):** `template/src/widgets/mosaic/ui/MosaicCanvas.svelte` (`nextAvailableView()`/`onAddPane()` iterate `GRAPH_VIEWS`) and `template/src/widgets/mosaic/lib/persist.ts` (`allViewsKnown` validates persisted panes against `GRAPH_VIEW_IDS`). Registering `idef0` **auto-enrols** it as a selectable mosaic pane and into layout persistence. This is the **existing view-tiling feature** and is **in scope** — it is NOT the T4 §23 composed-map graft that PRD-034 fences off. It MUST be covered by a no-regression scenario (mosaic still tiles all views; `idef0` renders correctly in a constrained pane viewport; persistence round-trips).
- **Explicitly untouched (symbol-frozen):** `shared/lib/idef0/*` (consumed, never edited), `widgets/dependency-graph/lib/relation.ts` / `normaliseHierarchyEdge` / `HIERARCHY_RELATIONS` (ADR-006/ADR-007 blast-radius guard), and the seven existing view components.

Note (from memory / PROJECT-MAP-SPEC): this `idef0` id must **not** consume the reserved `map`/composed slot (T4). It is a distinct 9th view.

## Component Diagram (prose)

Topology, described in words (no drawn diagram in the RFC body):

> The widget host `DependencyGraph.svelte` owns view selection and passes the live snapshot (`nodes: ArtifactSummary[]`, `edges: GraphEdge[]`, `scores`, `selectedId`, `onSelect`, plus the shared `openedIds`/`kindFilter`/`statusFilter`) down to `Idef0View.svelte` on the `idef0` branch, exactly as it does for the other eight. `Idef0View` calls a **host adapter** (inline) that (a) maps props → `RawSnapshot` and (b) resolves the bare `selectedId` string → a `CompositeKey` focus seed by node lookup, then calls `deriveIdef0(raw, { threshold, focus, window })` **synchronously** (pure, no I/O). The returned `DeriveResult` fans out to three read-only consumers inside the widget: the **outline pane** reads `result.outline` (rows, windowed by `window`), the **diagram pane** reads `result.diagram` (bounded in **both** modes) via `layoutIdef0Diagram(...)` / `layoutTierBands(...)`, and the **chrome** (legend, mode indicator) reads `result.diagram.legend` + `result.verdict`. `layout*` are leaf pure functions: core `Idef0Diagram` (+ `tierStack` **only for band labels/kind** in fallback mode) → `Idef0Layout` (px), consumed by both the absolutely-positioned DOM boxes and the single SVG arrow-overlay layer — both read the *same* layout object, so the two coordinate consumers cannot drift. No edge leaves the widget toward the network; the only data source is the snapshot the host already polls (rule 22).

## Data Flow

**Primary flow (happy path, dense mode):** the dual-poller refreshes `nodes`/`edges` (~10 s) → host re-renders `Idef0View` with new props → adapter builds `RawSnapshot { nodes:[{id,title,kind}], edges:[{from,to,relation}] }` and resolves the focus seed (`resolveFocusKey(selectedId, nodes)`, see Contracts) → `deriveIdef0(raw,{threshold:0.3, focus, window})` returns `{ forest, tierStack, verdict, diagram, outline, signature }` → `verdict.mode === "idef0"` selects the dense path → `layoutIdef0Diagram(diagram)` produces `Idef0Layout` → DOM boxes render at `(x,y,w,h)` (solid when `provenance==="real"`, dashed `≈` when `"derived"`), SVG overlay draws ICOM arrows on their `side` (input←left, control↑top, output→right, mechanism↓bottom), each **anchored to its own on-page anchor box** (not the focus box — see the ICOM Layout section, EVID-060 E-1); the outline pane renders `outline` rows (windowed by `window`) indented by `depth`, labelled `number`+`kind`, styled by `provenance`; legend + mode indicator render from `diagram.legend`/`verdict`. A **focus change** (Enter/Space on a real child box, or activating an outline row) sets view-local `focus` and re-invokes `deriveIdef0(raw,{threshold,focus,window})` — a fresh one-level materialisation; the breadcrumb reflects the root→focus path.

**Revealing collapsed children (the >6 case) — core-backed, no `window` on the diagram (EVID-061 F2 / EVID-060 C-1):** the diagram caps at ≤6 children + one terminal `"+N more"` rollup mega-box. There is **no** core call that pages the hidden children *into the diagram* (`computeIdef0Diagram` ignores `window`). The honest reveal paths are: (1) **drill** into one of the ≤6 real children (Enter/Space ⇒ that child becomes `focus`, showing *its* ≤6 children), the standard IDEF0 A-page decomposition; or (2) **jump via the windowed outline pane**, which *is* windowed (`flattenOutline` honours `window`) and lists every node — paging/scrolling to a hidden sibling and activating it sets `focus` to it. The rollup box itself is a **terminal count**, not a paging control (see Interaction / Test Hooks).

**Named failure/degraded path (tier-stack fallback — the *live* dogfood path today):** `verdict.mode === "tier-stack"` → the diagram pane lays out the core's **bounded** tier-stack `diagram.boxes` (≤6/tier + rollup per tier, each carrying `number: "T<tier>.<i>"`/`"T<tier>.+"` and `provenance:"derived"`) via `layoutTierBands(diagram, tierStack)`; boxes are **grouped into altitude bands by their `T<n>` number-prefix**, and `tierStack.tiers` is used **only** to label/kind each band — **never** to materialise per-artifact boxes (EVID-061 F1). Every band box is **dashed** (all derived); **no** real ICOM arrow is drawn (tier-stack has none). The **outline pane still renders the real forest rows solid** (the two panes carry different honesty because the core sources them differently — SPEC-005 `V-FALLBACK`/`V-DERIVED-ONLY`); the mode indicator shows a visible "honest fallback" banner sourced from `verdict.reason`; the permanent legend stays. Because both panes now read bounded/ windowed core output, the fallback DOM is bounded at N≥1000. Empty snapshot (`V-EMPTY`): explicit empty state + permanent legend, no throw. The view **never throws** on core output — the core already normalises adversarial poller data (SPEC-004 Errors).

## Function Signatures / Component Contracts (language-agnostic TS idiom)

### `Idef0View.svelte` props (mirrors the sibling views' `$props()` shape)

```
props {
  nodes:        ArtifactSummary[]              // from the dual-poll snapshot (id, kind, status, title)
  edges:        GraphEdge[]                    // { from, to, relation } — ids as endpoints
  scores?:      ScoreEntry[]                   // accepted for parity; not required by the core
  selectedId?:  string | null                 // host selection → resolved to a CompositeKey focus seed (see resolveFocusKey)
  openedIds?:   Set<string> | string[]         // host-forwarded (accepted-and-ignored in T2) — EVID-061 F5
  kindFilter?:  ...                            // host-forwarded (accepted-and-ignored in T2) — EVID-061 F5
  statusFilter?: ...                           // host-forwarded (accepted-and-ignored in T2) — EVID-061 F5
  onSelect?:    (d:{ id:string; event?:Event }) => void   // relayed to host on box/row activation
  onViewState?: (s:{ nodes; transform; viewport }) => void // minimap parity (may emit empty ⇒ minimap gates off)
}
export function resetZoom(): void              // satisfies the host `bind:this={inner}` contract
```
`openedIds`/`kindFilter`/`statusFilter` are forwarded by the registration branch (like every sibling view) and are declared here as **accepted-and-ignored** in T2 so the component contract matches the branch that instantiates it (EVID-061 F5). Svelte 5 `$props()` tolerates extra props at runtime; declaring them keeps the contract honest.

### Host adapter (inline in `Idef0View`, pure)

```
toRawSnapshot(nodes: ArtifactSummary[], edges: GraphEdge[]): RawSnapshot
  = { nodes: nodes.map(n => ({ id:n.id, title:n.title, kind:n.kind })),
      edges: edges.map(e => ({ from:e.from, to:e.to, relation:e.relation })) }
```
`from`/`to` are id strings; the core's `port()` resolves them to composite `(id,title)` keys — the adapter does **not** pre-resolve edges (no fork of identity logic).

### Focus-seed resolver (inline host helper, pure — EVID-061 F3)

```
resolveFocusKey(selectedId: string | null, nodes: ArtifactSummary[]): CompositeKey | null
  // The host holds the full snapshot; the core's `focus` MUST be a CompositeKey {id,title}
  // (it resolves via serialiseKey(focus) = JSON.stringify([id,title]) — BOTH fields needed).
  // A bare selectedId is insufficient on its own, and AMBIGUOUS under id-collision.
  1. matches = nodes.filter(n => n.id === selectedId)
  2. if matches.length === 0 → return null            // no seed; core defaults to top ≤6 roots
  3. if matches.length === 1 → return { id, title } of the sole match
  4. COLLISION (same id, distinct titles — SPEC-005 V-COLLISION, the PROB-060 case):
       return the key whose serialiseKey([id,title]) sorts LOWEST (canonically-first),
       to match the core's own deterministic tie-break. Deterministic, honest, reproducible.
```
This is a small, pure host helper — it performs a node lookup, never re-derives identity/ports (no fork). Under `V-COLLISION` it is deterministic (canonical-first), so focus seeding is honest even when an id maps to multiple titles.

### The core call (EXACT frozen options-object signature — RFC-028 / index.ts)

```
deriveIdef0(raw: RawSnapshot,
            opts: { threshold: number; focus?: CompositeKey | null; window?: { offset:number; limit:number }; takenAt?: string })
  : { input; forest; tierStack; verdict: DensityVerdict; diagram: Idef0Diagram; outline: OutlineRow[]; signature: string }
```
- `threshold` = the density convention constant **0.3** (ADR-007 / PRD-034 context). The view supplies it explicitly (the core injects no default — purity). Not user-configurable in T2.
- `focus` = view-local `ViewFocusState.focus` (a `CompositeKey`, seeded via `resolveFocusKey`; null ⇒ top ≤6 roots).
- `window` = the **outline** windowing range for N≥1000. **The core's diagram functions ignore `window`** (`computeIdef0Diagram`/`computeTierStackDiagram` take `_window?` but never reference it — verified against `diagram.ts`); only `flattenOutline(forest, window)` honours it. So `window` bounds the **outline pane**; the **diagram pane** is bounded independently by the ≤6+rollup cap. Do not expect `window` to page diagram children (EVID-061 F2 / EVID-060 C-1).
- Called **once per (snapshot, focus, window)** tuple; result memoised on that tuple to avoid re-derivation on unrelated re-renders.

### Mode selection (RC-1 — render the returned mode, never upgrade a fallback)

```
if verdict.mode === "idef0":       diagramLayout = layoutIdef0Diagram(diagram)              // ICOM staircase + 4-side arrows
else /* "tier-stack" */:           diagramLayout = layoutTierBands(diagram, tierStack)       // altitude bands off the BOUNDED core diagram, all dashed, no real arrows
// BOTH paths read the SAME bounded core `diagram` for boxes; tierStack is used ONLY for band labels/kind in fallback.
// BOTH paths read diagram.legend for the permanent legend and verdict for the mode indicator.
```
The view **never** recomputes `verdict.mode`, **never** fabricates a dense diagram over a fallback, and **never** materialises boxes off `tierStack.tiers[].members`.

## The ICOM Layout Algorithm (the one genuinely new piece)

`widgets/dependency-graph/lib/idef0-layout.ts` — pure, deterministic, side-effect-free. Because the core outputs are already order-stable (INV-8, sorted boxes/arrows/rows), the same `Idef0Diagram` ⇒ byte-identical `Idef0Layout`; no randomness, no wall-clock, no DOM read. **Both** modes source their boxes from the core's bounded `diagram.boxes`; neither reads raw `tierStack` members.

### Signatures

```
interface BoxGeom { boxW; boxH; gapX; gapY; margin; gutter; cols }         // all number; sensible defaults
interface PlacedBox { key: CompositeKey; number: string; kind: string;
                      provenance: Provenance; rollupCount?: number;
                      role: "focus" | "child" | "band-member" | "rollup";
                      band?: number;      // T<n> tier index parsed from `number` (tier-stack mode)
                      x; y; w; h }                                          // px, top-left origin
interface PlacedArrow { edge: ClassifiedEdge; side: IcomSide; slot: number;
                        anchorKey: CompositeKey;   // the on-page box this arrow attaches to (may be a CHILD, not the focus)
                        x1; y1; x2; y2;      // tail → head, same px space as boxes
                        headAtBox: boolean } // I/C/M point INTO the anchor-box edge; O points OUT to the gutter
interface Idef0Layout { boxes: PlacedBox[]; arrows: PlacedArrow[]; width; height; mode: DiagramMode }

layoutIdef0Diagram(diagram: Idef0Diagram, geom?: Partial<BoxGeom>): Idef0Layout                       // mode === "idef0"
layoutTierBands(diagram: Idef0Diagram, tierStack: TierStackForest, geom?: Partial<BoxGeom>): Idef0Layout  // mode === "tier-stack"
```

`role` is derived **not** from array position but by matching each box's `key` against `diagram.focus` (`role === "focus"` iff `serialiseKey(box.key) === serialiseKey(diagram.focus)`), and by `box.kind`/`number` for `rollup`/`band-member` (EVID-060 M-1). `diagram.focus` is an explicit field on `Idef0Diagram`; relying on it (rather than "focus is `boxes[0]`", which is not a frozen invariant — INV-8 covers only child/arrow sort order) survives a future core box re-sort with no silent mis-roling.

### Geometry approach (idef0 mode)

1. **Boxes.** `diagram.boxes` are already sorted (focus/context first when `focus != null`, then children, then the optional rollup mega-box carrying `rollupCount`). Place the **focus/context box** (identified by `key`-matches-`diagram.focus`, M-1) centred in a top "context strip"; place the **≤6 children** left-to-right into `cols` columns (default 3), wrapping to a second row — a deterministic grid indexed by the core's box order. The rollup box (present when the core signalled >6, `kind === "rollup"`) takes the final slot with a `"+N more"` label from `rollupCount`; it is a **terminal indicator** — see Interaction: it is **not** a drill target (its key is the synthetic `{id:"__rollup__"}`, so focusing it would jump the core to roots — EVID-060 E-2), and it is **not** expanded in place via `window` (EVID-061 F2). `focus === null` renders the ≤6 top roots in the same grid with no context strip.
2. **Arrows (the ICOM sides) — anchored to the arrow's own box, not the focus (EVID-060 E-1).** The core includes an arrow when **either** endpoint is in the level (`inLevel = focus ∪ all child boxes`), so the dense diagram legitimately carries arrows incident to **child** boxes (including sibling↔sibling edges), not only the focus's arrows. Group `diagram.arrows` by `side`. For each side (left=input, top=control, right=output, bottom=mechanism), resolve each arrow's **anchor box** = the on-page box whose `key` matches the ICOM endpoint (`edge.to` for I/C/M which *enter*; `edge.from` for O which *leaves*). If the resolved endpoint is **off-page** (neither focus nor a rendered child — e.g. an ancestor/other-level node), fall back to anchoring at the **focus/context box boundary**. Distribute each side's arrows into evenly-spaced **slots** along the *anchor box's* corresponding edge (slot index = the arrow's stable order within the side). Compute `(x1,y1)→(x2,y2)` in the anchor box's frame: I/C/M run from the outer `gutter` inward with the head **at** the anchor-box edge (`headAtBox=true`); O runs from the anchor box's right edge outward to the gutter (`headAtBox=false`). Because sides/slots are computed **per anchor box**, a child-incident input arrow correctly attaches to that child's left edge — it does **not** assume `x1 < focusBox.x`. `slot` + even spacing guarantees no two same-side arrows on the same box overlap deterministically.
3. **Canvas.** `width`/`height` derived from `cols`, row count, gutters, margins — a pure function of box/arrow counts, so an SVG `viewBox` scales the whole page responsively.

### Geometry approach (tier-stack mode) — bounded, off the core diagram (EVID-061 F1)

`layoutTierBands(diagram, tierStack)` flows the core's **bounded** `diagram.boxes` (≤6/tier + one rollup per tier, all `provenance:"derived"`) into stacked horizontal **bands**. Bands are formed by **grouping boxes on the `T<n>` prefix of `box.number`** (`"T2.3"` → band 2; `"T2.+"` → band 2's rollup), preserving the core's tier-by-tier emission order (altitude-ordered). `tierStack.tiers` is consulted **only** to resolve each band's human label/kind — **never** to enumerate members (that would re-introduce one-box-per-artifact and blow the DOM at N≥1000 on the live path). Every member box is dashed/`≈` (all `derived`); each band shows its own `"+N more"` rollup when the core capped it; **no** ICOM arrow is emitted (tier-stack has no real ICOM arrows). This is the honest, **bounded** fallback reading; the full altitude structure is carried by the **outline pane** (solid, windowed).

*Optional (out of T2 scope, do not depend on it):* a clean T1 follow-up could add a first-class `tier` field to `DiagramBox` so banding reads a number instead of parsing the `T<n>` prefix. Not required — number-prefix banding is sufficient and keeps T2 free of any core change (EVID-061 F1). If pursued, it is a separate T1 core RFC dispatched to `architect`/`adr-architect`, never patched into this T2 view.

### Purity / no-fork guarantees (INV to hold)

- **L-1:** `layout*` reads only `number`, `key`, `kind`, `provenance`, `rollupCount`, `side`, `edge`, `focus` from the core output — it computes **no** classification/numbering/density; every rendered `number`/`side`/`provenance`/band traces to a core field (RC-3, Outcome 5). In fallback mode, band membership is read from `box.number`'s `T<n>` prefix, **not** from `tierStack.tiers[].members`.
- **L-2:** deterministic — same input ⇒ identical output (asserted by a re-run equality test).
- **L-3:** never mutates its inputs; never pushes geometry back into the core (SPEC-004 FR-007).
- **L-4:** `role` (esp. `"focus"`) is resolved by matching `box.key` against `diagram.focus`, never by array index (EVID-060 M-1).

## Two-pane Composition

Composition (rule 24 — compose `shared/ui` primitives; **never** re-skin a primitive's internals via upper-layer `:global()`; if a diagram-box look is missing, add a **variant** to a primitive or a new primitive and showcase it on `/playground`):

- **Outline pane (left).** A **windowed** list of `result.outline` rows (bounded by `window` — the only core-honoured windowing path): indent by `depth`, label `number`+`kind`+title, style by `provenance` (real = solid weight; the outline is the **real forest** so its rows are effectively always solid — the view **never dashes a real row**, SPEC-005 honest-fallback scenario). Windowing keeps materialised rows bounded at N≥1000. Rows are keyboard-focusable; activating a row sets the diagram `focus`. This pane is also the **global jump** to collapsed siblings (the >6 case): page/scroll to any node and activate it.
- **ICOM diagram pane (right).** The `Idef0Layout`: DOM boxes (solid vs dashed `≈` per `provenance`) + a single SVG arrow overlay (dashed strokes for derived). The rollup mega-box shows `"+N more"` and is a **terminal indicator** (no in-place expand, not a drill target — EVID-060 E-2 / EVID-061 F2). Bounded in both modes (≤6+rollup / ≤6-per-band+rollup).
- **Permanent ICOM legend.** Rendered in **every** state (dense, fallback, empty) from `diagram.legend` (roles present + honesty key `{real: solid, derived: dashed ≈}`) — RC-4. Composed from a `shared/ui` primitive (e.g. Badge/Card), not a hand-rolled `.legend` re-skin.
- **Mode indicator.** From `verdict.mode`/`verdict.reason`; the fallback banner names why the core fell back. Never diverges from the core verdict.

## Registration Plan (exact edits)

**1. `shared/config/ui-prefs.ts` — three places (`GRAPH_VIEW_IDS` auto-derives, so two literal edits):**
   - `GraphView` union: add `| "idef0"`.
   - `GRAPH_VIEWS` array: append `{ id:"idef0", label:"IDEF0", hint:"Altitude decomposition + ICOM reading", icon:<Lucide icon> }`. Icon: a new `@lucide/svelte/icons/...` import (candidate `boxes` / `layout-panel-left` / `frame` — final pick a Wave-1 detail, must visually read as "structured decomposition" and not collide with the existing seven).
   - `GRAPH_VIEW_IDS = new Set(GRAPH_VIEWS.map(v => v.id))` — **no manual edit**; it derives the new id automatically (verify the derived Set includes `idef0`).

**Registry has two consumers (EVID-060/061 F4).** `GRAPH_VIEWS`/`GRAPH_VIEW_IDS` are read by (a) the dependency-graph view switcher **and** (b) the mosaic view-tiler — `widgets/mosaic/ui/MosaicCanvas.svelte` (`nextAvailableView()`/`onAddPane()`) and `widgets/mosaic/lib/persist.ts` (`allViewsKnown`). Appending `idef0` therefore **auto-enrols** it into the mosaic pane picker and layout-persistence validation. This is intended (the existing view-tiler is in scope; it is not the T4 composed-map graft PRD-034 fences off), but it MUST be exercised by the no-regression scope (AC-3, extended below).

**2. `widgets/dependency-graph/ui/DependencyGraph.svelte` — one branch:** insert, immediately **after** the `{:else if view === 'sunburst'}` block (ends the `SunburstView` element) and immediately **before** the final `{:else}` that renders `LanesView`:
```
{:else if view === 'idef0'}
  <Idef0View bind:this={inner} {nodes} {edges} {scores} {selectedId} {openedIds}
             {kindFilter} {statusFilter} onSelect={relay} {onViewState} />
```
plus `import Idef0View from './Idef0View.svelte';` at the top with the other view imports. `bind:this={inner}` requires `resetZoom()` on the component (provided); `onViewState` may emit nothing ⇒ the Minimap gates itself off on `nodes.length` — acceptable, no minimap for the idef0 pane in T2.

## Options Considered

Two decision points genuinely have a choice; each is weighed with ≥2 real alternatives. (The macro choice — dedicated view vs extend-existing vs do-nothing — was already decided by **PRD-034 ADI (H1, High)**; this RFC does not re-litigate it. The post-CONCERNS revision corrected *data-flow/layout-source* details within the chosen A2+B3 spine; it did **not** reopen these options — both reviewers confirmed no redesign is warranted.)

### Decision A — ICOM diagram rendering approach

- **A1 — Pure SVG (draw boxes as `<rect>`+`<text>`, arrows as `<path>` in one `<svg>`).**
  - Pros: byte-consistent with the seven existing views (all pure SVG `svg.graph`), one coordinate system, trivial dashed strokes + arrowhead markers for provenance, single-element export/zoom, `viewBox` scaling for free.
  - Cons: a11y is manual (SVG needs `role`/`aria-labelledby`, synthetic focus rings, no native tab order); SVG text has no wrapping (artifact titles clip); cannot compose `shared/ui` primitives for boxes ⇒ dual-theme + focus + typography re-implemented by hand.

- **A2 — Positioned DOM boxes + SVG arrow overlay (hybrid) [CHOSEN].**
  - Pros: boxes are real DOM ⇒ **native focus/tab order + ARIA** (FR-006), native text wrapping/ellipsis, and boxes can **compose `shared/ui` primitives** (Card/Badge) so dual-theme + honesty styling ride the token system (rule 24, FR-008) instead of hand-rolled SVG fills; arrows stay in **one** SVG overlay that reads the **same** `Idef0Layout` px space as the boxes ⇒ no coordinate drift; dashed strokes still trivial.
  - Cons: two render substrates (DOM + SVG) to keep visually aligned (mitigated: both consume one layout object, L-2 determinism); export-as-single-vector is harder than A1; slightly more DOM per box (bounded by ≤6 + rollup, so cheap).

- **A3 — Pure CSS grid/flow, no SVG at all (arrows as CSS borders/pseudo-elements).**
  - Pros: zero SVG; simplest DOM; easiest a11y.
  - Cons: cannot honestly draw **diagonal/multi-slot ICOM arrows** with arrowheads on four sides — CSS borders degrade to L-shapes and can't render the I←C↑O→M↓ grammar faithfully; breaks the reading key ADR-007 mandates. Rejected as under-delivering the ICOM grammar.

### Decision B — focus / drill interaction model

- **B1 — Click-to-drill only (activate a child box ⇒ it becomes focus).**
  - Pros: minimal; matches IDEF0 A-page drill-down; one state field.
  - Cons: no visible drill-*up* path; on a deep spine the user gets lost (which level am I on?); keyboard-only up-navigation is unobvious.

- **B2 — Breadcrumb only (root→focus trail; click a crumb to move focus).**
  - Pros: always-visible location; easy drill-up.
  - Cons: drilling *down* still needs a box affordance ⇒ breadcrumb alone is insufficient.

- **B3 — Both: click/keyboard-to-drill on boxes + a breadcrumb trail for drill-up [CHOSEN].**
  - Pros: down (activate a child) **and** up (breadcrumb / Backspace) both have a keyboard path (FR-006); the breadcrumb is the location indicator on a deep spine; the outline pane doubles as a global jump (incl. reaching collapsed >6 siblings). Standard IDEF0 navigation.
  - Cons: two affordances to build + keep in sync with `focus` (single source of truth: view-local `ViewFocusState.focus` drives both). Rollup and off-page anchors are excluded from drill targets (EVID-060 E-2).

## Proposed Direction

Adopt **A2 (positioned-DOM boxes + one SVG arrow overlay)** and **B3 (click/keyboard drill + breadcrumb)**, both consuming a single deterministic `Idef0Layout` from `idef0-layout.ts`, which in **both** modes lays out from the core's **bounded** `Idef0Diagram` (never raw `tierStack` members). Rationale (grounded in the ADI synthesis below and the Context constraints): A2 is the only rendering approach that satisfies the a11y floor (FR-006 native focus/tab) and dual-theme-via-primitives (rule 24 / FR-008) **without** re-implementing typography/focus/theming by hand, while still drawing faithful four-side ICOM arrows (which A3 cannot); the DOM/SVG "two substrates" cost is neutralised by both reading one layout object (L-2). B3 is the only interaction model giving both drill directions a keyboard path (FR-006) and a location indicator on a deep spine. The whole view stays a **pure consumer** of the frozen core (no derivation/classification/numbering/density in the widget — Outcome 5), and **purely additive** (one entry + one branch — PRD-034 reversibility).

**Post-CONCERNS refinement (EVID-060/061):** the direction is unchanged; the revision (a) binds the tier-stack fallback layout to the core's bounded `diagram` (F1), (b) removes the `window`-pages-diagram-children claim in favour of drill/outline reveal (F2/C-1), (c) adds the `resolveFocusKey` seed resolver with a canonical-first collision tie-break (F3), (d) extends blast-radius/AC-3 to the mosaic view-tiler (F4), and folds the additional system findings (component-test harness budget T-1, corrected regression precedent T-2, anchor-box-relative arrows E-1, rollup/off-page drill exclusion E-2, focus-by-key robustness M-1). None of these reopen A/B; they make the chosen spine implementable against the shipped core.

### ADI (forgeplan_reason RFC-029)

`forgeplan_reason RFC-029` (FPF ADI, gemini-3-flash-preview, 2026-07-01) returned three hypotheses and recommended **A2 (hybrid rendering) + B3 (dual-interaction)** at **High** confidence — matching the provisional lean, so no override was needed. This ADI is preserved verbatim across the CONCERNS revision (the revision refined data-flow within A2+B3; it did not change the option selection, so the gate is not re-run):

- **H1 (High) — Hybrid rendering (DOM boxes + SVG arrow overlay) is optimal for a11y + theming.** DOM gives native focus/tab order (FR-006) more reliably than SVG `<text>`/`<rect>`; shared/ui primitives (rule 24) compose as DOM more easily than SVG fragments; one shared layout object prevents DOM/SVG coordinate drift. Deduction: Svelte Card/Badge boxes + one absolute SVG overlay, dual-theme via CSS tokens; residual risks (higher DOM node count, resize jitter) are bounded by the ≤6+rollup box cap and debounced resize.
- **H2 (High) — a pure, Svelte-decoupled `idef0-layout.ts` enables headless TDD of the ICOM geometry.** The frozen core supplies stable `number`/`side`/`provenance`; Vitest (node env) can validate the SPEC-005 geometry (I/C/M/O → Left/Top/Right/Bottom) on synthetic fixtures with no DOM. This grounds Phase 1 (build + prove the layout engine before the UI).
- **H3 (Medium) — the honest tier-stack fallback manages expectations at density <0.3, but its UX hinges on a prominent fallback banner + clear `verdict.reason`** so users do not read the tier-stack bands as a "broken" view. Two render branches (`layoutIdef0Diagram` vs `layoutTierBands`) widen the visual-test surface — accepted.

ADI-flagged evidence needs, folded into Test Strategy Hooks: (i) a keyboard-only walkthrough asserting logical tab order outline → diagram boxes → breadcrumb (H1); (ii) a Vitest suite asserting I/C/M/O arrows anchor to the Left/Top/Right/Bottom of their **anchor box** (H2, E-1); (iii) a legend-consistency comparison between a real dogfood fallback snapshot and the synthetic DENSE fixture (H3). Overall ADI confidence: High — the RFC is tightly coupled to the frozen SPEC-004/005 and follows established FSD / rule-24 patterns.

## Implementation Phases

- **Phase 1 — Layout core (pure, TDD; node env).** Implement `idef0-layout.ts` (`layoutIdef0Diagram` + `layoutTierBands(diagram, tierStack)` + types) against the committed **synthetic DENSE fixture** and a **tier-stack fixture**; assert L-1/L-2/L-3/L-4 + the ICOM-side geometry relative to each arrow's **anchor box** (input←left, control↑top, output→right, mechanism↓bottom, incl. a child-incident arrow — E-1) + rollup slot (terminal) + tier-stack banding sourced from `diagram.boxes` (`T<n>` prefix), bounded ≤6/band. No Svelte yet; runs in vitest `node` env like the 3 existing `*-layout.ts` precedents. Gate: layout tests green. (ADI H2 — layout engine first.)
- **Phase 2 — Widget + two-pane composition.** Build `Idef0View.svelte`: adapter + `resolveFocusKey` → `deriveIdef0` (memoised on (snapshot,focus,window)) → outline pane (windowed) + diagram pane (A2, bounded both modes) + permanent legend + mode indicator. Compose `shared/ui` primitives; if a diagram-box look is missing, add a primitive variant + `/playground` showcase (rule 24). Gate: renders both modes without error.
- **Phase 3 — Interaction + a11y (B3).** Keyboard drill/focus traversal (rollup + off-page anchors excluded from drill targets, E-2), breadcrumb drill-up, outline global-jump to collapsed siblings, visible focus indicator, reduced-motion suppression (`motionDuration`), dual-theme via `themeStore` tokens. Gate: keyboard-only walkthrough + reduced-motion + both themes.
- **Phase 3/4 prerequisite — component-test harness (NEW work, must be budgeted — EVID-060 T-1/T-2).** The repo has **no** component-render test infrastructure today: vitest `environment: "node"`, `@testing-library/svelte` is **not** a dependency (only `happy-dom` is present, unused by default), and **zero** existing tests render a Svelte component. The DOM-bound conformance hooks (keyboard tab-order RC-8, 7-view + mosaic no-regression RC-6/AC-3, dual-theme legibility RC-7, `matchMedia` reduced-motion RC-8, provenance⇒line-style DOM-class RC-2, switcher/mosaic "no overflow" AC-3) require net-new harness: add `@testing-library/svelte`, use `@vitest-environment happy-dom` per-file pragmas, and honour the macOS fork-limit `pool:'threads'` convention. The cited `regression.test.ts` is **not** a reusable precedent — it is a `detectClusters`/ring-radius unit test for RadialView math, renders no view, and touches no registry (T-2). Either budget this harness as an explicit Phase-3/4 line item, **or** scope AC-3/AC-7 DOM assertions down to the layout boundary (node env) and mark the DOM-only assertions harness-blocked. Do not merge Phase 4 assuming existing infra exists.
- **Phase 4 — Registration.** The three-place `ui-prefs.ts` edit + the `DependencyGraph.svelte` branch. Gate: the no-regression scenario — all seven existing views render unchanged; switcher takes the entry without overflow; **and the mosaic view-tiler still tiles all views with `idef0` rendering correctly in a constrained pane + persistence round-tripping** (F4).
- **Phase 5 — Conformance + EVIDENCE.** Map every SPEC-005 `#### Scenario` to a committed test (AC-4); run the fallback scenario against an authentic dogfood snapshot (AC-1) and the dense scenario against the fixture (AC-2); assert box-count boundedness in **both** modes and outline boundedness via `window` (F1/F2); author the EvidencePack (with `## Structured Fields`) and link it. Gate: R_eff > 0 ⇒ guardian activation.

## Accessibility, Reduced-motion, Dual-theme

- **Keyboard (FR-006 / RC-8):** every navigation + focus change has a keyboard path — arrow keys traverse boxes/outline rows, Enter/Space drills into a **real child** (rollup mega-boxes and off-page anchors are **excluded** from drill/focus targets, EVID-060 E-2, so a keyboard user never lands on the synthetic `{id:"__rollup__"}` key and gets jarringly bounced to roots), Backspace or a focused breadcrumb crumb drills up; collapsed >6 siblings are reached via the windowed outline global-jump. The active element carries a visible focus indicator (native, since A2 boxes are DOM). Tab order outline → diagram boxes → breadcrumb is asserted (ADI H1 evidence).
- **Reduced-motion (FR-007):** focus/mode transitions gate on `motionDuration(defaultMs)` (`widgets/dependency-graph/lib/reduced-motion.ts`, window-guarded) — 0 ms ⇒ instant apply, no non-essential animation.
- **Dual-theme (FR-008 / rule 24):** all box/arrow/row/legend/indicator colour reads from `app/styles/app.css` tokens (`--bg*`, `--fg*`, `--accent`, `--line*`); reactive to `themeStore` (`shared/lib/theme.svelte.ts`) so light/dark switch needs no per-caller theming. Honesty is conveyed by **line-style + label**, never colour alone (dashed `≈` for derived).

## Test Strategy Hooks (for the tester agent)

Hooks, not cases — targets that make the SPEC-005 scenarios provable **without T3 live dense data**. Note the substrate split: the pure-layout hooks run in vitest **node** env (matching the 3 existing `*-layout.ts` precedents); the DOM hooks require the **new component-test harness** (Phase-3/4 prerequisite above — EVID-060 T-1). A hook that needs the harness is tagged `[DOM-harness]`.

- **Synthetic DENSE fixture (`idef0-layout.test.ts`, node):** a hand-authored `RawSnapshot` with density ≥ 0.3, depth ≥ 3, a focus node with **>6** children (exercises rollup), and at least one non-tree edge of **each** ICOM class (`based_on`→input/left, `supersedes`→control/top, an output→right, `informs`→mechanism/bottom) plus a `refines` spine, **including one child↔child edge** (E-1). Assert `deriveIdef0(fixture,{threshold:0.3,focus}).verdict.mode === "idef0"`, then assert on `layoutIdef0Diagram(diagram)`: each arrow's side/geometry is checked **relative to its own `anchorKey` box** (not the focus box) — input arrows have `side==="left"` and `x1 < anchorBox.x`; control `side==="top"`, `y1 < anchorBox.y`; output `side==="right"`, `x2 > anchorBox.x+anchorBox.w`; mechanism `side==="bottom"`, `y1 > anchorBox.y+anchorBox.h`; the child↔child input arrow anchors to the **child** box, not the focus (E-1); ≤6 child boxes + exactly one rollup box (`role==="rollup"`, `rollupCount>0`).
- **I/C/M/O anchor test (ADI H2 / E-1 evidence, node):** for a synthetic focus node with one edge of each class to distinct on-page boxes, assert each arrow anchors to the Left/Top/Right/Bottom edge of **its anchor box** respectively; add an off-page-endpoint edge and assert the anchor falls back to the focus/context boundary.
- **Tier-stack bounded + banded off the core diagram (F1, node):** feed a fixture routing to `tier-stack` with a tier holding **>6** members; assert `layoutTierBands(diagram, tierStack)` emits ≤6 boxes + one rollup **per band** (bounded), bands are grouped by the `T<n>` prefix of `box.number`, and **no** `PlacedBox` is materialised from `tierStack.tiers[].members` (box count == core `diagram.boxes.length`, not artifact count).
- **Provenance ⇒ line-style (RC-2/FR-010):** node-level assert on the layout object that `provenance==="real"` boxes/arrows carry the solid flag and `"derived"` the dashed-`≈` flag; on an all-derived tier-stack diagram, 0 solid diagram elements. `[DOM-harness]` companion: the DOM class actually rendered matches.
- **Render-the-returned-mode (RC-1, node):** feed a fixture routing to `tier-stack` and assert no ICOM staircase is drawn (bands only, no real arrows) and the fallback indicator shows `verdict.reason`.
- **Rollup is terminal, not window-expand (F2/C-1, node):** assert that re-invoking `deriveIdef0` with any `window` returns the **byte-identical** diagram (the rollup does not page children); assert the rollup box is flagged non-drillable; assert the reveal path is drill-into-child or outline-jump (covered by the interaction hook).
- **Focus-seed resolver + V-COLLISION (F3, node):** `resolveFocusKey(selectedId, nodes)` returns `{id,title}` for a unique id; for a colliding id (two nodes, same id, distinct titles — the PROB-060 case) returns the **canonically-first** key (lowest `serialiseKey`); returns `null` for an unknown id (core defaults to roots).
- **Legend consistency (ADI H3 evidence):** `[DOM-harness]` compare a real dogfood fallback snapshot and the synthetic DENSE fixture; assert the permanent legend renders identically (roles + honesty key) in both modes and the empty state.
- **Reuse-not-fork (RC-3/Outcome 5, node):** static/import assertion that the widget imports the core symbols and re-implements no derivation/classification/numbering/density; every DOM `number`/`side`/`provenance`/band traces to a core field; in fallback mode band membership derives from `box.number`, not `tierStack` members.
- **No-regression (RC-6/AC-3) — NEW harness, do not present as reuse (T-2):** `[DOM-harness]` snapshot each of the seven existing views before/after registration; assert the switcher registry length + render output unchanged and no CSS overflow. This needs the net-new component harness (T-1); it is **not** a copy of `regression.test.ts` (which is a RadialView math unit test).
- **Mosaic no-regression (F4):** `[DOM-harness]` assert the mosaic view-tiler still enumerates + tiles **all** views (now including `idef0`); `idef0` renders correctly in a **constrained pane viewport** (A3 two-pane degrades gracefully in a small pane, no overflow); `persist.allViewsKnown` accepts a persisted layout containing an `idef0` pane and round-trips it. This is the existing view-tiler (in scope), not the T4 composed-map graft.
- **a11y + reduced-motion (RC-8):** `[DOM-harness]` keyboard-only walkthrough test (tab order outline → boxes → breadcrumb; rollup + off-page anchors NOT drill targets, E-2) + `matchMedia('(prefers-reduced-motion: reduce)')` mock ⇒ 0 transitions; both-theme legibility.
- **Bounded DOM at N≥1000 (NFR-001/AC-6, F1/F2):** render the view over an N≥1000 fixture in **both** modes with a `window`; assert materialised diagram box-count is bounded by the **≤6+rollup cap** (dense) / **≤6-per-band+rollup cap** (tier-stack) **independent of N and of `window`**, and outline row-count is bounded by **`window`**; interaction-latency budget = **TBD** (RFC-028 Q4 / T1 NFR-002 — record in an EVIDENCE artifact, do **not** invent a number here).

Every `#### Scenario` in SPEC-005 maps to exactly one committed test (AC-4).

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fallback diagram laid out from raw `tierStack.tiers[].members` ⇒ one box/artifact ⇒ unbounded DOM on the LIVE path (density ≈0.095) at N≥1000 (EVID-061 F1) | was high, now closed | high | `layoutTierBands(diagram, tierStack)` lays out from the core's **bounded** `diagram.boxes` (≤6/band + rollup); `tierStack.tiers` used ONLY for band labels; box-count-bounded test in tier-stack mode |
| Rollup "+N more" assumed to page hidden children by re-invoking the core with `window` — but the core diagram fns ignore `window` (EVID-061 F2 / EVID-060 C-1) | was med, now closed | high | Rollup is a terminal count; reveal via drill-into-real-child or the windowed outline global-jump; test asserts `window` does not change the diagram |
| Focus seed ambiguous under id-collision (bare `selectedId`, same id → multiple titles — SPEC-005 V-COLLISION / PROB-060) (EVID-061 F3) | med | med | `resolveFocusKey` picks the canonically-first key (lowest `serialiseKey`) to match core determinism; V-COLLISION test |
| Adding a 9th view auto-enrols `idef0` into the **mosaic** view-tiler (pane picker + persistence), untested by a 7-view-only AC-3 (EVID-060/061 F4) | med | med | AC-3 extended to the mosaic surface (tiles all views; idef0 renders in a constrained pane; persistence round-trips); clarified in-scope (existing tiler, not T4 graft) |
| No component-render test harness exists (vitest node env, no `@testing-library/svelte`, zero component tests) ⇒ ~6 DOM conformance hooks unbudgeted (EVID-060 T-1/T-2) | med | med | Phase-3/4 prerequisite budgets the harness (dep + `@vitest-environment happy-dom` + `pool:'threads'`); DOM hooks tagged `[DOM-harness]`; layout hooks stay node-env; regression precedent corrected |
| ICOM arrow side asserted relative to the focus box, but the core emits child-incident arrows (`inLevel` = focus ∪ children) (EVID-060 E-1) | med | med | Arrows anchored to each arrow's own `anchorKey` box (child or focus, off-page ⇒ focus boundary); tests assert side geometry relative to the anchor box, incl. a child↔child edge |
| Keyboard user drills into the synthetic rollup/off-page key ⇒ jarring jump to roots (EVID-060 E-2) | low | med | B3 excludes `role==="rollup"` + off-page anchors from drill/focus targets; asserted in the keyboard hook |
| `PlacedBox.role` inferred from array index-0 ⇒ silent mis-role if the core re-sorts boxes (EVID-060 M-1) | low | low-med | `role` derived by matching `box.key` against the explicit `diagram.focus` field (L-4), not position |
| Registering a 9th view perturbs the shared switcher (overflow / shared-state) — blast-radius on all views | med | high | AC-3 no-regression + switcher-capacity check; purely additive (one entry + one branch), reverted by removing them; `GRAPH_VIEW_IDS` auto-derives so no stale Set |
| The widget re-derives ICOM/numbering instead of consuming the core (forks the algorithm) | med | high | L-1 + RC-3 import-not-reimplement assertion; the core's diagram carries `number`+`side`+`provenance` (INV-10) so there is no reason to recompute; fallback bands read `box.number`, not `tierStack` members |
| A "honesty polish" renders a tier-stack fallback as a dense ICOM diagram | low | high | RC-1: switch on `verdict.mode`, never upgrade; all-derived ⇒ all-dashed assertion; outline stays real/solid |
| A contributor re-skins a `shared/ui` primitive from the view to get a box/legend look | med | med | rule 24: compose; add a primitive variant + `/playground` showcase when a look is missing; reviewer greps upper-layer `:global()` for primitive class names |
| Dense mode is unreachable on real data today (density ≈0.095) ⇒ a reviewer over-claims dense capability | med | med | Honest default is the tier-stack fallback (AC-1 on real data); dense path is **fixture**-validated (AC-2), gated on T3 spine authoring for real data |
| DOM/SVG coordinate drift between boxes and arrows (A2) | low | med | Both substrates consume one `Idef0Layout` (L-2 determinism); a layout-equality test pins it |
| Tier-stack fallback read as "broken" if the banner is subtle (ADI H3) | med | med | Prominent fallback banner sourced from `verdict.reason` + permanent legend in every state; legend-consistency test |
| `contradicts`→Control arrows visually fight the altitude ladder (ADR-007 named residual) | low | med | `contradicts` is non-structural (never a tree edge); the overlay routes Control arrows so a contradicts-loop reads as a caveat — a committed layout test asserts it |

**Blast radius:** the shared surfaces touched are `shared/config/ui-prefs.ts` (the `GraphView` union + `GRAPH_VIEWS` array — consumed by **both** the dependency-graph switcher **and** the mosaic view-tiler) and one branch in `DependencyGraph.svelte`. Both are additive; the seven existing views and the frozen core are byte-untouched. Registering `idef0` auto-enrols it into the mosaic pane picker + layout persistence (the existing view-tiler, in scope; not the T4 composed-map graft). The no-regression scenario (AC-3, extended to the mosaic surface) is the gate that this additivity held.

## Migration / Rollback

Purely additive — **no migration**. Rollback = remove the `GRAPH_VIEWS` entry + `GraphView` union member + the one `DependencyGraph.svelte` branch + the two new files; the surface returns to the exact seven-view state with no `/api/*` change, no data migration, and no core change (the core ships regardless). Removing the `GRAPH_VIEWS` entry also **de-enrols** `idef0` from the mosaic pane picker + persistence validation automatically (both derive from the registry), so the revert covers the mosaic surface with no extra edit; any persisted mosaic layout referencing `idef0` is dropped by `allViewsKnown` on load (graceful). One-change, low-cost revert. If a Q2 letter or the box look proves wrong, it is a layout/style edit only (the core's role/number/provenance data is authoritative and unchanged).

## Related Artifacts

- **PRD-034** — driving PRD (standalone idef0 view); this RFC is `based_on` it (implements FR-001…FR-011, AC-1…AC-7).
- **RFC-028** — the shipped headless T1 core (`deriveIdef0`, non-null diagram in both modes); this RFC is `based_on` it (its first consumer).
- **SPEC-005** — the render conformance contract (RC-1…RC-8, twelve scenarios); this RFC realises it; the tester maps each scenario to a test.
- **SPEC-004** — the frozen core contract (INV-2/5/7/10, headless FR-007) the view relies on.
- **ADR-007** — the ICOM reading key rendered here (I=left/C=top/O=right/M=bottom, real=solid/derived=dashed); `informs`=Mechanism.
- **ADR-006** — tier-vocabulary lift (the altitude the outline reads).
- **EPIC-001** — parent (T2 track, GATE-A, Outcomes 4/5/6).
- **EVID-060** — system-dev staff audit (CONCERNS); `informs` this RFC; this revision closes C-1 (rollup/window), T-1/T-2 (component-test harness + corrected regression precedent), E-1 (anchor-box arrows), E-2 (rollup drill exclusion), M-1 (focus-by-key).
- **EVID-061** — architecture review (CONCERNS); `informs` this RFC; this revision closes F1 (bounded tier-stack layout), F2 (rollup/window), F3 (focus-key resolver), F4 (mosaic blast-radius), F5 (props housekeeping).
- **EVIDENCE (planned)** — SPEC-005 scenarios green + N≥1000 bounded-DOM (both modes) + budget measurement; `informs` this RFC; required before activation.

## References

- Core barrel: `template/src/shared/lib/idef0/index.ts` (`deriveIdef0`, `DeriveOptions`, `DeriveResult`), `types.ts` (`Idef0Diagram`, `DiagramBox`, `DiagramArrow`, `IcomLegend`, `OutlineRow`, `Window`, `CompositeKey`, `TierStackForest`), `diagram.ts` (`computeIdef0Diagram`, `computeTierStackDiagram`, `capChildren` — `_window` unused in both), `outline.ts` (`flattenOutline` — the only `window`-honouring path), `keys.ts` (`serialiseKey`).
- Integration surfaces: `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte`, `template/src/shared/config/ui-prefs.ts`, sibling views `ui/*.svelte`.
- Second registry consumer (blast radius): `template/src/widgets/mosaic/ui/MosaicCanvas.svelte`, `template/src/widgets/mosaic/lib/persist.ts`.
- Theming / motion: `template/src/shared/lib/theme.svelte.ts`, `template/src/app/styles/app.css`, `template/src/widgets/dependency-graph/lib/reduced-motion.ts`.
- Test infra: `template/vitest.config.ts` (`environment: "node"`), `template/package.json` (`happy-dom` present; `@testing-library/svelte` absent — harness is new work), layout-lib precedents `template/src/widgets/dependency-graph/lib/{tree,sankey,sunburst}-layout.ts`.
- Entity shapes: `template/src/entities/artifact/model/types.ts` (`ArtifactSummary`), `template/src/entities/graph/model/types.ts` (`GraphEdge`).
- Project rules: rule 22 (read-only proxy), rule 24 (shared/ui ownership), rule 11 (Forgeplan required + EvidencePack structured fields).














