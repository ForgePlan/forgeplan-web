# map-pack enhancement brief — from "artifact dump" to "understanding map"

> **Audience:** the maintainer of `forgeplan-map-pack` (marketplace repo
> `~/Work/ForgePlanMarketplace`, plugin `plugins/forgeplan-map-pack/`).
> **Origin:** user feedback on the composed-map (9th view) in `forgeplan-web`
> after the drill-down (RFC-031) shipped. **Portable:** self-contained — copy
> into the marketplace repo. **Do not implement in forgeplan-web** — this is a
> content/generation brief for the emitter; the web app only renders what
> map-pack emits.
> **Date:** 2026-07-05.

---

## 0. TL;DR

The composed-map renders correctly, but the **content map-pack emits falls short
of the design vision**: it reads as a _dump of forgeplan artifacts binned into
generic zones_, not as the **architecture-onboarding "understanding map"** that
`MASTER-SPEC.md` §1/§15/§17/§22/§23 specifies. The gold-standard reference is
`dev/forgeplan-project-map/forgeplan-project-map/generated/understanding-map-ru.html`.

Four enhancements, in priority order:

1. **E1 — architecture-quality content** (zones = architectural regions; nodes =
   code MODULES with rich RU descriptions; not an artifact dump). _Biggest lever._
2. **E2 — richer flows** (6+ named journeys with numbered RU steps, not 2).
3. **E3 — per-zone generated layers** (L4): a recursive pass that generates each
   zone's own sub-map with its own zones/nodes/flows.
4. **E4 — `/map-build-layer "<zone>"`** — scoped, post-facto generation of one
   zone's layer on demand.

E1+E2 are the "make it feel like the reference" work. E3+E4 are the "drill-down
has real generated depth" work (they complement `forgeplan-web`'s already-shipped
client-derived drill-down, which currently just un-hides raw artifacts).

---

## 1. The quality bar — what the reference does that the current output doesn't

Reference: `generated/understanding-map-ru.html` (hand-crafted map of ForgePlan
core). Study its `DETAIL` dict, `FLOWS` dict, and zone/node structure. It is the
target _quality_, generated automatically.

| Dimension         | Reference (target)                                                                                                                                                                                | Current v0.6.0 output on ForgePlanWeb                                                     | Gap                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Zones**         | Architectural regions with a meaning-subtitle: "Поверхности — две входные двери, одно ядро", "Ядро · Интеллект — ответы о графе", "Хранилище · ADR-003", "Внешнее · делегировано", "След решений" | Generic bins: "routes / API surface", "Widgets & UI", "Decision Trail"                    | thin labels, no `sub`, no `description_ru`       |
| **Nodes**         | Code MODULES with title + meta + rich body: `projection — write gate` / `core · ADR-003` / "Единственный путь мутации…"                                                                           | Mostly collapsed megas + a few bare code paths ("template/src/widgets")                   | no module identity, no RU description, collapsed |
| **Flows**         | 6 named journeys (Shape/Prove/Reason/Search/Brownfield/Drift), each `{name, edges[], nodes[], steps[]}` with numbered RU prose                                                                    | 2 flows (Request path, Decision trail)                                                    | too few; onboarding needs the full set           |
| **Descriptions**  | Every node/zone has a RU `description` (EN label, RU body — §15 language rule)                                                                                                                    | Sparse / absent                                                                           | the onboarding narrative is missing              |
| **Mega-collapse** | Used sparingly for C4 rollup; expands to real modules                                                                                                                                             | `z.decisions` collapses **170 artifacts into one opaque card** — the "dump" the user sees | over-aggressive; hides the story                 |

**The core reframe (user's words):** _"смысл не в том, чтобы тупо показывать
артефакты в зонах — смысл показать архитектуру проекта, её модули и как всё
работает, чтобы любой человек мог пройтись по зонам и понять."_ The map is an
**onboarding artifact for a newcomer**, grounded in real code + docs, not a graph
of PRD/RFC/ADR.

---

## 2. E1 — architecture-quality content (the biggest lever)

**Goal:** the emitter produces zones + module nodes + descriptions at the
reference's quality bar, for ForgePlanWeb (a SvelteKit FSD app) as it does for
ForgePlan core.

**What "architecture zones" means for a SvelteKit/FSD project** (analog of the
reference's Surfaces/Core/Storage/External):

- **Surfaces** — the entry doors: the `bin/forgeplan-web.mjs` CLI (init/start),
  the SvelteKit `routes/api/*` read-only proxy, the browser UI shell.
- **Core / render** — the FSD layers as modules: `entities/map` (schema + pure
  `computeComposedLayout`), `widgets/composed-map`, `widgets/dependency-graph`
  (the 8 views), the poller layer, `shared/ui` catalogue.
- **Data / server** — `shared/server/*` (forgeplan spawn, map read, registry),
  the git-reconstruction endpoints.
- **External / delegated** — the host `forgeplan` CLI, the npm registry
  update-check, the instance registry.
- **Decision trail** — the `.forgeplan/` artifact graph (ONE zone, as in the
  reference — not the whole map).

**Requirements:**

- Each **zone** carries `label` (EN), `sub` (EN, one-line meaning), and
  `description_ru` (RU, 1–3 sentences: what this region is, what's inside, how it
  relates to neighbours). §15 language rule: **label/sub EN, description RU**.
- Each **node** is a real code module with `label` (EN, e.g. `computeComposedLayout
— pure layout`), `meta` (EN, e.g. `entities/map · SPEC-006`), and
  `description_ru` (RU body like the reference `DETAIL` entries). Sourced from
  **real docs/code** (docs-scanner), never fabricated from the file name (§15,
  §23 narration rule — no source ⇒ no description, never faked).
- **Mega-collapse tuning:** the `>8 nodes → collapsed mega` rule (SPEC §23) is too
  aggressive for a 170-artifact zone — it produces the opaque dump. Options:
  (a) raise the threshold / make it per-zone `capacity`; (b) for the decision-trail
  zone, collapse **by artifact-kind** into a handful of kind-group megas (PRD/RFC/
  ADR/EVID/…) instead of one 170-node mega; (c) rely on E3 (generated layers) so
  the top level shows kind-summary nodes and the _layer_ shows the artifacts.
  Recommend (b)+(c): top level = a compact architecture picture; the raw 170 live
  one level down.

**Acceptance:** on ForgePlanWeb, `/map-build` emits a map whose top level reads
like the reference — ≤~20 visible nodes, every zone has a `sub` + `description_ru`,
every non-mega node has a `description_ru`, and no single mega hides >~30 nodes.

---

## 3. E2 — richer flows (named journeys)

**Goal:** 6+ flows so the onboarding "walk" has real routes, matching the
reference's Shape/Prove/Reason/Search/Brownfield/Drift.

**Schema (already in `forgeplan.map/v1`, §22):**
`flows[] = { id, name, node_ids[], edge_ids[], steps[] }`. `steps` are numbered RU
prose with `<code>` tokens (§15 RU rule). `forgeplan-web`'s FlowChips already
renders `flows[]` verbatim (All chip + one per flow) — **no web change needed**;
the gap is purely that the emitter emits too few.

**Candidate flows for ForgePlanWeb** (each a real path through the architecture):

- **Init** — `npx @forgeplan/web init` → copy dist → write `forgeplan-web.json` →
  `.gitignore` append.
- **Render** — poller `/api/map` → `validateMapDocument` → `computeComposedLayout`
  → SVG (the map's own pipeline).
- **Proxy** — browser → `/api/list` → spawn read-only `forgeplan … --json` →
  stream (rule 22).
- **Time-travel** — `/api/timeline-events` + `/api/snapshot` (git worktree
  reconstruction).
- **Drill-down** — descend a zone/mega → sub-map → open artifact → climb (the
  RFC-031 feature).
- **Update** — `/api/update-check` npm registry → footer affordance.

Each flow's `node_ids`/`edge_ids` must reference real emitted nodes/edges (so the
web can light the path). The **edge set is what makes zone→zone arrows appear** —
if the top level is all collapsed megas with no inter-node edges, a flow has
nothing to light (the user's "стрелки не построить" symptom). E1 (real module
nodes + edges) is a prerequisite for E2 to be visible.

**Acceptance:** ≥6 flows; clicking each chip in `forgeplan-web` dims the rest and
lights a real multi-node path with numbered steps.

---

## 4. E3 — per-zone generated layers (recursive depth)

**Goal (user's words):** _"когда запускаем /map-build — сперва обычный проход,
потом в каждую зону отдельно и тоже генерить там свой уровень, чтобы там тоже были
свои чипы (Shape/Prove/…) и своя раскладка."_ Each zone should have its own
**generated** sub-map, not just the client-derived un-hiding of raw children.

**Relationship to what's already shipped:** `forgeplan-web` already ships a
**client-derived** drill-down (RFC-031): descending a zone/mega re-lays-out its
existing children with the same pure engine. That is the _fallback / baseline_ —
it works with today's flat map. E3 is the **richer, emitter-generated** layer:
map-pack runs a scoped pass per zone and emits a real sub-document (its own
`zones`/`nodes`/`edges`/`flows`/`description_ru`) so the descended level is itself
an architecture map, not just raw artifacts.

**Schema hook (already reserved, §4 L4):** `layers[] = {id, zone, label, order}`
plus per-layer sub-content. Extend the contract so a zone can carry (or reference)
a **generated sub-map**: either inline (`layers` with their own nodes/edges/flows)
or a sibling file (`.forgeplan/map/layers/<zone>.json`) the web fetches on descend.
Decide with the web maintainer which shape the renderer consumes; the web's
`deriveSubDocument` seam (RFC-031) can be pointed at an emitted layer instead of
the client-derived one when a generated layer exists (prefer generated, fall back
to derived).

**Pipeline shape:** after the top-level `SCAN→…→EMIT→VALIDATE` pass, the
orchestrator loops over zones and runs a **scoped scan+extract+emit** per zone
(reusing the same agents with a `--scope <zone>` filter), each producing a
validated sub-map. Deterministic (content-hash IDs, no x/y) recursively.

**Acceptance:** after `/map-build`, descending a zone in `forgeplan-web` shows an
emitter-generated sub-map with its **own** flow chips + `description_ru`, distinct
from (richer than) the client-derived un-hide.

---

## 5. E4 — `/map-build-layer "<zone>"` (scoped, on-demand)

**Goal (user's words):** _"это нужно уметь делать постфактум — доп команда прям
там показывается, чтобы выполнить в консоли что-то типа `/map-build-layer "<zone>"`,
и при выполнении появился бы этот слой; и так вглубь."_

**Design (aligns with MASTER-SPEC §23 P5 "append loop"):**

- A **scoped** invocation of the pipeline: `/map-build-layer "<zone-id>"` runs
  SCAN→EXTRACT→EMIT→VALIDATE **restricted to that zone's subtree**, appending/
  writing that zone's layer (E3 shape) without regenerating the whole map.
- **Append-only + EMITTER-safe:** same denylist + `map-emitter-gate.sh` +
  guardian single-write controls (§23); writes only the layer file (or the layer
  section of `map.json`), never mutates forgeplan artifacts.
- **Surface the command in the UI:** `forgeplan-web` can show, on a zone with no
  generated layer yet, an affordance like _"этот слой ещё не построен — выполни
  `/map-build-layer \"<zone>\"`"_ (a copy-command hint, exactly like the current
  empty-state that suggests `/map-build`). The web already has the pattern
  (actionable empty-state). Emitting the layer + poller refresh → the layer
  appears. **Deeper recursion:** `/map-build-layer "<zone>/<subzone>"` for the next
  level.
- MVP can be the manual command (user runs it); the local `forgeplan map serve`
  daemon (§23 P5) that runs it on an in-UI click is the later automation.

---

## 5b. E5 — auto-cascade layer generation (user decision 2026-07-05)

**Goal (user's words):** _"слои должны сразу просчитываться как только просчитается
основной — или параллельно, как только становится достаточно данных; и так на
каждом уровне."_ Every level self-contained (own zones/flows/descriptions/edges),
recursively.

**Recursion contract (already holds):** every layer file is a full
`forgeplan.map/v1` document (same schema, same guardian) at
`.forgeplan/map/layers/<zone>.json`, nested levels at
`layers/<ancestor>/<zone>.json`. The web seam is recursive by construction: at ANY
altitude, descend prefers the emitted layer for the breadcrumb path, falls back to
client-derived un-hide.

**Orchestration decision — parallel fan-out AFTER top-map confirm** (weighed
3 options):

- ~~Sequential cascade~~ — safe but wall-clock = sum of all zones.
- **CHOSEN: after the guardian confirms the top map (exit 0), dispatch one scoped
  layer build PER ZONE in parallel.** Safe because: confirmed top map = stable
  validated seeds; layer files are disjoint write targets (one emitter instance per
  file — the PROB-060 single-writer discipline holds per-file); each layer gets its
  own scratch dir (`.work/layers/<zone>/`) and its own guardian pass.
- ~~Streaming/eager (start when EXTRACT stabilizes)~~ — REJECTED: the top map still
  mutates in gate loops (observed: a GC-6 re-loop rewrote provenance on 59 nodes,
  which would have invalidated in-flight seeds), and it only saves the short
  confirm tail.

**Cost controls (all three required):**

1. **Idempotent skip via seed-fingerprint:** the layer's `meta` records a hash of
   the parent zone's member set. On a `/map-build` re-run, an unchanged zone's
   layer is NOT rebuilt (cheap thanks to content-hash node ids).
2. **Thin-zone threshold:** zones with < N members are skipped by auto-generation
   (a shallow zone does not warrant a layer; the manual command still works).
3. **Depth policy:** auto-cascade covers the FIRST level only (`/map-build
--layers` or default-on). Deeper levels are on demand
   (`/map-build-layer "<zone>/<subzone>"`) or an explicit `--layers-depth N` —
   full recursion is combinatorially expensive and IDEF-style selective depth is
   the intended reading mode.

**Staleness surface:** the seed-fingerprint doubles as the web's freshness check —
a mismatch (top map regenerated, zone membership changed) lets forgeplan-web show
the "layer is stale — run `/map-build-layer \"<zone>\"`" hint via the existing
empty-state pattern.

**Acceptance:** running `/map-build-layer "<zone>"` on a target repo emits that
zone's layer; `forgeplan-web` descends into it after a poller refresh.

---

## 6. Split of responsibility (so nothing is built in the wrong repo)

| Concern                                                  | Repo                                                                                                    | Note                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Architecture zones/modules/descriptions (E1)             | **map-pack**                                                                                            | emitter content quality                                 |
| Richer flows[] + steps (E2)                              | **map-pack**                                                                                            | web renders verbatim                                    |
| Per-zone generated layers (E3)                           | **map-pack** (generate) + **forgeplan-web** (render the emitted layer via the `deriveSubDocument` seam) | contract decision needed                                |
| `/map-build-layer` command (E4)                          | **map-pack** (pipeline) + optional **forgeplan-web** (copy-command hint + poller refresh)               | §23 P5                                                  |
| Zone-hover detail panel; flow-highlight animation polish | **forgeplan-web**                                                                                       | _already in progress in forgeplan-web (separate tasks)_ |

**forgeplan-web is doing its part in parallel** (zone-hover detail card + flow
animation polish to the reference bar). Those render whatever map-pack emits, and
degrade gracefully when `description_ru`/flows are thin — so improving map-pack's
output lights them up with no further web change.

---

## 7. References

- `dev/forgeplan-project-map/forgeplan-project-map/generated/understanding-map-ru.html`
  — the quality bar (study `DETAIL` + `FLOWS`).
- `dev/forgeplan-project-map/forgeplan-project-map/spike/index.html` — animated
  arrows + interaction ground-truth.
- `dev/forgeplan-project-map/forgeplan-project-map/MASTER-SPEC.md` — §1 vision,
  §4 schema (L4 layers), §15 interaction+content+language rule, §16 neutral zones,
  §22 flow schema + kind vocabulary, §23 orchestrated process + onboarding + P5
  append loop.
- `docs/MAP-PACK-v0.2.0-FINDINGS.md`, `docs/MAP-PACK-OUTPUT-FINDINGS.md` (this repo)
  — prior pipeline + output findings (O-1/O-2/O-3, mega-node gap).
- forgeplan-web contract: `template/src/entities/map/model/types.ts`
  (`forgeplan.map/v1`), `template/src/entities/map/lib/validate.ts`,
  `.claude/rules/22-readonly-proxy.md` (`/api/map` read-only mirror).

---

## 8. Cascade dogfood findings — recurring emitter bugs (v0.7.1, 2026-07-06)

Ran the full E5 fan-out on ForgePlanWeb (top map + 4 scoped layers `z.core`,
`z.ui`, `z.surfaces`, `z.decisions`). **Two emitter/extractor defects recur on
EVERY run** (top map + every layer hit both) — root-caused, with the fix known.
These are the highest-priority map-pack fixes; without them each layer needs a
guardian remediation loop (and if VALIDATE is interrupted, the layer ships
schema-invalid).

### F-ARR — scoped emitter writes an out-of-enum `composition.arrangement`

- **Symptom:** the emitter writes `arrangement: "grid"` / `"grid-2x2"` for a
  multi-column layout. The frozen `forgeplan.map/v1` schema pins
  `arrangement: "stack-ttb"` (the ONLY legal value); the real column count lives
  in `canvas.grid.cols`, NOT in `arrangement`. `map-guardian` GC-1 blocks it
  (`composition.arrangement must be 'stack-ttb', got "grid"`), forcing an EMIT
  round-2 remediation on every run.
- **Impact:** if the guardian loop is interrupted mid-remediation, the layer file
  ships with `arrangement:"grid-2x2"` and `status:"proposed"` →
  **forgeplan-web's `validateMapDocument` rejects it** (MapComposition.arrangement
  is the literal `"stack-ttb"`) → the E3 seam falls back to client-derived and the
  generated layer never renders. Observed on `z.surfaces.json`.
- **Fix:** the emitter must ALWAYS write `arrangement: "stack-ttb"`; encode the
  grid width via `canvas.grid.cols` (the confirmed top map already does exactly
  this). Never emit `grid`/`grid-2x2` in the `arrangement` field.

### F-REF — extractor stores kind-prefixed `provenance.ref`, breaking GC-6

- **Symptom:** the `zone-extractor` stores code-node `provenance.ref` as
  `"<kind>:<path>"` (e.g. `"entrypoint:bin/forgeplan-web.mjs"`), but `map-guardian`
  GC-6 re-derives the node id as `sha1(kind + ":" + provenance.ref)` and expects
  `provenance.ref` to be **path-only**. The double-prefix makes the re-derived id
  differ → GC-6 content-hash BLOCKER, forcing an EXTRACT/EMIT remediation.
- **Impact:** the top map hit this on 59 code nodes (a full re-loop); every scoped
  layer hits it again. Artifact nodes (bare-slug refs) already pass — only
  code-derived nodes are affected.
- **Fix:** the extractor must store `provenance.ref` = **path-only** (or slug-only
  for artifacts) — the bare preimage, WITHOUT the kind prefix; the guardian adds
  the `kind + ":"` itself when re-deriving. Align the extractor's ref convention
  with GC-6's id formula once, and both the top pass and every layer stop needing
  the remediation loop.

**Net:** both are single-field conventions in EMIT/EXTRACT. Fixing them removes a
guardian re-loop from every map-pack run and prevents interrupted layers from
shipping schema-invalid. (Everything else in the v0.7.1 cascade worked: kind-group
megas, 7+ flows, per-zone RU descriptions, per-zone sub-maps with their own
flows/zones — the E1-E5 wave is otherwise sound.)
