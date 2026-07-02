---
depth: standard
id: EVID-061
kind: evidence
last_modified_at: 2026-07-01T18:20:31.013530+00:00
last_modified_by: claude-code/2.1.196
status: active
title: 'Architecture review of RFC-029: CONCERNS — unbounded fallback DOM + rollup/window + focus-key + mosaic blast'
---

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

<!-- CL3: direct architecture review of RFC-029 against its own PRD-034 / SPEC-005
     acceptance criteria and the shipped RFC-028 core source it binds to, in the
     same repo/branch (feat/idef0-view-t2). `weakens`: the review surfaces HIGH/MEDIUM
     fitness gaps that weaken the case for activating RFC-029 as written — the design
     spine is sound but two load-bearing gaps must close before implementation. -->

## Verdict

**CONCERNS**

One-line justification: the design spine (A2 hybrid render + B3 drill, one pure `Idef0Layout`, honest `verdict.mode` switch, reuse-not-fork in dense mode) fits PRD-034 well and binds to the EXACT frozen `deriveIdef0` options-object contract — but the **tier-stack fallback layout consumes the raw `TierStackForest` instead of the core's already-bounded non-null tier-stack `diagram`, defeating the ≤6/tier+rollup DOM cap on the LIVE real-data path (NFR-001/AC-6/RC-5)**, and the **rollup-expand + N≥1000 bounding both lean on a core `window` parameter that the shipped `computeIdef0Diagram`/`computeTierStackDiagram` ignore**. Both are RFC-level gaps closable by revision (not a redesign), so CONCERNS, not BLOCKER.

## Ground-truth verification

- Base..head: base **not provided** in prompt; head `4b03b46` ("docs(forgeplan): T2 SHAPE — PRD-034 + SPEC-005 idef0 view + design evidence"), branch `feat/idef0-view-t2`. This is an **RFC design-artifact review**, not a code-landing claim — there is no source delta to verify (the RFC proposes code that does not yet exist).
- Artifact probe: `ls .forgeplan/rfcs/RFC-029-*.md` → present, 34744 bytes (untracked draft, authored post-SHAPE-commit this session) + full body materialised in the forgeplan index (verified via `forgeplan_get RFC-029`).
- Diff state: **DELTA=PRESENT** (RFC-029 body substantive; PRD-034 + RFC-028 projections show ` M`).
- Expected delta token: `deriveIdef0(raw` (the core binding the RFC MUST make) — source: task claim / SPEC-005 Contract.
- Token probe: `grep -nE "deriveIdef0\(raw" RFC-029.md` → **FOUND** (RFC lines 24, 83–84: exact options-object signature `{ threshold; focus?; window?; takenAt? }`).
- Core cross-probe: `grep -nE "_window" template/src/shared/lib/idef0/diagram.ts` → lines 60 & 112 (`_window?: Window` **unused** in both `computeIdef0Diagram` and `computeTierStackDiagram`) — substantiates Findings 1 & 2.
- Verdict floor from ground-truth gate: **PASS-eligible** (artifact present + substantive; binding token FOUND). Verdict driven to CONCERNS by fitness findings below, not by the ground-truth gate.

```
$ grep -nE "layoutTierBands" RFC-029.md
96:else /* "tier-stack" */:  diagramLayout = layoutTierBands(tierStack)   // altitude bands, all dashed, no real arrows
119:layoutTierBands(tierStack: TierStackForest, geom?: Partial<BoxGeom>): Idef0Layout // mode === "tier-stack"
130:`layoutTierBands` flows `tierStack.tiers` ... members flow left-to-right, wrapping within the band ...

$ grep -nE "_window|window" template/src/shared/lib/idef0/diagram.ts
60:  _window?: Window,      # computeIdef0Diagram — param present, NEVER referenced in body
112:  _window?: Window,      # computeTierStackDiagram — param present, NEVER referenced in body
```

## Scope

### RFC under review
- ID: `RFC-029` — "idef0 view — first host renderer over the TADD core" (draft)
- Sections inspected: Summary, Motivation, Module Breakdown + FSD, Component Diagram, Data Flow, Function Signatures / Component Contracts, The ICOM Layout Algorithm, Two-pane Composition, Registration Plan, Options Considered, Proposed Direction + ADI, Implementation Phases, A11y/Reduced-motion/Dual-theme, Test Strategy Hooks, Risks & Mitigations, Migration/Rollback.

### Parent PRD (source of truth for acceptance)
- ID: `PRD-034` — FR-001…FR-011, AC-1…AC-7, NFR-001…NFR-004, Non-Goals (T3/T4/T5, no mutation).

### Render contract + core inspected
- `SPEC-005` — RC-1…RC-8, twelve `#### Scenario` blocks, V-EMPTY/V-FALLBACK/V-ROLLUP/V-DERIVED-ONLY/V-COLLISION/V-UNKNOWN-ROLE.
- `RFC-028` core (via source, not just the RFC's claims): `template/src/shared/lib/idef0/index.ts` (`deriveIdef0`, `DeriveOptions`, `DeriveResult`), `types.ts` (`Idef0Diagram`, `DiagramBox`, `OutlineRow`, `TierStackForest`, `CompositeKey`, `Window`), `diagram.ts` (`computeIdef0Diagram`, `computeTierStackDiagram`), `outline.ts` (`flattenOutline`), `relation.ts` (`classifyIcom`/`icomToSide`), `keys.ts` (`serialiseKey`).
- `ADR-007` — ICOM reading key + honesty (I=left/C=top/O=right/M=bottom; real=solid/derived=dashed ≈; edge-scoped provenance P-5).

### Integration surfaces inspected (grounded, not guessed)
- `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` — host branch order + prop bindings + `inner`/`resetZoom` contract.
- `template/src/shared/config/ui-prefs.ts` — `GraphView` union, `GRAPH_VIEWS`, `GRAPH_VIEW_IDS`.
- `template/src/widgets/dependency-graph/model/types.ts` — re-exports `GraphView` from `@/shared/config` (single source, confirmed).
- `template/src/widgets/mosaic/ui/MosaicCanvas.svelte`, `template/src/widgets/mosaic/lib/persist.ts` — second consumer of `GRAPH_VIEWS`/`GRAPH_VIEW_IDS`.
- `template/src/widgets/dependency-graph/lib/reduced-motion.ts` — `motionDuration` signature confirmed.

### Not reviewed (out of scope)
- The unwritten `idef0-layout.ts` / `Idef0View.svelte` themselves (do not exist yet — this is a pre-implementation design gate).
- The N≥1000 interaction-latency **budget number** (TBD by design; RFC-028 Q4 / T1 NFR-002 — correctly deferred, not a finding).
- Security/STRIDE, line-level bugs, test-runner execution (other reviewers / not applicable pre-code).

## Methodology

| Step | Detail |
|---|---|
| Fitness categories applied | Scalability, Data flow, Blast radius, Coupling/reuse-not-fork, Testability |
| Parent-PRD cross-check | every relevant FR/AC mapped below (covered / drifted / partial) |
| Recalled priors | memory bank: A3 two-pane outline+ICOM diagram scored 7.5 (chosen surface); EPIC-001 T-track (T2=view, T4=composed-map graft); ADR-007 framing. `mm-gate-failures` mental model **not present in this bank** (empty `mental_model_list`) — recorded as unavailable, not fabricated. |
| Static analysers | see table |

### Static analysers

| Tool | Command | Status | Exit | Summary |
|---|---|---|---|---|
| grep (binding audit) | `grep -nE "deriveIdef0\(raw|layoutTierBands|_window" …` | executed | 0 | confirmed exact `deriveIdef0` binding; confirmed `_window` unused in both diagram fns |
| git (ground-truth) | `git -C <root> log/status --short` | executed | 0 | head 4b03b46; RFC-029 md present (untracked draft) |
| madge (cycles) | `madge --circular --extensions ts,svelte template/src` | skipped | — | not installed in this environment |
| cloc (module size) | `cloc --by-file template/src/shared/lib/idef0` | skipped | — | not installed; sizes read via `ls -la` instead (core files 1–6 KB, well-scoped) |
| tsc/svelte-check | — | not run | — | out of scope for a design-artifact gate (no new source to type-check yet) |

## Parent-PRD fit

| PRD-034 FR / AC | RFC-029 section | Coverage | Note |
|---|---|---|---|
| FR-001 selectable additive view | Registration Plan | ✅ covered | branch after `sunburst`, before `{:else}` LanesView — matches real host |
| FR-002 windowed altitude outline | Two-pane Composition / Data Flow | ✅ covered | `flattenOutline(forest, window)` is genuinely windowed in the core |
| FR-003 one-level ICOM diagram (≤bound children + rollup + sided arrows) | ICOM Layout Algorithm | ⚠️ partial | dense diagram bounded ✓, but **rollup-expand mechanism unbacked** (Finding 2) |
| FR-004 honest mode switch, render returned mode | Mode selection (RC-1) | ✅ covered | switches on `verdict.mode`, never upgrades a fallback — correct |
| FR-005 permanent legend | Two-pane Composition | ✅ covered | legend from `diagram.legend` in every state incl. empty |
| FR-006 keyboard nav | A11y §, B3 | ✅ covered | drill down/up both have keyboard paths; native focus via DOM boxes |
| FR-007 reduced-motion | A11y § | ✅ covered | `motionDuration` confirmed present |
| FR-008 token dual-theme | A11y § / rule 24 | ✅ covered | reads `app.css` tokens; honesty via line-style+label not colour |
| FR-009 same read-only snapshot | Data Flow | ✅ covered | no new endpoint; rule 22 respected |
| FR-010 honesty encoding solid/dashed | Data Flow / RC-2 | ✅ covered | per-element `provenance` → line style |
| FR-011 reuse-not-fork | L-1 / RC-3 | ⚠️ partial | solid in **dense** mode; **weakened in fallback** — `layoutTierBands` re-derives band/number off raw `tierStack` instead of the core `diagram` (Finding 1) |
| NFR-001 / AC-6 bounded DOM @ N≥1000 | Test Hooks | ❌ drifted | fallback diagram pane is **unbounded** — `layoutTierBands(tierStack)` has no ≤6/rollup cap and `window` is ignored by the core diagram fns (Findings 1+2); the live path is exactly this fallback (AC-1) |
| AC-3 no-regression / additive | Blast radius | ⚠️ partial | scoped to the 7 dependency-graph views + switcher; **omits the mosaic/composed-map consumers** of `GRAPH_VIEWS`/`GRAPH_VIEW_IDS` (Finding 4) |
| Non-Goal: no T4 composed-map graft | — | ⚠️ residual | registering into `GRAPH_VIEWS` auto-enrols `idef0` as a mosaic pane (Finding 4) |

## Findings

| # | Severity | Category | Location | Description | Recommended next step |
|---|---|---|---|---|---|
| 1 | HIGH | 📈 Scalability | RFC §Data Flow L53 + §Mode selection L96 + §"Geometry (tier-stack mode)" L130 vs `diagram.ts:110` (`computeTierStackDiagram`) | The **fallback** layout `layoutTierBands(tierStack: TierStackForest)` renders `tierStack.tiers[].members` **raw** — no ≤6/tier cap, no rollup, `window` ignored — so on the **live** real-data path (density ≈0.095 → tier-stack, PRD AC-1) the diagram pane materialises one box per artifact and blows the DOM at N≥1000, violating NFR-001/AC-6/RC-5. The core **already** emits a non-null, **bounded** (≤6/tier + rollup, `number`+`provenance` per box) tier-stack `diagram` via `computeTierStackDiagram`; the RFC bypasses it, which also re-derives band/numbering off `tierStack` (RC-3 reuse-not-fork drift). | RFC revision: lay out tier-stack mode from the core's non-null `diagram` (bounded + numbered), using `tierStack.tiers` **only** for band grouping — or record a T1 gap that `DiagramBox` needs a first-class `tier` field. Do NOT design the algorithm here; route the revision to the RFC author / `architect` if the core needs a field. |
| 2 | MEDIUM | 🔄 Data flow | RFC §"Geometry (idef0 mode)" L124 + §"The core call" L89-90 + §Test Hooks L234 vs `diagram.ts:56,110` (`_window` unused) | The rollup "+N more" **expand** affordance (SPEC-005 `roll-up beyond the per-page bound` / RC-5 / AC-2) and the "bounded via window" N≥1000 test hook both assume expanding re-invokes the core with `window` to page children 6..N. The shipped `computeIdef0Diagram`/`computeTierStackDiagram` **ignore** `window` (only `flattenOutline` honours it), so there is **no core-backed way** to reveal collapsed children — the view can only show a dead-end count or fork child-paging (RC-3 violation). | RFC revision: either (a) specify rollup as a non-expanding count (and drop the "re-invoke with window" claim), or (b) flag a T1 core gap — thread `window`/`childOffset` into `computeIdef0Diagram`. Same root cause as #1: `window` is wired only to the outline, not the diagram. |
| 3 | MEDIUM | 🔄 Data flow | RFC §"Idef0View props" L(props table, `selectedId` seeds focus) + §"Host adapter" L(edges only) vs `diagram.ts:66` (`forest.nodes.get(serialiseKey(focus))`) + `keys.ts:11` | The host passes `selectedId: string` (a bare id) and the RFC says it "seeds initial focus", but `focus` must be a `CompositeKey {id,title}` — the core resolves it via `serialiseKey(focus)=JSON.stringify([id,title])`, needing **both** fields. The adapter section only resolves **edge** endpoints (via `port()`), not focus seeding. On the id-collision case (same id, distinct title — the PROB-060 case this whole identity model exists for; SPEC-005 `V-COLLISION`) a bare id is **ambiguous**. | RFC revision: specify the `selectedId → CompositeKey` resolver (scan snapshot nodes; define collision tie-break) so focus seeding is deterministic and honest under V-COLLISION. |
| 4 | MEDIUM | 💥 Blast radius | RFC §Registration Plan + §"Blast radius" (claims "the only shared surface … is ui-prefs.ts … and one branch") vs `widgets/mosaic/ui/MosaicCanvas.svelte:44,65` + `widgets/mosaic/lib/persist.ts:37` | `GRAPH_VIEWS`/`GRAPH_VIEW_IDS` are consumed by a **second** widget — the mosaic/composed-map surface: `MosaicCanvas.nextAvailableView()`/`onAddPane()` iterate `GRAPH_VIEWS` and `persist.allViewsKnown` validates persisted panes against `GRAPH_VIEW_IDS`. Adding `idef0` **auto-enrols** it into the composed-map pane picker + layout persistence — a constrained viewport for the A3 two-pane layout — which the RFC's blast-radius analysis and no-regression gate (AC-3, scoped to the 7 dependency-graph views + switcher) never mention, and which is adjacent to PRD-034's **T4 composed-map Non-Goal**. | RFC revision: extend the blast-radius section + AC-3 test scope to cover the mosaic surface (idef0 renders correctly / degrades gracefully in a pane; persistence round-trips) OR explicitly gate idef0 out of the mosaic picker until T4. |
| 5 | LOW | 🧪 Testability | RFC §"Function Signatures / Idef0View props" vs §Registration Plan branch snippet + `DependencyGraph.svelte:155-167` | The documented `Idef0View` props contract omits `openedIds`/`kindFilter`/`statusFilter`, yet the registration branch (and every sibling view) receives them from the host. Tolerated by Svelte 5 `$props()` at runtime, but the component contract as written is narrower than the host binding it must satisfy — a drift that will confuse the implementer/tester. | RFC housekeeping: list the three host-forwarded props (accepted-and-ignored is fine) so the contract matches the branch it declares. |

## Blast radius

- **If this RFC is implemented as written and wrong, what fails?** Two failure surfaces. (a) The **fallback diagram pane** (Finding 1) — the DEFAULT rendering on the real dogfood workspace — renders unbounded boxes at scale, degrading/janking the primary user-visible path (not a data-loss failure; a performance + honesty-of-boundedness failure). (b) The **mosaic/composed-map** surface (Finding 4) inherits `idef0` untested; a broken A3 layout in a small pane would surface there without an AC-3 gate catching it.
- **Production scope:** read-only viewer only — **no** mutation, **no** `/api/*` change, **no** data migration (rule 22 upheld; verified the RFC adds no endpoint/spawn). Blast is confined to the browser render layer: the dependency-graph view host + the mosaic pane host. The seven existing views and the frozen core stay byte-untouched (additive registration).
- **Recovery path:** fully reversible — remove the `GRAPH_VIEWS` entry + `GraphView` union member + the one `DependencyGraph.svelte` branch + two new files. One-change revert, no migration (RFC Migration/Rollback section is accurate on this point).
- **Detection time:** Finding 1 would surface only under an N≥1000 fixture in the fallback path — which is exactly the AC-6 test the RFC defers on a TBD budget, so without the Finding-1 fix the gate that would catch it is itself unbounded. Recommend the tester's N≥1000 fixture assert **box count** boundedness in **tier-stack** mode explicitly (not only dense).

## Operability concerns

- **Observability:** N/A for a read-only client view; no logs/metrics/traces obligation. Not a gap.
- **Deploy / rollback:** reversible, additive, no schema/migration — clean.
- **Runbook:** none required (client view). No gap.
- **Capacity:** the one capacity lever (bounded DOM) is undermined in fallback by Finding 1 and cannot be validated by `window` per Finding 2 — the operability weak point is precisely the boundedness story, which is currently asserted but not achievable as designed.

## Positive observations

- Strong: the RFC binds to the **EXACT** frozen `deriveIdef0(raw, { threshold; focus?; window?; takenAt? }) → { input, forest, tierStack, verdict, diagram, outline, signature }` — verified field-for-field against `index.ts`; no positional-vs-options drift, no invented fields. This is the single most common cross-wave failure and the RFC nails it.
- Strong: honesty is architecturally correct — `verdict.mode` drives the render (RC-1, never upgrades a fallback), per-element `provenance` drives line-style, and the design explicitly keeps the **outline real/solid while the fallback diagram is derived/dashed** (the two-panes-different-honesty subtlety that matches how the core sources them). This is exactly ADR-007 P-5 rendered honestly.
- Strong: A2 (positioned DOM boxes + one SVG overlay reading a **single** `Idef0Layout`) is a genuinely good call — it eliminates DOM/SVG coordinate drift by construction and buys native a11y (FR-006) + rule-24 primitive composition that pure-SVG (A1) could not. The dense-mode reuse-not-fork guard (every number/side/provenance traces to a core field, ≤6+rollup bounded) is clean.
- Strong: the host-integration facts are grounded, not guessed — branch placement (after `sunburst`, before `{:else}` LanesView), `resetZoom()`/`bind:this={inner}` contract, `motionDuration`, and the single-`GraphView`-union claim all check out against the real files.

## Residual risks

- `contradicts ⇒ Control` visual-cycle risk (ADR-007 named residual) is carried into the RFC's risk table but only lightly test-hooked; the tester should assert a contradicts-loop reads as a caveat, not an altitude break.
- The N≥1000 interaction-latency **budget** remains TBD (correctly deferred to profiling) — Finding 1 must be fixed **before** that profiling is meaningful, else the fallback path profiles an unbounded DOM.
- Dense mode is fixture-only on today's data (density 0.095) — the RFC is honest about this (AC-2 fixture vs AC-1 live), so not a finding, but the dense path's real-data validation is genuinely gated on T3.
- `madge` circular-dependency scan was not runnable (tool absent) — no automated confirmation that `widgets/dependency-graph/lib/idef0-layout.ts` importing `shared/lib/idef0` introduces no FSD cycle; low risk (shared→widget is the sanctioned FSD direction) but unverified by tool.

## Recommended next steps

- [→ orchestrator] **CONCERNS — do not activate RFC-029 as written.** Proceed only after Findings 1 & 2 are closed (they define whether the boundedness/reuse story the PRD depends on is actually achievable). Findings 3 & 4 are activation-blocking-lite: require an RFC revision but not a redesign.
- [→ RFC author / architect] Revise the RFC to render tier-stack mode from the core's non-null `diagram` (Finding 1) and reconcile the rollup/`window` mechanism with the shipped core (Finding 2). If either requires a new core field (`DiagramBox.tier`; `window` threaded into `computeIdef0Diagram`), that is a **T1 core follow-up** — dispatch `architect`/`adr-architect`, do not patch it in the T2 view.
- [→ tester] When Findings 1–2 land: assert **box-count boundedness in tier-stack mode** (not only dense) under the N≥1000 fixture, and a V-COLLISION focus-seeding case (Finding 3).
- [→ coder] Do not begin `idef0-layout.ts` until the tier-stack layout source (raw `tierStack` vs core `diagram`) is settled — building against the current RFC would bake in the unbounded path.

## References

- RFC under review: `RFC-029`
- Parent PRD: `PRD-034`; render contract: `SPEC-005`; core: `RFC-028`; framing: `ADR-007` (+ `ADR-006`)
- Core source cross-checked: `template/src/shared/lib/idef0/{index,types,diagram,outline,relation,keys}.ts`
- Integration source cross-checked: `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte`, `template/src/shared/config/ui-prefs.ts`, `template/src/widgets/mosaic/ui/MosaicCanvas.svelte`, `template/src/widgets/mosaic/lib/persist.ts`, `template/src/widgets/dependency-graph/lib/reduced-motion.ts`
- Mental models consulted: `mm-gate-failures` requested — **absent from this bank** (unavailable, not fabricated)



