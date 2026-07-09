---
depth: standard
id: EVID-078
kind: evidence
last_modified_at: 2026-07-02T13:32:48.820240+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-030
  relation: informs
status: active
title: 'Architecture review of RFC-030: CONCERNS — 1 MEDIUM data-flow (empty-vs-invalid discriminant hides schema-tag errors), 2 LOW'
---

# EVID-078: Architecture review of RFC-030 (T4 Phase-1 composed-map render-proof)

## Verdict

**CONCERNS**

One-line justification: RFC-030 covers all five PRD-036 Phase-1 ACs and five of six SPEC-006 scenarios, with every load-bearing integration claim verified against real code (registry count, fallback branch position, `GraphEdge` byte-shape, 10 s poller default, `workspaceRoot()`, mosaic auto-enrol) — but its SPEC-Q1 resolution places a strict-equality schema-tag discriminant BEFORE validation, making the SPEC E2 schema-tag error rule unreachable through the view path: a present-but-wrong-tag document silently renders "no map yet" instead of a structured error, contradicting the honest-degradation contract (PRD Goal 4 / FR-005, SPEC malformed-json scenario). Fixable in the RFC body; no redesign needed.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit

## Ground-truth verification

- Base..head: artifact files are uncommitted working-tree additions on `feat/idef0-composed-map` (HEAD `6f85604`); no committed base..head range applies — the claimed delta is the three artifact files themselves.
- Diff probe: `git -C /Users/explosovebit/Work/ForgePlanWeb status --porcelain .forgeplan/` → shows `?? .forgeplan/prds/PRD-036-...md`, `?? .forgeplan/specs/SPEC-006-...md`, `?? .forgeplan/rfcs/RFC-030-...md` (plus sibling-wave `?? ADR-008-...md`). File sizes 19 920 / 30 936 / 31 420 bytes. **DELTA=PRESENT**
- Expected delta token: `computeComposedLayout` (from the SHAPE claim) → `grep -c` over the RFC-030 markdown → **8 hits, FOUND**. Secondary token: `isMapDocument` discriminant definition at RFC md line 92 → FOUND.
- Verdict floor from ground-truth gate: PASS-eligible (delta present, tokens found). Findings below are design-fitness, not claim-vs-reality.
- Partial: the `based_on` links claimed in the SHAPE reports could not be independently confirmed from the CLI (`forgeplan get --json` on CLI 0.33 omits link fields, a known gap); all three bodies' Related Artifacts sections are mutually consistent with the claim. EVID-078's own `informs → RFC-030` link was created atomically at `forgeplan_new` time (`auto_linked: RFC-030`).

## Scope

### RFC under review
- RFC-030 — all sections (Summary, Motivation, Options + SD-1..SD-3, Proposed Direction, Governance, Invariants, Implementation Phases 1–5, Risks, Test Strategy Hooks, Rollback, Open Questions).

### Parents (source of truth for acceptance)
- PRD-036 — AC-1..AC-5, FR-001..FR-009, Non-Goals, NFR-001..005, Q1/Q2/Q3/Q5.
- SPEC-006 — C1–C6, E1–E3 taxonomy, Scenarios 1–6, AC-1..AC-5, Q1–Q3.

### Source / spec inspected (all verified this review, not taken from the RFC's own claims)
- `docs/PROJECT-MAP-SPEC.md` §5, §8, §9, §10, §15, §16, §18, §19, §20, §22, §23.
- `template/src/shared/config/ui-prefs.ts` — `GRAPH_VIEWS` = 8 entries incl. `idef0` → `map` = 9th: **CONFIRMED**.
- `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` — 7 explicit view branches + `{:else}` LanesView fallback at line 182 (RFC's structural invariant AND its "currently line 182" reference both correct): **CONFIRMED**.
- `template/src/entities/graph/model/types.ts` — `GraphEdge { from, to, relation }` byte-exact (SPEC C2 narrowing target): **CONFIRMED**.
- `template/src/shared/api/poller.svelte.ts` — `POLL_INTERVAL_MS = 10_000` (grounds the RFC's SPEC-Q2 resolution): **CONFIRMED**.
- `template/src/shared/server/forgeplan.ts` — `workspaceRoot()` (line 201), `FORGEPLAN_CWD` → config → fallback chain: **CONFIRMED**.
- `template/src/widgets/mosaic/ui/MosaicCanvas.svelte` (`nextAvailableView()` iterates `GRAPH_VIEWS`) + `lib/persist.ts` (`allViewsKnown`, whose layout-migration marker documents a full layout reset on unknown ids) — mosaic auto-enrol blast radius and the RFC's rollback claim: **CONFIRMED** (note: rollback resets the WHOLE persisted mosaic layout, not just map panes — consistent with the RFC-029 analysis the RFC cites, phrasing slightly generous).
- `template/src/routes/api/` — `/api/map` does not exist yet (design-only arc): expected.

### Not reviewed (out of scope)
- Spike HTML sources; `forgeplan-map-pack` (external repo, Phase 2+); ADR-008 body (Phase-4 write amendment, human-gated, deliberately untouched by this RFC); d3-zoom implementation (no code exists yet).

## Methodology

| Step | Detail |
|---|---|
| Fitness categories applied | Modular boundary / Coupling / Data flow / Blast radius / Operability / Scalability / Testability |
| Parent-PRD cross-check | Full AC + scenario mapping (table below) — the spine of this review |
| Recalled priors | `memory_recall` (13 hits: 3-place registration + branch-before-fallback invariant [prior T2 lesson], rule-22 read-only posture, RENDER-PROOF phase shape, reviewer claim-hygiene). `mm-gate-failures` mental model UNAVAILABLE — `mental_model_list` returns an empty bank (consistent with stages 1–3 of this wave); no fabricated substitute used |
| Static analysers | table below |

### Static analysers

| Tool | Command | Status | Summary |
|---|---|---|---|
| cloc | `cloc --json shared/config entities/graph widgets/mosaic` | executed | 19 files / 1 505 LOC — the integration surface is small; additive registration is low-mass |
| madge | — | skipped (not installed) | circular-dep check unavailable; moot for a design-only diff |
| licensee | — | skipped (not installed) | no dependency change proposed |
| npm ls | — | skipped (not applicable) | RFC-030 introduces zero new runtime deps by design |
| rule-22 greps | `ls template/src/routes/api/` | executed | `/api/map` absent — nothing to grep yet; the RFC's AC wires the greps into Implementation Phase 2 |

## Parent-PRD fit

| PRD-036 AC | RFC section | Coverage | Note |
|---|---|---|---|
| AC-1 (render + EN + neutral chrome) | Module Breakdown, ZoneSlab/NodeCard contracts, Impl Phases 4–5 | ✅ covered | §15/§16 faithfully restated; token-only invariant #7 |
| AC-2 (endpoint honesty + rule-22 greps) | `readMapFile()` contract, Impl Phase 2 gate | ✅ covered | server side sound; the CLIENT-side honesty edge is Finding 1 |
| AC-3 (8 views intact) | Additive registration, Invariant 6, mosaic no-regression tests | ✅ covered | RFC extends AC-3 beyond its literal text to the mosaic auto-enrol surface — correct, verified against `MosaicCanvas.svelte` |
| AC-4 (layout determinism tests) | C3 restated, Impl Phase 3 suite | ✅ covered | append-stability split (non-wrapping byte-identical / wrapping translate-only) matches §9/§19 exactly |
| AC-5 (svelte-check + vitest green) | Impl Phase 4 gate | ✅ covered | |

SPEC-006 scenarios: render-proof ✅ · empty-workspace ✅ · 9-views-no-regression ✅ · EN+neutral-chrome ✅ · pure-layout determinism ✅ · **malformed-json ⚠️ PARTIAL** — unparseable-JSON and dangling-reference branches covered; the wrong-schema-tag branch is broken by Finding 1.

Open-question audit: PRD Q1/Q2/Q3/Q5 and SPEC Q1/Q2/Q3 all resolved in the RFC. Q2 (10 s shared default) and the registry count ("9th") verified against code — both correct; the "no invented number" Q3 posture honors PRD NFR-004's TBD honestly. SPEC Q1's resolution is where Finding 1 lives.

## Findings

| # | Severity | Category | Location | Description | Recommended next step |
|---|---|---|---|---|---|
| 1 | MEDIUM | 🔄 Data flow | RFC-030 §Function Signatures (`entities/map/lib/is-map-document.ts`, md line 92) + §Data Flow failure paths A/B | The discriminant `data.schema === "forgeplan.map/v1"` runs BEFORE `validateMapDocument`, and everything failing it renders the empty state. A file that EXISTS but carries a wrong/missing schema tag (curator typo, future v2 emitter) therefore silently shows "no map yet" — SPEC E2 row 1 (`expected 'forgeplan.map/v1', got …` error) and the malformed-json scenario's schema-violation branch become unreachable through the view; the AC-1 validator fixture still passes in CI (it calls the validator directly), so the gap is invisible to tests as specified — vacuous green. Contradicts PRD Goal 4 / FR-005 honest degradation for that input class | RFC body amendment before Impl Phase 4: the empty-state discriminant must distinguish "endpoint returned the empty envelope `{}`" from "document present"; every non-empty payload must reach `validateMapDocument` so the schema-tag rule fires (SPEC Q1's own `"schema" in data` presence phrasing does this; the exact mechanism is the author's). Add a render-harness case: wrong-tag file → error surface, NOT empty state |
| 2 | LOW | 🏗 Modular boundary | RFC-030 §Module Breakdown + §Function Signatures vs SPEC-006 Scenario 1 / C1 flows | Flow chips + flow dim/highlight are ship-or-not (SPEC Scenario 1: "every … flow chip … renders"; C1: "Phase 1 renders flow chips + dim/highlight"; PRD FR-001 names them), and the RFC's happy path lists them in the render — but no component owns them (`ui/` list is ComposedMapView/ZoneSlab/NodeCard/EdgeLayer; §8 sketches a separate `FlowChips.svelte`) and `ComposedLayout` carries no flow geometry. `EdgeLayer.highlightedIds?` hints at the highlight half only | Name the flow-chip owner (component + where chip geometry/anchoring comes from) in the build-wave plan so the Phase-4 render test has a DOM contract target |
| 3 | LOW | 🧪 Testability | RFC-030 §Decisions (PRD Q1 resolution) + Risks (d3-zoom row) | §15 marks its nav set "first-class requirements, NOT optional polish": Esc/click-empty → reset, drag>3 px click-suppression, plain-wheel PANS while Ctrl/⌘-wheel zooms. The RFC pins the interaction scope to "pan + Ctrl/⌘-wheel zoom + fit-on-first-load" and stages out flows/drift/panel — but the remaining §15 nav items are neither pinned in nor explicitly staged out. d3-zoom's DEFAULT wheel behaviour is zoom, which would contradict §15's explicit user decision if the build wave ships defaults | One sentence in the build-wave scope: enumerate which §15 nav behaviours ship at checkpoint vs fast-follow, and note the d3-zoom wheel filter as budgeted work (the RFC already names d3-zoom as "real budgeted work") |

Findings considered and DROPPED at the pre-report gate (recorded so they are not re-litigated): "8th `{:else if}`" counting nit (structural invariant is what matters and is correct); hand-rolled `validate.ts` vs §20's single shared ajv schema (already justified — SPEC out-of-scope + RFC OQ-2); committed-vs-gitignored `map.json` (already a named risk + OQ-1); §22 `store`/`ext` fill treatments reduced to border-only (SPEC C1 already resolves non-decision kinds → neutral border); `EntryAnchor` omission (not in any PRD Phase-1 FR/AC — consistent staging); rollback phrasing on persisted mosaic layouts (behaviour matches `persist.ts`; precedented analysis cited).

## Blast radius

- **If this RFC is implemented and wrong, what fails?** Only the new `map` view and `/api/map`. Registration is additive; `entities/graph` and the 8 existing view components are byte-untouched (Invariant 6). The worst SILENT failure mode — the dispatch branch landing after the `{:else}` so map renders Lanes — is named and covered by a dedicated no-regression test. Second-order surface: the mosaic pane picker gains `map` automatically (verified consumer), so a broken map view can render broken inside one mosaic pane; other panes and views are unaffected.
- **Production scope:** local read-only viewer; zero forgeplan workspace mutation; zero write surface added (every new route is GET-only readFile). No forgeplan spawn path touched.
- **Recovery path:** single revert removes registry entry + branch + all new files + css tokens + checkpoint + the rule-22 read-only amendment (same commit, so rule text never outruns code). Persisted mosaic layouts containing `map` reset to default on rollback (`allViewsKnown` guard) — data-loss limited to pane arrangement.
- **Detection time:** CI (render-harness + registry no-regression + endpoint contract tests) at PR time; manual 8-view smoke at checkpoint. Finding 1's failure mode is the one gap CI-as-specified would NOT catch — its fix includes the missing test case.

## Operability concerns

- **Observability:** adequate for a client-rendered view — structured validation errors surfaced in-UI; endpoint errors carried in the envelope. No server logging specified for `readMapFile` failures (acceptable at this scale; consistent with sibling endpoints).
- **Deploy / rollback:** additive, reversible, no migration, no data. Rule-22 amendment reverts with the code.
- **Runbook:** N/A (local tool); the "no map yet" empty state doubles as the user-facing affordance.
- **Capacity:** Phase-1 checkpoint ≤ ~20 nodes; perf number deliberately deferred to a CL3 measurement at checkpoint (honest — no invented budget); §23 mega-node collapse named as the Phase-2 lever.

## Positive observations

- **Verified-in-code integration section**: the RFC re-derived the registry count (8 → map is 9th) against the real `ui-prefs.ts`, correcting BOTH the task hint and the spec's stale line numbers, and stated the dispatch invariant structurally (before the fallback) rather than by line — this review re-verified every one of those claims and all held, including the "currently line 182" reference. This is the standard integration sections should meet.
- **Governance posture**: the RFC caught that even a READ-ONLY non-forgeplan endpoint requires a rule-22 allow-list amendment (the task framing's "Phase 1 fully compliant" was looser), scheduled the amendment same-PR with the endpoint mirroring the `/api/instances` precedent, and kept it categorically separate from ADR-008's human-gated Phase-4 write amendment. Zero write surface, cleanly argued.
- **SD-1 (widget-owned poller)** is a genuinely better refinement than §8's HomePage wiring: it covers the mosaic pane host (which HomePage wiring cannot reach — verified consumer), gives poll-only-while-mounted for free, and leaves the DependencyGraph prop contract untouched.
- The **Invariants section** (7 never-violate rules) + single-revert rollback story make the gate re-checkable by any future reviewer without re-reading the whole chain.

## Residual risks

- Link-graph state (`based_on` edges among RFC-030/SPEC-006/PRD-036) verified only via body consistency + SHAPE claims — CLI 0.33 `get --json` omits links; a guardian with MCP graph access should spot-check before activation.
- No code exists yet: this review validates the design contract; build-wave drift remains possible — Implementation Phase gates + the test hooks are the mitigation.
- Checkpoint fixture (template) vs workspace `map.json` byte-drift — named in the RFC with a review-checklist mitigation; unproven until the build wave.

## Recommended next steps

- [→ orchestrator] CONCERNS gate: proceed to the build wave WITH Finding 1 acknowledged — require an RFC-030 body amendment (empty-vs-invalid discriminant + the wrong-tag render-harness case) to land before Implementation Phase 4 (view wiring). No architect redesign warranted; no BLOCKER.
- [→ coder / build wave] Finding 2: name the flow-chip owning component + geometry source. Finding 3: enumerate the §15 nav subset shipping at checkpoint (incl. the d3-zoom wheel filter) vs fast-follow.
- [→ tester] Add the wrong-schema-tag → error-surface (NOT empty-state) case to the Phase-4 render harness; keep the E2 row-1 fixture but stop counting it as view-path coverage.
- [→ guardian] Before activating RFC-030: spot-check the based_on edges in the graph and confirm the RFC amendment for Finding 1 landed.

## References

- RFC under review: RFC-030 (informs link from this EVID).
- Parents: PRD-036 (PRD), SPEC-006 (contract).
- Authoritative spec: `docs/PROJECT-MAP-SPEC.md` §5/§8/§9/§10/§15/§16/§18/§19/§20/§22/§23.
- Verified code surfaces: `template/src/shared/config/ui-prefs.ts` · `template/src/widgets/dependency-graph/ui/DependencyGraph.svelte` · `template/src/entities/graph/model/types.ts` · `template/src/shared/api/poller.svelte.ts` · `template/src/shared/server/forgeplan.ts` · `template/src/widgets/mosaic/ui/MosaicCanvas.svelte` · `template/src/widgets/mosaic/lib/persist.ts`.
- Related: EPIC-001 (T4 parent), RFC-029/PRD-034 (registration + mosaic precedent), ADR-008 (Phase-4 write amendment, untouched), rules 21/22.
- Mental models consulted: none available (`mental_model_list` → empty bank); `memory_recall` 13 hits used instead.
- Reviewer identity: `claude-code/fable-5/architect-reviewer-task-5`.

