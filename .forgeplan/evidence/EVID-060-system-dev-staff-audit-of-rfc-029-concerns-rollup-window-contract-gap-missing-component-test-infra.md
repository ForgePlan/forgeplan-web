---
depth: standard
id: EVID-060
kind: evidence
last_modified_at: 2026-07-01T18:20:30.354454+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-029
  relation: informs
status: active
title: 'System-dev staff audit of RFC-029: CONCERNS — rollup/window contract gap + missing component-test infra'
---

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

<!-- CL3: audited directly against the frozen T1 core source in the same repo/branch
     (template/src/shared/lib/idef0/*.ts) + the real integration files, not against
     prose. `weakens` reflects that two load-bearing RFC claims (rollup-via-window;
     the no-regression/a11y test surface) have ground-truth-confirmed gaps that must
     be corrected/budgeted before activation — NOT that the design direction is wrong
     (it is sound, additive, reversible, and correctly bound). See §Verdict. -->

## Verdict

**CONCERNS**

- No CRITICAL/BLOCKER: the architecture (A2 hybrid DOM+SVG, B3 drill, a pure host-owned
  `idef0-layout.ts`, a pure consumer of the frozen core) is the right shape; blast radius
  is minimal and one-change-reversible; the core-contract binding is EXACT; the honesty /
  reuse-not-fork story is faithfully mapped to real core fields.
- Two HIGH/MEDIUM-HIGH system-level gaps must be acknowledged + mitigated before the build
  lands. Both are correctable at RFC-revision / accept-with-mitigation level — no redesign.

One-line justification: RFC-029 is correctly bound to the frozen `deriveIdef0` contract and
is genuinely additive/reversible, but (a) its rollup-expansion mechanism ("re-invoke the core
with `window`") is unimplementable against the shipped core — `computeIdef0Diagram` ignores
`window` and `capChildren` has no child offset — and (b) ~6 of its ~10 conformance hooks
(a11y keyboard, 7-view no-regression, theme, reduced-motion, provenance-in-DOM) rest on
component-test infrastructure that does not exist in the repo and is not budgeted as new work.

## Ground-truth verification

- Base..head: not provided as SHA pair; resolved head = `4b03b46b04e322bcb88dfb55f5b51bdaaa0f582c` on `feat/idef0-view-t2`. This is a **design-artifact gate** (RFC authored; no implementation code expected yet — Phases 1-5 pending).
- Diff probe: `git -C <root> status --porcelain -- .forgeplan/rfcs/RFC-029-*.md`
- Diff state: **DELTA=PRESENT** — RFC-029 markdown is a new untracked artifact (`?? .forgeplan/rfcs/RFC-029-idef0-view-first-host-renderer-over-the-tadd-core.md`).
- Expected delta token: `deriveIdef0(raw` (the RFC MUST bind the frozen options-object signature).
- Token probe: `grep -nE "deriveIdef0\(raw" RFC-029.md` → **FOUND** (lines 24, 47, 51, 83).
- Verdict floor from ground-truth gate: **PASS-eligible** (change landed; binding present). System verdict is set by the findings below, not by the ground-truth gate.

Verbatim probe output:
```
?? .forgeplan/rfcs/RFC-029-idef0-view-first-host-renderer-over-the-tadd-core.md
83:deriveIdef0(raw: RawSnapshot,
```
Binding cross-check against the real barrel `template/src/shared/lib/idef0/index.ts` (lines 38-89):
`DeriveOptions = { threshold; focus?; window?; takenAt? }` and
`DeriveResult = { input, forest, tierStack, verdict, diagram, outline, signature }` — **EXACT match** to the RFC's bound signature (RFC §"The core call", lines 83-86). No contract drift on the signature.

## Artifact under review

- ID: `RFC-029`
- Kind: `rfc` (standard depth)
- Title: idef0 view — first host renderer over the TADD core
- Parent: `PRD-034` (`based_on`); also `based_on RFC-028` (the frozen core it consumes)
- Architectural fitness (prior architect-reviewer EVID): **not located in the graph at audit time.** The RFC-029 claim is held by `claude-code/opus-4.8/architect-reviewer-task-t2-idef0-view` (TTL to 18:59Z), but no architect-reviewer EVID linked to RFC-029 was found. This system-dev audit is the system-wide/long-horizon layer; it does not re-litigate a single-RFC fitness check. If an architect-reviewer EVID lands, guardian should collate both.

## System-wide scope inspected

- **Related artifacts inspected:** `PRD-034` (driving PRD, FR-001..011 / AC-1..7 + ADI H1), `SPEC-005` (render conformance contract, RC-1..8 + 12 scenarios), `ADR-007` (ICOM projection framing + local relation table + P-5 honesty scoping), `RFC-028` (frozen core — read via shipped source, artifact body exceeded token budget).
- **Codebase areas ground-truthed (read, not guessed):**
  - `template/src/shared/lib/idef0/index.ts` — `deriveIdef0` / `DeriveOptions` / `DeriveResult` (exact-binding check).
  - `template/src/shared/lib/idef0/types.ts` — `DiagramBox` / `DiagramArrow` / `Idef0Diagram` / `DensityVerdict` / `OutlineRow` (no `role` field on DiagramBox — see F-4).
  - `template/src/shared/lib/idef0/diagram.ts` — `computeIdef0Diagram` + `capChildren` + `computeTierStackDiagram` (the rollup + window + arrow-inclusion ground truth — F-1, F-3).
  - `template/src/shared/lib/idef0/relation.ts` — `classifyIcom` + `icomToSide` (I=left/C=top/O=right/M=bottom confirmed).
  - `template/src/shared/lib/idef0/outline.ts` — `flattenOutline` DOES honor `window` (the only windowed path — contrast with the diagram).
  - `template/src/shared/config/ui-prefs.ts` — 7 registered `GRAPH_VIEWS`, `GraphView` union, auto-derived `GRAPH_VIEW_IDS` (registration-claim check — accurate).
  - `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` — host branch chain (insertion point after `sunburst`, before final `{:else}`=LanesView — confirmed).
  - `template/src/widgets/dependency-graph/lib/regression.test.ts` — actual content = cluster/ring-radius unit test (NOT a 7-view snapshot harness — F-2).
  - `template/src/widgets/dependency-graph/lib/{tree,sankey,sunburst}-layout.ts` — 3 pure host-owned layout-lib precedents (maintainability positive).
  - `template/vitest.config.ts` + `template/package.json` — `environment: "node"`, `happy-dom` present but no `@testing-library/svelte`, zero component-render tests (F-2).
- **Recent incidents recalled (Hindsight):** the 9th-view 3-place registration + "must not take the reserved `map` slot" rule (world memory); FSD placement (`widgets/dependency-graph`, no widget→widget import); macOS fork-limit → vitest `pool:'threads'` convention (build-gotcha). No prior "added-a-view regression" incident on record.
- **Out of scope:** T3 spine authoring / real dense data (density ≈0.095 today → live path is the tier-stack fallback); T4 composed-map; the numeric N≥1000 frame budget (explicitly TBD, owned by RFC-028 Q4 — correctly deferred by the RFC, do not invent).

## Methodology

| Step | Detail |
|---|---|
| System-level categories applied | Contract impact, Test surface gap, Blast radius, Missed edge cases, Long-term maintainability |
| Horizon checked | 6-month minimum (see §Long-term maintainability) |
| Related artifacts traversed | 4 (PRD-034, SPEC-005, ADR-007, RFC-028) + parent EPIC context |
| Prior incidents recalled | 9 Hindsight memories (registration rule, FSD, fork-limit, snapshot error surfacing) |
| System-scope analysers run | see table |

### System-scope analysers

| Tool | Command | Status | Exit | Summary |
|---|---|---|---|---|
| git status | `git status --porcelain -- .forgeplan/` | executed | 0 | RFC-029 new; PRD-034/RFC-028 modified (SHAPE gate) |
| grep (binding) | `grep -nE "deriveIdef0\(raw" RFC-029.md` | executed | 0 | signature bound at 4 sites; exact match to index.ts |
| grep (`_window`) | `grep -nE "_window\|window" diagram.ts` | executed | 0 | `_window` appears only in 2 signatures; unused in bodies |
| node (deps) | `node -e` over template/package.json | executed | 0 | happy-dom present; NO @testing-library/svelte; vitest env=node |
| grep (component tests) | `grep -rIl "@testing-library/svelte" src` | executed | 0 | 0 files — no component-render test precedent |
| ls (layout precedent) | `ls src/widgets/dependency-graph/lib/*-layout.ts` | executed | 0 | 3 pure layout libs (tree/sankey/sunburst) — good precedent |
| Read (integration) | idef0 core + host + ui-prefs + relation + outline | executed | 0 | 8 real files read for ground truth |

No analyser skipped for absence; all commands ran.

## Staff-level findings

Ranked by severity. Each is a system-level concern to surface — not an alternative design.

### Contract impact (📜)

| # | Severity | Location | Description | Recommended next step |
|---|---|---|---|---|
| C-1 | HIGH | RFC §"ICOM Layout" line 124 + §"Test Hooks" line 234 vs `diagram.ts:32-47,56-102` | The RFC's rollup mechanism — "expanding it re-invokes the core with `window`, never a client-side slice (RC-5)" — is **not implementable against the frozen core**. `computeIdef0Diagram(forest, edges, focus, _window?)` **ignores** `window` (the param is underscore-prefixed and never referenced in the body); `capChildren` slices `keys.slice(0, MAX_BOXES-1)` = first 5 children + ONE terminal `"+N more"` rollup box with **no offset**. Re-invoking `deriveIdef0` with any `window` returns the byte-identical 5-box diagram. Children 6..N are unreachable by any core call; the rollup box carries a synthetic key `{id:"__rollup__"}` so focusing it (drill) falls back to roots. Only `flattenOutline` honors `window` (outline pane). SPEC-005 `V-ROLLUP` / RC-5 ("expanding never exceeds the bound") and PRD AC-2's roll-up-when-exceeded therefore cannot be satisfied via the RFC's stated mechanism. | Recommend RFC revision: state the rollup is display-only ("+N more", terminal) against the frozen core, OR record that per-page child paging needs a windowed `computeIdef0Diagram` in the core (frozen → a new RFC/ADR, out of T2 scope). Either way the tester must not author a `V-ROLLUP` "expand-and-page" test against a non-existent path. |

### Test surface gap (🧪)

| # | Severity | Location | Description | Recommended next step |
|---|---|---|---|---|
| T-1 | MEDIUM-HIGH | RFC §"Test Strategy Hooks" lines 222-236 vs `vitest.config.ts:10` + `package.json` | No component-render test infrastructure exists: vitest `environment: "node"`, `@testing-library/svelte` is **not** a dependency (only `happy-dom` is installed, unused by default), and **zero** existing tests render a Svelte component. ~6 of the ~10 hooks are inherently DOM: keyboard-only tab-order walkthrough (RC-8), 7-view no-regression snapshot (RC-6/AC-3), dual-theme toggle legibility (RC-7), `matchMedia` reduced-motion (RC-8), provenance⇒line-style **DOM** class assertion (RC-2), switcher "no CSS overflow" (AC-3). These require net-new harness (add `@testing-library/svelte`, per-file `@vitest-environment happy-dom`, and honor the macOS fork-limit `pool:'threads'` convention), which the RFC does not budget as work. The pure-layout hooks (ICOM sides, rollup shape, determinism, provenance-on-the-layout-object) ARE well-supported in node env and match the 3 layout-lib precedents — Phase 1 is sound; Phases 3-4 rest on absent infra. | Recommend the RFC add an explicit "component-test harness" line item (dep + env-pragma + threads pool) as a Phase-3/4 prerequisite, OR scope AC-3/AC-7 assertions to the layout boundary where node-env tests suffice and mark the DOM-only assertions as harness-blocked. Do not merge Phase 4 assuming existing infra. |
| T-2 | MEDIUM | RFC §"Test Hooks" line 232 | The cited precedent — "the existing `widgets/dependency-graph/lib/regression.test.ts` style — snapshot each of the seven views" — is inaccurate: that file (read) is a `detectClusters`/ring-radius **unit** test for RadialView math; it renders no view and touches no switcher registry. AC-3's no-regression scenario has no existing harness to copy. | Fold into T-1: budget the 7-view render/switcher-overflow check as new work; do not present it as reuse of an existing pattern. |

### Missed edge cases (🎯)

| # | Severity | Scenario | Recommended next step |
|---|---|---|---|
| E-1 | MEDIUM | `computeIdef0Diagram` (diagram.ts:78-87) includes an arrow when **either** endpoint is in the level (`inLevel.has(from) \|\| inLevel.has(to)`) — `inLevel` = focus **plus all child boxes**. So the dense diagram emits arrows incident to **child** boxes (incl. sibling↔sibling edges), not only "the focus's non-tree arrows" as SPEC-005's dense scenario and the RFC test hook (line 226: "input arrows have `x1 < focusBox.x` …") assume. A `based_on` edge between two children is an input arrow whose anchor is a child, where `x1 < focusBox.x` need not hold. The RFC's layout body (line 125) DOES resolve a per-arrow anchor box, but the test hook conflates anchor with focus. | Recommend the RFC/tester specify arrow-side assertions **relative to each arrow's anchor box** (not the focus box), and have the layout deterministically handle child-incident and off-page-endpoint arrows (anchor fallback to the focus/context boundary is stated; make the child-anchor case explicit). |
| E-2 | LOW | The rollup box synthetic key `{id:"__rollup__", title}` and any off-page arrow endpoint are drill/focus hazards: a keyboard user activating the rollup (B3 drill) would set `focus` to a non-node key → core returns the root level → a jarring jump to the top. | Recommend the RFC's B3 interaction explicitly exclude `kind==="rollup"` boxes (and off-page anchors) from being drill/focus targets; assert it in the keyboard hook. |

### Long-term maintainability (📈)

| # | Severity | Location | Description | Recommended next step |
|---|---|---|---|---|
| M-1 | LOW-MEDIUM | RFC §"Signatures" lines 109-115 vs `types.ts:126-134` | The RFC's `PlacedBox.role: "focus"\|"child"\|"band-member"` is inferred from **array position** (the core pushes the focus box at index 0 in `computeIdef0Diagram`, then sorted children). The core `DiagramBox` has **no** `role`/`isFocus` field, and "focus is boxes[0]" is not a named frozen invariant (INV-8 covers child/arrow sort order, not focus-first placement). A future core refactor that canonically re-sorts all boxes would silently mis-role the layout with no type error. | 6-month watch item: recommend the layout derive focus by matching `diagram.focus` against `box.key` (an explicit field that DOES exist on `Idef0Diagram`) rather than positional index-0 — a small robustness change, not a redesign. |

**6-month horizon (HARD RULE 3):** the layout lib itself is LOW-risk — it follows 3 established pure `*-layout.ts` + co-located `.test.ts` precedents, is deterministic/headless, and is cleanly TDD-able (RFC Phase 1 is the strongest part of the plan). The genuine 6-month complexity sink is the **ICOM arrow routing** (anchor resolution + even-slot distribution + off-page fallback + `contradicts`-loop caveat from ADR-007's named residual + child-incident arrows from E-1). If that logic accretes special cases, `idef0-layout.ts` becomes the module a future contributor fears. Naming E-1's child/off-page anchoring precisely now, and keeping arrow routing pure + fixture-tested, is what keeps it from becoming the next legacy load-bearing module.

### Contract/blast — positives recorded honestly

- Core-contract binding is **exact** (index.ts) — no drift; the RFC correctly does not push geometry back into the headless core (SPEC-004 FR-007 honored).
- Honesty model is faithfully mapped to real fields: `verdict.mode` switch (index.ts:83-86), per-element `provenance` (types.ts:26, diagram.ts), outline-real vs diagram-derived split (outline reads the real forest; tier-stack diagram is all-`derived`). RFC's RC-1/RC-2 rendering obligations are grounded.
- Empty / single-node / all-`informs` graphs route through core normalisation without throw (empty forest → `{boxes:[], arrows:[], legend, focus:null}`; all-`informs` → no `refines` → sparse → honest tier-stack fallback). RFC's V-EMPTY handling is achievable.

## Blast radius

**Mandatory section.**

- **Affected scope:** the ONLY shared surfaces touched are `template/src/shared/config/ui-prefs.ts` (the `GraphView` union + `GRAPH_VIEWS` array consumed by all views; `GRAPH_VIEW_IDS` auto-derives — verified 2 literal edits) and one `{:else if view==='idef0'}` branch in `DependencyGraph.svelte` (insertion point after the `sunburst` branch, before the final `{:else}`=LanesView — **verified against the real host**). The frozen core (`shared/lib/idef0/*`) and the seven existing view components are symbol-untouched; ADR-007's blast-radius guard (local `idef0-relation.ts`, never mutating shared `HIERARCHY_RELATIONS`/`normaliseHierarchyEdge`) is already shipped and holds. Two new files (`Idef0View.svelte`, `idef0-layout.ts` + test) are net-additive.
- **Reversibility:** one-change, low-cost revert — remove the 2 `ui-prefs.ts` edits + the 1 host branch + the 2 new files → exact seven-view state. No `/api/*` change, no data migration, no core change (rule 22 read-only preserved). **Reversible in minutes.**
- **Downstream artifacts:** none re-baselined. The reserved `map`/composed slot (T4) is not consumed (RFC uses a distinct `idef0` id — verified against the registration rule in memory). PRD-034/SPEC-005/ADR-007 are the informing set, not dependents.
- **Detection time if wrong:** the real regression vector is the shared `GraphView`/switcher — a broken registration surfaces immediately at first render (view switcher / dev build). But the guard (AC-3) is heavier to build than the RFC implies (T-1/T-2), so a *silent visual* regression could ship untested until a human notices.
- **Customer-visible impact if wrong:** bounded — worst case the switcher overflows or one existing view mis-renders; the read-only viewer never mutates the workspace, so no data-integrity blast. This is a viewer feature, not a write path.

## Recommended action

**CONCERNS — add mitigation before gate.** Recommend guardian gate RFC-029 only after: (1) the RFC corrects the C-1 rollup/window claim (display-only rollup against the frozen core, or an explicit out-of-scope note that diagram windowing needs a core change); and (2) the RFC budgets the component-test harness (T-1/T-2) as explicit Phase-3/4 work OR scopes AC-3/AC-7 DOM assertions to the layout boundary. E-1 (arrow anchoring relative to the anchor box, not focus) should be folded into the layout spec + tester mapping. E-2/M-1 are low-cost robustness notes. If guardian prefers, these can be tracked as accept-with-mitigation follow-up SPEC/RFC-revision items rather than blocking — none require an `architect` redesign; the design direction (A2 + B3 + pure layout lib + pure core consumer) is sound.

## Residual risks

- The N≥1000 interactive frame budget is **TBD** (RFC-028 Q4) and correctly deferred by the RFC — capacity is asserted structurally (bounded DOM: ≤6+rollup diagram + windowed outline) but not yet measured; the outline path IS genuinely windowed (`flattenOutline`), the diagram is bounded by `MAX_BOXES` regardless of window, so the O(1)-DOM claim holds even though the diagram ignores `window`. Left to the Phase-5 EVIDENCE measurement.
- Claim hygiene: RFC-029 carries a live claim by `claude-code/opus-4.8/architect-reviewer-task-t2-idef0-view` (TTL 18:59Z). This system-dev audit did **not** force-release a peer's claim (not the orchestrator's escape hatch to use). If that architect-reviewer has finished/crashed, the orchestrator should sweep the claim (`forgeplan_release RFC-029 --force`) per rule 12; if still running, guardian should collate its EVID with this one. This EVID does not hold a claim on RFC-029 and mutates nothing.
- Dense-mode is fixture-only on today's data (density ≈0.095 < 0.3) — the live path is the tier-stack fallback; the dense ICOM path (and its arrow-anchoring edge cases, E-1) is exercised only by the synthetic DENSE fixture until T3 spine authoring. A reviewer must not over-claim dense capability from a green fixture.

## References

- Artifact under review: `RFC-029`
- Parent PRD: `PRD-034` · Render contract: `SPEC-005` · Framing: `ADR-007` · Core: `RFC-028`
- Ground-truth source read: `template/src/shared/lib/idef0/{index,types,diagram,relation,outline}.ts`, `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte`, `template/src/widgets/dependency-graph/lib/regression.test.ts`, `template/src/shared/config/ui-prefs.ts`, `template/vitest.config.ts`, `template/package.json`
- Recent incident history (Hindsight): 9th-view 3-place registration rule; FSD widget-placement; macOS fork-limit → `pool:'threads'`
- Mental models consulted: `mm-gate-failures` requested — bank has **no** mental-model pages yet (`mental_model_list` → empty); fell back to `memory_recall`.


