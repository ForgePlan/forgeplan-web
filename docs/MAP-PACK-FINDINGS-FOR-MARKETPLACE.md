# forgeplan-map-pack v0.7.1 — Consolidated Dogfood Findings Brief (SOURCE-side)

## Purpose

This brief consolidates **five independent audits** of the forgeplan-map-pack **v0.7.1** dogfood output — the real `.forgeplan/map/map.json` (244 nodes / 230 edges / 7 flows / 4 zones) plus the four emitted layers (`z.core`, `z.ui`, `z.surfaces`, `z.decisions`) generated against the ForgePlanWeb repo — into **one marketplace-facing worklist**. It is the artifact to carry into the **forgeplan-map-pack (marketplace) session** so that `/map-build`, `/map-build-layer`, and the 8 pipeline agents (`code-scanner`, `forgeplan-scanner`, `docs-scanner`, `zone-extractor`, `edge-verifier`, `map-emitter`, `map-guardian`, `map-orchestrator`) account for every finding in future runs.

**Division of labour.** The *consuming* side — forgeplan-web (PRD-038 onboarding tour, node detail panel, flow chips, `/api/map` + `/api/map/layers/<zone>`, `validateMapDocument`, `deriveSubDocument`) — **is done**. Everything below is a **generation-side (SOURCE) improvement**: the web renders whatever the pack emits; it cannot fix a flow that has no edges, a node with no description, or a mega tagged with the wrong kind. Every fix here lands in a pack agent or command, not in the web. The web contract is summarized in Appendix A so the emitter emits exactly what the tour/panel/chips read.

**Headline.** v0.7.1 is a real step up over the v0.2.0/v0.6.0 "artifact dump": kind-group megas, per-zone RU module narration, 8-arc decision grouping (in the layer), 4 emitted layers, and 7 top flows. The two brief-known emitter defects **F-ARR** (out-of-enum `arrangement`) and **F-REF** (kind-prefixed `provenance.ref`) are **VERIFIED ABSENT from the shipped bytes** by 4 of 5 audits — all files ship `arrangement:"stack-ttb"` and path-only refs, all 5 pass the web's 14-rule `validate.ts`. They are **safe to close** (Appendix B) but still re-fire a guardian re-loop each run. The surviving defects fall into six clusters: **flows that light nothing** (collapsed-mega targets + empty `edge_ids` + empty `steps`), **broken cross-level identity** (`kind` baked into the node id), **unbuilt recursion/cascade** (depth = 1, layers hand-emulated), **layer-meta drift + unconfirmed ship**, **dead append-stability** (`found_at` constant/missing), and **no staleness model**.

---

## Prioritized findings (deduped across all 5 audits, most-severe first)

| id | title | sev | primary target | one-line what's-wrong |
|---|---|---|---|---|
| **CM-01** | Top-map flows point at nodes hidden inside collapsed megas | **P0** | `map-emitter` + `map-orchestrator` | Flows authored pre-collapse; all 7 target children of collapsed megas, so selecting a flow highlights nothing on screen. |
| **CM-02** | Node id is not stable across altitudes (`kind` baked into the hash) | **P0** | `zone-extractor` | Same file re-classified per scope → different `sha1(kind:ref)` id at each level; `show_on_map(node)` / descend continuity break. |
| **CM-03** | E5 auto-cascade is hand-emulated, not a `/map-build --layers` phase | **P0** | `/map-build` + `map-orchestrator` | The 4 layers came from 4 separate manual runs (4 distinct `agent_run`, 4 divergent meta shapes) — no orchestrated post-confirm fan-out. |
| **CM-04** | Recursion unmet — no nested level-2 layers; depth is exactly 1 | **P0** | `/map-build-layer` + `map-orchestrator` | Only 4 top-zone layers exist; descending a sub-zone/mega falls to client-derived un-hide (no curated zones/flows/RU). |
| **CM-05** | Every flow ships `edge_ids:[]` (30/30) — no flow lights a real arrow | **P1** | `map-emitter` + `edge-verifier` | Verified edges exist but zero are wired into any flow; the composed-map's headline path-highlight has nothing to draw. |
| **CM-06** | `found_at` is a hardcoded constant everywhere AND missing on 27/28 z.core nodes | **P1** | `map-emitter` + `map-guardian` | §19 append-stability sort key is inert (all nodes tie) and undefined on z.core → non-transitive comparator hazard. |
| **CM-07** | Layer meta drifts across all 4 layers + `status:"confirmed"`+`needs_confirm:true` + z.surfaces shipped `proposed`/`generic-floor` | **P1** | `map-emitter` + `map-guardian` + `map-orchestrator` | Every layer invents its own meta keys/separators; one unconfirmed degenerate layer served as if final. |
| **CM-08** | Map has no project-level intro/overview (meta is just a slug) | **P1** | `map-emitter` + `docs-scanner` | No `meta.title`/`meta.description_ru`; `/onboard` + Tier-0 "what is this project?" have no authored answer. |
| **CM-09** | No explicit zone reading-order; `zone_connectors` too sparse (`z.decisions` orphan) | **P1** | `map-emitter` + `map-orchestrator` | Tour order is array-position accident; the decision zone is unlinked to the code it explains. |
| **CM-10** | Top-map `z.decisions` is a by-KIND dump; arc grouping only exists one level down | **P1** | `zone-extractor` | Newcomer's first view of "why" is 6 opaque kind-buckets (EVID 90 > 30-node bar); the 8-arc story is hidden. |
| **CM-11** | Flow `steps` are language-inconsistent (EN vs RU) and mostly empty; 60-char arrow-names | **P1** | `docs-scanner` + `map-emitter` | 9/11 z.decisions flows have `steps:[]`; top-map flows under-narrated; narrative baked into `name`, not `steps`. |
| **CM-12** | No staleness model — date-string fingerprints, empty top-map `layers[]`, output already stale | **P1** | `map-emitter` + `map-orchestrator` | `source_fingerprint` is a date string not a content hash; no manifest of which zones have layers; counts lag live. |
| **CM-13** | Missing guardian checks + interrupted-ship not guarded by atomic write | **P1** | `map-guardian` + `map-emitter` | No check for `found_at`, flow completeness, meta canonicalization, `is_mega⟺kind==mega`, accent uniqueness; all shipped silently. |
| **CM-15** | Wide-strip — `z.decisions` 4×2 grid + uneven per-zone collapse density | **P1** | `zone-extractor` + `map-emitter` | Widest-possible grid + 1-vs-8 cell density squashes to a thin band under fit-to-view. |
| **CM-14** | F-ARR / F-REF / mega-id volatility verified ABSENT — close them, but they re-loop every run | **P2** | `map-emitter` + `zone-extractor` + `map-guardian` | Shipped bytes clean; round-1 emitter defaults still trip GC-1/GC-6 every run (budget + interrupted-ship window). |
| **CM-16** | Node narration coverage collapses at both altitudes | **P2** | `docs-scanner` + `map-emitter` | Top 16/59 non-mega code nodes; z.core 4/28, z.surfaces 16/44, z.decisions 28/194 have `description_ru`. |
| **CM-17** | Decision-zone leaf nodes are a bare-id dump (~164/192) | **P2** | `forgeplan-scanner` | `label:"EVID-042"`, `meta:"active"`, no title, no `description_ru` — reads as an id ledger, not a decision trail. |
| **CM-18** | Layer collapse-mega nodes carry the leaf kind, not `kind:"mega"`; mega `ref` is prose | **P2** | `map-emitter` + `zone-extractor` + `map-guardian` | Layer megas tagged `evidence`/`adr`/`cli-lib-group` inflate kind counts and cause the 19/194 id-hash misses. |
| **CM-19** | Flows are node-SETS not connected edge-PATHS; decision flow splices 2 arcs; padded with subset/micro-hops | **P2** | `map-emitter` + `forgeplan-scanner` | `f.decisions` jumps between composed-map and images arcs; `f.render ⊂ f.request`; `d.map-api` is a 2-node hop. |
| **CM-20** | Chip legibility — labels are full repo paths in top map & z.ui vs curated short in z.surfaces | **P2** | `zone-extractor` | Label policy depends on which agent/level ran; full paths overflow the 190px card. |
| **CM-21** | Scoped composition-selection degenerates to `generic`/`generic-floor` for ALL layers | **P2** | `map-orchestrator` (TYPE/SELECT) + `/map-build-layer` | No scoped template catalogue → every zone interior floors to a generic grid. |
| **CM-22** | Accent palette exhausted — 8 arc-zones, 7 tokens → two adjacent zones both `--map-accent-slate` | **P2** | `zone-extractor` + `map-guardian` | `idef0-core-views` and `composed-map` sit adjacent and colour-identical. |
| **CM-23** | Schema-foreign keys (`description_ru_source`, edge `note`) emitted in only 2/4 layers, then dropped | **P2** | `map-emitter` + SPEC-006/`types.ts` decision | Useful provenance/edge-explainability produced inconsistently and thrown away by the renderer. |
| **CM-24** | Duplicate edge — same `(from,to)` pair with two relations back-to-back | **P2** | `edge-verifier` | `cc7ddf60de54→8a56913aaa40` (RFC-015→PRD-016) as both `refines` and `based_on`; inflates edge counts. |
| **CM-25** | Command-surface gaps — no validate-only/doctor, no stale-refresh, nested `<zone>/<subzone>` not emitted | **P2** | new commands + `map-orchestrator` | An interrupted run can't be re-checked without a full rebuild; drifted layers can't be refreshed selectively. |

> **Cross-audit disagreements to note (resolved above):**
> 1. **Node-id instability severity** — LENS A / LENS C rated it **P1**; the output-design audit rated it **P0**. Resolved to **P0** (CM-02): it silently breaks every cross-level correlation the multi-level system depends on.
> 2. **Mega-id re-derivability** — LENS C (C7) reported 33 megas "not re-derivable" using `sha1(kind+':'+ref)`; the output-design audit (MP-13) showed top-map mega id **is** `sha1("mega:<zone>:<kind>")` (e.g. `sha1("mega:z.decisions:evidence")[:12]=f7526bad50a6`) and the "(90 members)" string is cosmetic. **Resolution:** C used the wrong preimage. The genuine defects are (a) layer megas mislabeled with the leaf kind and (b) mega `provenance.ref` stored as prose rather than the machine preimage — folded into **CM-18**.
> 3. **"Generic-floor degeneration" location** — the task framed it as inside `z.decisions`; LENS E **refutes and corrects**: `z.decisions` is `composition_id:"generic"`/`status:"confirmed"`; the actual `generic-floor`/`NEEDS_CONFIRM` degeneration is in **`z.surfaces`** (`status:"proposed"`), folded into **CM-07**/**CM-21**.

---

## `/map-build` (top-map command)

**CM-03 (P0) — add the layer fan-out phase.** Today the top map is confirmed and the run stops; the four layers were produced by four separate manual `/map-build-layer` invocations (proof: `agent_run` values `task-zcore-resume-0704`, `layer-zui-20260706`, `layer-zsurfaces-20260706`, `task-layerzdec-20260706`, and four mutually inconsistent meta shapes — a single cascade would stamp them uniformly).
- Add a **`--layers`** phase: after the top map flips `proposed→confirmed`, enumerate confirmed top-level zones and dispatch the scoped `map-build-layer` pipeline **in parallel**, gated by three cost controls: (a) **seed-fingerprint idempotent skip** — skip a zone whose parent-slice content-hash equals the layer's recorded `seed_fingerprint`; (b) **thin-zone threshold** — skip zones with ≤ N members (a layer that re-lists ≤8 nodes adds nothing); (c) **depth policy** — honour a `max_depth` cap and record `stop_reason` in each layer's meta.

**CM-12 (P1) — regenerate top map + layers in one run so counts can't diverge.** The top map (`version:4`, `source_fingerprint:"fpw-map-20260706"`) reports mega labels `PRD (36)`/`RFC (30)`/`EVID (90)`, but its own `z.decisions` layer leaves count `prd 37`, and live `.forgeplan` is `PRD 39 / RFC 32 / ADR 9 / EVID 93`. Emit both passes atomically against one CLI graph revision.

---

## `/map-build-layer` (scoped command)

**CM-04 (P0) — make it recursive.** Only `layers/z.core.json`, `z.ui`, `z.surfaces`, `z.decisions` exist. `z.core.json` itself declares sub-zones `z.entities/z.shared/z.app/z.cli/z.build/z.docs/z.playground`, yet no `layers/z.core/z.entities.json` is emitted, so a second descent falls to the web's `deriveSubDocument` (raw un-hide, no curated sub-zones/flows/RU — exactly the "empty deeper level" symptom).
- After emitting `layers/<zone>.json`, for each sub-zone above the thin-zone threshold, recurse into `layers/<ancestor>/<zone>.json` until leaf zones (≤ threshold) or `max_depth`. Emit `{max_depth, stop_reason}` in each layer's meta.
- **Coordinate with the web on RFC-032 OQ1**: the nested route `/api/map/layers/<ancestor>/<zone>` currently validates a **single** segment only (charset excludes `/`). Nested files won't render until that param is extended — flag it so generation and render land together.

**CM-21 (P1→P2) — stop flooring to generic in scoped mode.** Every scoped run picks `composition_id:"generic"` (`z.surfaces` even `"generic-floor"`). Feed the scoped TYPE/SELECT step a small catalogue keyed on the parent `zone.kind` (see `map-orchestrator`) instead of reusing the repo-root `web-fullstack` detector, which cannot match a zone interior.

**CM-06 (P1) — layer regression on `found_at`.** `z.core.json` omits `found_at` on 27/28 nodes (only the one mega carries it). Every scoped run must stamp `found_at` on every node (fix in `map-emitter`).

---

## `map-orchestrator`

**CM-01 (P0) — own collapse-vs-flow ordering.** The emitter authored `flows[]` against the pre-collapse node set, then collapsed 221/244 nodes into 11 megas. Decide and enforce one of the three CM-01 remedies (below, `map-emitter`) as a pipeline-ordering rule.

**CM-03 (P0)** — drive the CM-03 `--layers` cascade with the three cost controls.

**CM-08 (P1) — source the map-root narration.** Provide the emitter with `meta.title` (EN) + `meta.description_ru` sourced from README/CLAUDE.md via `docs-scanner` (never fabricated, per §15). Today `meta` is only `{map_id:"forgeplan-web-fullstack", status, project_type, composition_id, source_fingerprint, version, agent_run}` — the real identity ("read-only forgeplan workspace viewer, npm CLI, no user-side install") is buried in node `0cce7b3277f1.description_ru`.

**CM-09 (P1) — pick a deterministic reading order.** Choose `composition.reading_order:[zone_ids]` per template and ensure `zone_connectors` covers every zone. Today only `surfaces→core→ui` connectors exist; `z.decisions` is in none, so the tour visits the largest zone last only by array accident.

**CM-11 / CM-07 (P1) — enforce ONE cross-run convention.** The per-zone fan-out lets each `agent_run` drift on narration language (EN steps in z.core/z.decisions vs RU elsewhere) and meta shape. Pin a shared narration + meta template that every scoped run fills identically.

**CM-21 (P2) — scoped composition catalogue.** Own a small catalogue keyed on zone kind: a **decision-trail** composition for truth zones (EPIC→PRD→RFC→ADR→EVID lanes), an **fsd-layers** composition for core/ui zones, a **surfaces** composition for surface zones. Record *why* a floor was chosen in meta so it's auditable.

**CM-25 (P2)** — own the E5 staleness/idempotency surface and the depth-policy discovery that lists which sub-zones warrant a layer.

---

## `code-scanner`

**CM-06 (P1) — supply a real `found_at` for code modules.** Instead of the build-time constant `"2026-07-06T00:00:00Z"`, derive first-seen from `git log --diff-filter=A` (first-touch per module), so §19 append-stability and `is_new` become order-bearing. Fall back to run-time only for genuinely new modules.

**CM-14 (P2) — path-only refs are correct; keep them.** All code-node `provenance.ref` are already bare paths (`bin/forgeplan-web.mjs`, `template/src/entities/map`). Lock with a regression fixture (Appendix B).

**CM-20 (P2) — emit a legible label alongside the path.** Provide `label = basename / curated human name` (e.g. `GET /api/list`, `artifact-filters`, `init.mjs`) and keep the full path only in `provenance.ref`; `zone-extractor` enforces the single label policy.

---

## `forgeplan-scanner`

**CM-17 (P2) — lift artifact titles into labels + descriptions.** In `z.decisions.json`, ~164/192 leaf artifact nodes are `label:"EVID-042"`, `meta:"active"` with no `description_ru` (coverage: 5/40 PRD, 6/34 RFC, 5/12 ADR, 8/98 EVID). The title is one `forgeplan_get` away.
- For every artifact node set `label = "<ID> — <title>"` (e.g. `"EVID-042 — smoke exit 0 CL3"`), `meta = "<kind> · <status>"`, and populate `description_ru` from the artifact's summary/first paragraph. Honest-omit only when the body is genuinely empty (§23).

**CM-19 (P2) — build decision flows per connected arc.** The top-map `f.decisions` samples one artifact per kind across different arcs: `EPIC-001 → PRD-036 → RFC-030 → SPEC-006 → EVID-081 → ADR-005 → PRD-030` — the first five are the composed-map arc, the last two (`ADR-005`, `PRD-030`) are the **unrelated** image-registry decision (the layer itself names that flow `"Images system: RFC-026 shapes ADR-005 shapes PRD-030"`). Synthesize each decision flow as **one connected typed-link component** (e.g. separate "Composed-map decision trail" and "Images-system decision trail" chips), each with real `edge_ids` and per-hop RU steps.

**CM-14 (P2)** — artifact refs are already slug-only (`ADR-001`, `PRD-036`); keep, and lock with a fixture.

---

## `docs-scanner`

**CM-08 (P1) — produce the map-root narration.** Emit a grounded EN `meta.title` + 1–2 sentence RU `meta.description_ru` from README/CLAUDE.md for `map-emitter` to attach to `meta`.

**CM-11 (P1) — RU step narration for every flow.** Enforce §15: `flow.name` EN, `flow.steps` RU, `steps.length ≥ 2` for any flow with >2 nodes. Regenerate z.core steps in RU (currently English: *"9 entity slices … each import createPoller from shared/api"*) and backfill the 9 bare `z.decisions` flows (`idef0-view-shaping-chain`, `idef0-core-spec-chain`, `idef0-core-tier-lift-decision`, `idef0-core-icom-decision`, `composed-map-onboarding-adr`, `rfc028-architecture-review-trail`, `rfc028-systemdev-review-trail`, `rfc028-guardian-gate-trail`, `composed-map-render-proof-evidence-trail`). The good shape already exists: `z.surfaces.json` `d.init` is 6 nodes / 6 RU steps.

**CM-16 (P2) — run scoped grounding at full budget.** Narration coverage collapses on descent: top map 16/59 non-mega code nodes carry `description_ru`, z.core **4/28**, z.surfaces 16/44, z.decisions 28/194 (z.ui 11/13 is the only decent one). The low z.core figure indicates the scoped docs pass is barely running, not that sources are missing (e.g. z.core `activity` → only `meta:"entity · activity poller"`, no body). Run docs-scanner in scoped mode with the same grounding budget as the top pass; also **propagate node `description_ru` to the top altitude** (the top pass already has the docs-scanner output) so a newcomer who clicks `GET /api/map` or `entities/map` at the altitude they land on gets a filled card.

---

## `zone-extractor`

**CM-02 (P0) — mint node ids from a scope-invariant key.** id = `sha1(kind+':'+ref)[:12]`, but `kind` is re-classified per scope, so the same file has a different id at every altitude: `template/src/entities/activity` is `2f3895462e21`/`slice` on the top map but `bbcad5caf9f2`/`entity` in `z.core`; `bin/forgeplan-web.mjs` is `0cce7b3277f1`/`entrypoint` up top but `bd1f5e94a026`/`cli-entry` in `z.surfaces`; `scripts` is `05d654f4d508`/`build-tooling` vs `cfeee151002c`/`script`. (`bin` matches at `8dc34466d978` only because `kind` stayed `cli` — proving `kind` is the instability driver.)
- **Fix:** freeze one deterministic `path→kind` function applied identically at every altitude, so `sha1(kind:path)` is level-invariant — **or** decouple identity from kind (mint id from path/slug only; carry `kind` as a display attribute). Either way, coordinate the choice with `map-guardian` GC-6 and the web's `deriveSubDocument` id-carry. This is the single change that makes `show_on_map(node)`, breadcrumb "you are here", descend/climb continuity, and append-stability across re-scope actually hold.

**CM-10 (P1) — promote arc grouping to the top-map `z.decisions`.** The top map bins 174 decision artifacts by KIND (megas `PRD (36)` `5b8c97984798`, `RFC (30)` `397b6f98a524`, `EVID (90)`, `ADR (9)`, `SPEC (6)`, `NOTE (2)`, `EPIC-001`), while `z.decisions.json` already derives 8 meaningful arcs (`arc.packaging-delivery`, `arc.install-scope-instances`, `arc.security-hardening-dispatch`, `arc.graph-views-ux`, `arc.proactive-surfacers`, `arc.shared-ui-design-system`, `arc.idef0-core-views`, `arc.composed-map`). Reuse that arc-derivation at the top level — emit ~8 arc mega-cards (with a kind breakdown inside) so the newcomer's first view of "why" is the story, not a type histogram. **No mega should hide >~30 nodes at the landing altitude** (EVID 90 currently does).

**CM-15 (P1) — square grids + consistent collapse density.** `z.decisions.json` is `canvas.grid {cols:4, rows:2}` for 8 arc-zones (widest of all layers; z.core is 3×3, z.ui/z.surfaces 2×2). Separately, within z.core the collapse policy is uneven — `z.entities` collapses 10 entities to 1 card while `z.shared` leaves 8 uncollapsed in the same 3×3 — so cells hold 1 vs 8 and squash under fit-to-view.
- Pick `cols ≈ ceil(sqrt(N))` (8 → 3×3) to minimize aspect deviation from the viewport; cap cols so a single-row strip never ships. Apply **one** deterministic collapse threshold per layer (same member count for every zone), and cap a single mega's child count (split `EVID` by arc even at top level, matching what the layer already does).

**CM-20 (P2) — one label policy at every level.** `label` = basename / curated short name; full path stays in `provenance.ref`. Today top map + z.ui use full paths (`template/src/routes/api/list/+server.ts` `121077169b60`, `template/src/widgets/artifact-filters` `cc021439878c`) while z.surfaces uses curated (`GET /api/list`, `init.mjs`, `+page.svelte (root)`).

**CM-22 (P2) — accent assignment ≤ palette / no adjacent collision.** The web palette is 7 tokens (`cyan/emerald/violet/amber/rose/orange/slate`); z.decisions created 8 arc-zones and assigned `…/slate/slate`, so `arc.idef0-core-views` (cell 1,2) and `arc.composed-map` (cell 1,3) are adjacent and colour-identical. Cap at 7, or when >7 zones are legitimate, assign so no two grid-neighbours collide (and coordinate a palette expansion with the web if >7 is a real need).

**CM-18 (P2)** — collapse-group synthesis must set `kind:"mega"` (see `map-emitter`).

**CM-14 (P2)** — mint `provenance.ref` as the bare path/slug preimage at extract time (the default already lands clean; make it the default, not a guardian-remediated end-state) so GC-6 passes on round 1.

---

## `edge-verifier`

**CM-05 (P1) — expose the `(from,to)→edge` mapping and resolve each flow hop.** Verified edges exist and are high-quality (z.core has 16 grep-verified code-dep edges with `verified_by:"grep:@/shared/api"`; the top map has typed-link edges) but **zero** are referenced by any flow. For each flow, resolve every consecutive `(node_ids[i], node_ids[i+1])` to a real edge id and populate `flow.edge_ids`; where no edge backs a hop, insert the connecting intermediate node or flag the flow non-edge-backed — don't emit an unlit path.

**CM-19 (P2) — flows must be connected edge-PATHS, not node-SETS.** e.g. top-map `f.request` lists 9 nodes spanning `z.surfaces→z.core→z.ui` but there is no edge `api/list→+layout`, so a naive consecutive-node inference yields a broken path. Compute the ordered edge chain (minting stable edge ids) and drop/repair flows whose consecutive nodes have no connecting edge.

**CM-24 (P2) — dedupe multi-relation edges.** `map.json` emits `cc7ddf60de54→8a56913aaa40` (RFC-015→PRD-016) twice back-to-back — once `refines`, once `based_on`. Key edges by `(from,to,relation)` and drop exact dupes; for a genuine multi-relation pair, collapse to the strongest relation with the others in a `note`, or mark intended multiplicity explicitly. Add a guardian advisory for repeated `(from,to,relation)`.

---

## `map-emitter`

This agent owns the largest share of fixes.

**CM-01 (P0) — reconcile flow authoring with mega-collapse.** All 7 top flows point mostly/entirely at collapsed children (`f.request` hidden 7/9, `f.render` 7/7, `f.entry` 5/5, `f.decisions` 6/7, `d.init` 1/2, `d.start` 2/3, `d.map-api` 2/2). e.g. `f.render` node_ids `509e84a73319/739ee756605c/afdcabb56ccb/0d374f859a06` are all children of collapsed mega `Entities (10)` (`6b8061e4b212`); `f.request`/`f.entry` point into collapsed `Entrypoint (18)` (`dcb0d1e38887`). Pick one: (a) rewrite each flow's `node_ids` to the surviving mega that now contains a member (web expands on select); **(b)** add `flows[].expand_megas:[mega_id]` so the renderer opens exactly the megas a flow needs; or (c) don't collapse a zone whose flows traverse it. Any of the three makes flow selection and PRD-038's camera tour visible.

**CM-05 (P1) — populate `flow.edge_ids`** from the emitted edges (resolve via `edge-verifier`). All 30 flows (7 top + 4+4+4+11) currently ship `edge_ids:[]`.

**CM-06 (P1) — stamp a real `found_at` on EVERY node, always.** Stop emitting the single constant `"2026-07-06T00:00:00Z"`. On each run read the previous document, copy `found_at` for every existing id, mint a fresh real UTC timestamp (or git first-seen) only for new ids (set `is_new:true` for those). Never omit it — including layer leaf nodes (z.core omits 27/28). Fail-closed if any node lacks `found_at`.

**CM-07 (P1) — freeze ONE canonical layer-meta struct.** The four layers disagree on nearly every key:
- `z.core`: `{map_id:"…::z.core", parent_map, parent_zone, scope:"layer", needs_confirm:true, status:"confirmed"}`
- `z.decisions`: same shape as z.core
- `z.surfaces`: `{parent_map_id (diff key), classification_confidence:"low", classification_note:"…NEEDS_CONFIRM", status:"proposed", composition_id:"generic-floor"}` — no `scope`/`needs_confirm`
- `z.ui`: `{map_id:"…-z.ui" (hyphen, not "::"), scope_zone (diff key), confidence:"low", project_type:"web-fullstack", needs_confirm:true, status:"confirmed"}`

Emit an identical struct for every layer: `map_id = "<parent_map_id>::<zone_id>"` (fixed `::` separator), `parent_map_id`, `parent_zone`, `scope:"layer"`, `project_type` inherited from parent, `source_fingerprint`, `seed_fingerprint`, `version`, one confidence field, `status` set **only** by the guardian. **Never emit `status:"confirmed"` with `needs_confirm:true`** (a self-contradiction on z.core/z.ui/z.decisions) and never ship a layer at `status:"proposed"` alongside confirmed siblings.

**CM-08 (P1) — emit `meta.title` + `meta.description_ru`** (docs-sourced) at the map root. The web schema tolerates extra keys (validate Rule 14 = warning-only), so this is additive; the tour opener, Tier-0 "what is this?", and `/onboard` header all consume it.

**CM-09 (P1) — emit `composition.reading_order` (or `zones[].order`)** and populate `zone_connectors` so every zone is reachable/ordered (connect `z.core→z.decisions` "why").

**CM-11 (P1) — require non-empty `steps` + short EN names.** `steps.length ≥ 1` per hop (RU, §15); a flow with no narration source is dropped, not emitted empty. Move the ID chain out of `name` — emit `name:"Images system"` (short), not `name:"Images system: RFC-026 shapes ADR-005 shapes PRD-030"` (60+ chars). Reconcile step count to node/edge count (top-map `f.request` is 9 nodes / 3 steps; `f.decisions` 7 / 1).

**CM-12 (P1) — content-hash fingerprints + a layer manifest.** `source_fingerprint` is a date string (`"fpw-map-20260706"`); make it `sha1` over the concatenated content-hashes of the covered nodes. Record `seed_fingerprint` = the parent zone-slice hash a layer was derived from. Populate the top map's `zones[].layers` and a top-level `layers[]` manifest (currently `[]`) listing each emitted layer's zone/file/`seed_fingerprint` so the web can diff live-parent-hash vs `seed_fingerprint` and badge stale layers.

**CM-14 (P2) — emit `arrangement:"stack-ttb"` first-time.** Width lives in `canvas.grid.cols` (top 2, z.core 3, z.decisions 4). This removes the GC-1 remediation re-loop from every run and the interrupted-ship window.

**CM-15 (P1)** — grid `cols ≈ ceil(sqrt(N))`; cap mega child count (with `zone-extractor`).

**CM-18 (P2) — collapse groups must set `kind:"mega"`.** In every layer, collapse-group nodes carry `is_mega:true` + `children[]` but the **leaf** kind: z.decisions `69c8b0f83af7` `{label:"EVID · idef0-core-views (32)", kind:"evidence"}`, z.surfaces `bin/lib (7)` `kind:"cli-lib-group"`, `Forgeplan proxy endpoints (13)` `kind:"api-endpoint-group"`. The **top map does it correctly** (`f7526bad50a6` `{label:"EVID (90)", kind:"mega"}`). Unify the two code paths: set `kind:"mega"` on every collapse group (member kind → `meta`/`label` only). Also store the machine preimage `"mega:<zone>:<kind>"` as `provenance.ref` (put the human sentence `"z.decisions · evidence group (90 members)"` in a separate field) so GC-6 can re-derive mega ids. This closes the id-hash misses (233/244 top, 175/194 z.decisions — the gaps are exactly these mislabeled megas) and the inflated kind counts (z.decisions raw kind Counter reads `evidence:98/prd:40/rfc:34/adr:12/spec:7` vs true leaf `evidence:90/prd:37/rfc:30/adr:9/spec:6`).

**CM-23 (P2) — decide and be consistent on foreign keys.** `node.description_ru_source` (grounding provenance, SPEC D5/E3) appears in z.surfaces (18×) + z.core (4×) but not z.ui/z.decisions; `edge.note` (plain-language edge explanation) appears in z.core (16×) + z.surfaces (25×) but not z.ui/z.decisions. Either **adopt both into `forgeplan.map/v1`** (`types.ts` `MapNode.description_ru_source`, `MapEdge.note`) and emit on **every** layer, or stop emitting them. Whichever way, make it uniform.

**CM-19 (P2)** — curate flows for distinctness (drop `f.render ⊂ f.request`; merge micro-hops like `d.map-api` = `[26338bc9b8d2, ebf82839875a]`; prefer the layer-quality 4–8-node numbered journeys).

---

## `map-guardian`

**CM-13 (P1) — add the missing deterministic checks.** GC-1..GC-6/XC-1/XC-2 cover schema + the 3 invariants + mega integrity + determinism + cross-source edges, but nothing catches the defects the layers actually ship. Add:
- **GC-7 node-completeness** — every node has an ISO-valid `found_at` (would have caught CM-06 z.core omission).
- **GC-8 flow-completeness** — every flow's `edge_ids` span its `node_ids` in order **and** `steps` is non-empty for multi-node flows (catches CM-05/CM-11).
- **GC-9 meta-canonicalization** — a `scope:"layer"` doc carries exactly the frozen key set; `(status=="confirmed") XOR (needs_confirm==true)`; refuse to write a layer at `status!="confirmed"` or carrying a `NEEDS_CONFIRM` note (catches CM-07).
- **GC-10 mega integrity** — `is_mega:true ⟺ kind=="mega"` and non-empty `children` (catches CM-18).
- **GC-11 accent uniqueness** (advisory) — flag duplicate accents on grid-neighbour zones (catches CM-22).

Mirror the first two into the shared `map.schema.json` so the web `validate.ts` and the guardian agree (don't let the three validators drift).

**CM-14 (P2) / interrupted-ship atomicity (P1 within CM-13).** F-ARR and F-REF are verified absent in the shipped bytes (all 5 docs `arrangement:"stack-ttb"`; all 490 real nodes re-derive as `sha1(kind:path-only-ref)`), so keep GC-1/GC-6 as backstops but **make the layer write atomic** (tmp file + rename only after the guardian confirms) so an interrupted round-2 remediation cannot leave a `grid-2x2` + `status:"proposed"` layer at the live path (the sole scar this run is `z.surfaces` shipping `proposed`). Move the cheap GC-1/GC-6 assertions into the emitter's pre-write assembly-guard so a defect is caught before write, not via a re-loop. Lock the closed defects with regression fixtures (Appendix B).

**CM-09 (P1)** — the guardian is the right place to source `status`; clear `needs_confirm` when it flips `proposed→confirmed`.

---

## New commands to add

**CM-25 (P2).** The surface is only `/map-build` + `/map-build-layer`. Add:
- **`/map-doctor <path>`** — run the guardian on an existing `map.json`/layer **without regenerating**. Catches interrupted-ship invalids and `status:"proposed"` floors that today can only be re-checked by a full rebuild.
- **`/map-refresh`** — diff each layer's `seed_fingerprint` (CM-12) against a cheap live probe and rebuild **only drifted** layers (the counts are already stale: map `PRD 36`/`RFC 30`/`EVID 90` vs live `PRD 39`/`RFC 32`/`EVID 93`).
- **Nested `/map-build-layer "<zone>/<subzone>"` cascade** (CM-04) — emit `layers/<ancestor>/<zone>.json` for large sub-zones, plus an auto-cascade discovery that lists sub-zones over the thin-zone threshold. Requires the web to extend `/api/map/layers` to nested paths (currently rejects `/`); coordinate so both land together. Until then, surface per-zone `"layer not built — run /map-build-layer \"<zone>\""` hints keyed on real emitted state (PRD-038 FR-003 empty-state).

---

## Appendix A — What the web already consumes / needs (PRD-038 field contract)

The web is done; it reads exactly these fields. The emitter must supply them so the tour/panel/chips have content:

| Web surface (PRD-038) | Fields it reads | Emitter obligation |
|---|---|---|
| **Onboarding tour opener** (FR-004/005/007) | `meta.title`, `meta.description_ru`, `composition.reading_order` (or `zones[]` order), `composition.zone_connectors` | CM-08, CM-09 — emit a project title/tagline + explicit reading order + full connector coverage. |
| **First-impression / camera tour** (FR-005) | `flows[].node_ids` **that resolve to visible nodes**, `flows[].edge_ids`, `flows[].expand_megas` | CM-01, CM-05, CM-19 — flow targets must be on-screen (or name the megas to open) and edge-backed. |
| **Flow chips** (FR-006) | `flows[].name` (short EN), `flows[].steps` (RU, ≥1/hop) | CM-11 — non-empty steps, short names, RU. `ComposedMapView.svelte` gates the flowcap on `activeFlowObj?.steps.length > 0` (9 z.decisions flows render a dead chip today). |
| **Node detail card** (FR-001) | `node.description_ru` (+ optionally `description_ru_source`), legible `node.label`, `node.meta` | CM-16, CM-17, CM-20, CM-23 — fill `description_ru` at the altitude the newcomer lands on; short labels; decide on `description_ru_source`. |
| **`show_on_map(node)` / breadcrumb** (FR-010) | a **stable node id across altitudes** | CM-02 — id must not change per scope. |
| **Descend seam** (FR-002, RFC-031/032) | `/api/map/layers/<zone>` file present with canonical `meta.parent_zone`; `zones[].layers` manifest | CM-04, CM-07, CM-12 — emit nested layers, canonical meta, and a `layers[]` manifest. |
| **Append-stability / "new" badge** (§19) | per-node `found_at` (real, ISO), `is_new` | CM-06 — real timestamps, not a constant. `composed-layout.ts:105` sorts on `found_at`, falling through to hash order when constant. |
| **Staleness affordance** | `meta.source_fingerprint`/`seed_fingerprint` as **content hashes**, `zones[].layers` | CM-12 — content-hash fingerprints so the web can compare and badge stale. |
| **Mega collapse/expand** | `node.is_mega`, `node.children[]`, `node.kind=="mega"` | CM-18 — layer megas must carry `kind:"mega"`, not the leaf kind. |
| **Zone accents** | `zone.accent ∈ 7-token palette`, unique among neighbours | CM-22 — no adjacent collision. |

Extra keys are safe (validate Rule 14 is warning-only), so `meta.title`/`description_ru`/`reading_order` can be added additively — but `description_ru_source` and edge `note` are **dropped** unless adopted into `types.ts` (CM-23).

## Appendix B — Verified refuted / safe-to-close (lock with regression fixtures)

All four output-inspecting audits agree these do **not** reproduce in v0.7.1's shipped bytes. Close them and add fixtures so they can't silently return:

1. **F-ARR** (out-of-enum `arrangement`) — all 5 documents ship `composition.arrangement:"stack-ttb"`; column count in `canvas.grid.cols`. Fixture: a map whose arrangement is `stack-ttb` with cols in `canvas.grid`. *(Residual: emitter still emits `grid`/`grid-2x2` on round 1 → GC-1 re-loop — fix per CM-14.)*
2. **F-REF** (kind-prefixed `provenance.ref`) — all 490 real (non-mega) nodes re-derive as `sha1(kind+":"+path-only-ref)[:12]`; code refs are bare paths, artifact refs bare slugs. Verified hashes: `sha1("entrypoint:bin/forgeplan-web.mjs")[:12]=0cce7b3277f1`, `sha1("adr:ADR-001")=8749898c2553`, `sha1("prd:PRD-001")=5d11a81803c0`. Fixture: a code node whose id == `sha1(kind:path)`. *(Residual: extractor still kind-prefixes on round 1 → GC-6 re-loop — fix per CM-14.)*
3. **Mega-id member-count volatility** — mega id is `sha1("mega:<zone>:<kind>")` (`sha1("mega:z.decisions:evidence")[:12]=f7526bad50a6`), so the `(90 members)` string in `provenance.ref` is cosmetic; a 91st EVID will **not** churn the mega id. Fixture: two runs at different EVID counts producing the same mega id. *(This corrects LENS C's C7 "33 megas not re-derivable" — C used the wrong preimage; the real mega defects are CM-18.)*
