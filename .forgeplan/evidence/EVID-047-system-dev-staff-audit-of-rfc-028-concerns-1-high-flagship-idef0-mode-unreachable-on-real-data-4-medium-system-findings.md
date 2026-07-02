---
depth: standard
id: EVID-047
kind: evidence
last_modified_at: 2026-07-01T10:40:02.833954+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EVID-050
  relation: supersedes
status: superseded
title: 'System-dev staff audit of RFC-028: CONCERNS — 1 HIGH (flagship idef0 mode unreachable on real data) + 4 MEDIUM system findings'
---

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit

(`weakens` = this staff audit surfaces material system-wide / long-horizon fitness gaps that must be acknowledged or reconciled before the T1 keystone is activated; CL3 = review performed directly on the real stored artifacts + the real `develop`/`feat/idef0-decomposition-surfaces` tree + a live `forgeplan graph --json` = same context; `audit` = system-level architecture-fitness audit, no code executed.)

## Verdict

**CONCERNS**

One-line justification: the core's pure-library design is sound, honest, and salvageable — but over a 6+ month horizon it ships a keystone whose **flagship IDEF0-diagram path is empirically unreachable on the real dogfood workspace** (measured decomposition density ≈ 0.095 vs the RFC's own 0.3 gate), leaving the most complex, highest-value code validated by synthetic fixtures only and roadmap-gated on a *separate* track (T3), while the second-host reuse claim (EPIC Outcome 5) is contradicted by the composed-map spec's own "owns its `MapNode`, no adapter" design.

- **PASS** — none above LOW. Not the case.
- **CONCERNS** — MEDIUM/HIGH present; guardian must gate activation with explicit acknowledgement + tracked mitigations. ← this audit.
- **BLOCKER** — CRITICAL / redesign-requiring. Not the case: the design needs RFC edits + explicit roadmap acknowledgement, not an `architect` redesign; the honest tier-stack fallback means the system never *lies*, it under-delivers the marquee visual on real data until T3.

This audit runs **after** `architect-reviewer` (EVID-046, CONCERNS, F1–F4). It does not re-litigate F1–F4; it adds the system-wide / long-horizon layer and, where relevant, notes how the real-data ground truth **compounds** F1/F2.

## Ground-truth verification

This is a **design-RFC audit**, not a landed-code claim. The dispatch asks me to *judge a design over a 6-month horizon*; the artifact under review is RFC-028 (present, schema-complete), and the ground truth is the factual base the design rests on (the real tree + the live workspace data shape) — not a git delta.

- Base..head: `n/a — design review; no code mutation claimed by this dispatch` (source: dispatch framing).
- Repo / branch: `/Users/explosovebit/Work/ForgePlanWeb` @ HEAD `54a905c` on `feat/idef0-decomposition-surfaces` (same tree architect-reviewer used).
- Diff probe: `git status --short` + `ls template/src/shared/lib/` → **DELTA=EMPTY for the core**: `shared/lib/` holds only `index.ts` + `theme.svelte.ts`; **no `idef0/`, no `tier/`**; `grep -rl "classifyIcom|buildDecompForest|idef0-relation" template/src` → **0 hits**. The core is genuinely un-built — correct and expected (RFC ships `draft`; BUILD is a pending step). No vacuous "already implemented" claim.
- Expected delta token: the load-bearing *source facts* the RFC/ADR-006/ADR-007 assert. Token probe → **all FOUND / as-claimed**:
  - `SankeyView.svelte:35` → `import { TYPE_ORDER } from '../lib/cluster.svelte';` (verbatim — the shim-critical direct import ADR-006 exists to protect).
  - `cluster.svelte.ts:8` → `export const TYPE_ORDER = [` (RFC/ADR said 8–18). ✓
  - `type-tier.ts:13` `typeTier`, `:25` `compactTierMap`, `:63` `HIERARCHY_RELATIONS`, `:76` `normaliseHierarchyEdge`, `:81` `if (!HIERARCHY_RELATIONS.has(relation)) return null;`, `:91 default:`. **Confirms the frozen relation table co-locates with the lifted tier symbols in the SAME file** → the RFC's insistence on *symbol-granular* (not whole-file) INV-9 identity is correct and necessary. ✓
  - `DependencyGraph.svelte` → 7 real view branches (`force/tree/radial/matrix/sankey/sunburst` + final `{:else} LanesView` at 169); the `{:else if view==='idef0'}` seam is real. ✓
  - `ui-prefs.ts` → `GRAPH_VIEWS` (:19), `GraphView` union (:64), `GRAPH_VIEW_IDS` (:73). ✓
  - `docs/PROJECT-MAP-SPEC.md` present; §23 composed-map host contract read in full (see finding S-4).
- **Live workspace data shape** (`forgeplan graph --json`, this session): **117 nodes** (1 epic, 32 prd, 27 rfc, 4 spec, 7 adr, 45 evidence, 1 note); **131 edges = informs 100 (76%) / based_on 20 (15%) / refines 11 (8%)**.
- Independent tool re-checks (generator≠verifier applies to the prior reviewer too): `forgeplan_validate RFC-028` → **passed, 0 errors, 0 warnings**; `forgeplan_score RFC-028` → **R_eff 0.0, weakest_link EPIC-001**, and **SPEC-004 / ADR-006 / ADR-007 all *skipped as evidence because they are status:draft***.
- Verdict floor from ground-truth gate: **PASS-eligible** (artifact + factual base present and accurate; the CONCERNS verdict is a system-fitness judgement, not a claim-vs-reality gap). The empty-diff-is-BLOCKER rule does not fire: no landed change was claimed — the dispatch asks to judge a design.

## Artifact under review

- ID: `RFC-028` — kind: `rfc` (depth: standard) — status: **draft**, R_eff 0.0.
- Title: "Pure staged idef0 decomposition core (shared/lib/idef0) with id-indexed port and tier lift".
- Parent chain: `RFC-028 refines EPIC-001` (critical); `based_on` SPEC-004 (frozen contract), ADR-006 (tier lift), ADR-007 (projection + Q2 letters).
- **Architectural fitness (per `architect-reviewer` EVID-046): CONCERNS** — 3 MEDIUM (F1 tier-stack `diagram:null` contradicts frozen `Idef0Diagram.mode`; F2 O(1)-DOM ≤6-box gap + 16-root top tier; F3 id-collision edge-endpoint resolution undefined) + 1 LOW (F4 `takenAt` precedence). Verdict acknowledged and **not re-litigated**. My role is the layer EVID-046 could not reach (system-wide, long-horizon) and, where the two touch, I note how the real-data ground truth **upgrades the practical impact of F1/F2**.

## System-wide scope inspected

- **Related artifacts traversed (7):** RFC-028 (subject); SPEC-004 (frozen INV-1..10/FR/AC/scenarios); ADR-006 (tier lift + Sankey shim); ADR-007 (IDEF0-STYLE projection, local relation table, Q2); EVID-045 (SPEC-004 C4 audit, CONCERNS F1–F6 — verified consumed by the SPEC revision this RFC rests on); **EVID-046 (the immediately-preceding architect-reviewer EVID)**; EPIC-001 (parent, Outcomes 1/2/4/5/6, risk table, T-track dependency graph).
- **Codebase areas grepped (blast radius beyond the RFC's own file list):** `dependency-graph/lib/{cluster.svelte.ts,type-tier.ts}` (lift + frozen table), `ui/{SankeyView,DependencyGraph}.svelte` (shim-critical import + 7-view seam), `shared/config/ui-prefs.ts` (view registry), `shared/lib/` (confirmed core un-built), `docs/PROJECT-MAP-SPEC.md §23` (T4 host contract, read in full).
- **Live signals:** `forgeplan graph --json` relation histogram (the density realism); `forgeplan_score` chain-trust.
- **Prior context recalled (Hindsight):** the real data-shape open question ("0 epics… 16 parentless PRDs… 84% informs… structural-density gate for fallback"); the 9th-view triple-site registration; the local `idef0-relation.ts` non-mutation rule; the **forgeplan id-collision reindex-overwrite gotcha** (parallel checkouts collide on PRD-NNN, reindex silently overwrites, *no anomaly emitted*). `mm-gate-failures` mental model is **absent from this bank (HTTP 404); `mental_model_list` → empty** — recorded honestly, not fabricated.
- **Out of scope (deliberate):** line-level code style; STRIDE/CWE security attribution (`security-expert`'s job); re-deriving F1–F4; the IDEF0/ICOM metaphor correctness (ADR-007-decided); the T2/T4 host UIs themselves (separate EPIC children — only the *core→host contract* is in scope).

## Methodology

| Step | Detail |
|---|---|
| System-level categories applied | 📈 maintainability · 🔄 migration · 🛠 operability · 💥 blast radius · 🎯 edge-at-scale · 📜 contract · 🧪 test-surface |
| Horizon checked | 6 months minimum (T1 keystone → T2 first host → T3 spine authoring → T4 graft) |
| Related artifacts traversed | 7 (parent + frozen SPEC + 2 ADRs + 2 prior EVIDs incl. architect-reviewer + composed-map spec) |
| Prior incidents recalled | id-collision reindex-overwrite; real-data-shape open question; two-table drift note |
| System-scope analysers | see table |

### System-scope analysers

| Tool | Command | Status | Exit | Summary |
|---|---|---|---|---|
| forgeplan_validate | `forgeplan_validate RFC-028` | executed | ok | passed, 0 errors, 0 warnings (schema-complete) |
| forgeplan_score | `forgeplan_score RFC-028` | executed | ok | R_eff 0.0; weakest_link EPIC-001; SPEC-004/ADR-006/ADR-007 skipped (draft) |
| forgeplan graph --json | relation histogram over live workspace | executed | ok | 117 nodes; refines=11, based_on=20, informs=100 → decomposition density ≈ 0.095 |
| git / ls | `git status`; `ls template/src/shared/lib` | executed | ok | core un-built (idef0/, tier/ absent); no vacuous claim |
| grep (source facts) | SankeyView:35, cluster:8, type-tier:13/63, DependencyGraph views | executed | 0-fail | every load-bearing RFC/ADR code fact FOUND as-claimed |
| cloc / madge | module-graph analysers | N/A / skipped | — | greenfield RFC — no module to measure; honest negative coverage |
| mm-gate-failures | `mental_model_get` | **skipped (absent — HTTP 404)** | — | recorded as CONCERNS-in-methodology, not fabricated |

## Staff-level findings

Ranked by severity. Each is a system-level concern to *surface* — not an alternative design (HARD RULE 1). S-1..S-6 are distinct from architect-reviewer's F1–F4.

### Long-term maintainability (📈)

| # | Severity | Location | Description | Recommended next step |
|---|---|---|---|---|
| **S-1** | **HIGH** | RFC §"Proposed Direction" (Q1=0.3) + §"Data Flow" (tier-stack path) vs live `graph --json` + EPIC Outcomes 1/2 | **The flagship IDEF0-diagram mode is empirically unreachable on the real dogfood workspace.** The idef0 decomposition spine is `refines`-**only** (INV-4; ADR-007 makes `based_on`→Input, non-structural). Live workspace: **11 `refines` edges over 117 nodes** ⇒ density = (N−roots)/(N−1) ≤ (117−106)/116 = **11/116 ≈ 0.095**, well below the 0.3 gate — so the density gate routes **the real data to `tier-stack` mode**, never `idef0`. Crossing 0.3 needs ~35 refines edges (**~3× more authored spine**), which is precisely **T3's** remit (a *separate* EPIC track). Consequence over 6 months: the keystone ships, passes its 12-scenario conformance harness (built on **synthetic** dense fixtures), and yet the marquee ICOM diagram — the most complex, highest-value code path — gets **zero real-data exercise** and renders as the honest-but-underwhelming tier-stack on the actual project until T3 authoring lands. The RFC frames 0.3 as "tunable data (re-bind against dogfood, no ADR)", but **no threshold in [0,1) makes today's data render as idef0** — tuning cannot fix a sparsity problem; only authored structure (T3) can. | Guardian to accept only with **explicit acknowledgement** that the idef0-mode path is synthetic-only-validated and T3-gated; require the conformance harness to include an *authentic* `graph --json` fixture asserting the **tier-stack** outcome on real data (so the real default is a tested contract, not an accident); track the T1→T3 value-dependency on the EPIC. Do **not** let the "≥3 real depth / idef0 renders" outcome be claimed on T1 evidence. |
| **S-3** | MEDIUM | ADR-007 §Consequences ("two relation tables to keep in sync"); RFC I-6 / classifyIcom | **Relation-vocabulary two-table drift over forgeplan-CLI evolution.** The core ships a local `idef0-relation.ts` *and* the shared `HIERARCHY_RELATIONS` persists — two tables. The totality test (I-3) catches a *canonical* relation lacking a case, but **not a NEW relation added upstream**: forgeplan is actively churning (0.33, forgeplan#397). A future `forgeplan_link` relation (e.g. `"blocks"`) silently falls to `E-UNKNOWN-RELATION` (derived, non-structural) — new structural semantics invisible until a human hand-edits the local table. A slow 6-month decay tax with no loud signal. | Add a **relation-set drift guard** to the harness: assert the core's canonical relation set is byte-equal to forgeplan's live `forgeplan_link` relation enum (fail loudly when upstream adds one), not merely that each *known* canonical has a case. |

(S-1 is the lead finding; it is the single most important thing this audit surfaces.)

### Migration risk (🔄)

| # | Severity | Location | Description | Recommended next step |
|---|---|---|---|---|
| **S-2** | MEDIUM | ADR-006 §Preconditions ("PROB-060 landed / clean tree"); EPIC-001 risk row 1; RFC Phase 0 | **Cross-artifact Phase-0 sequencing hazard.** ADR-006's own precondition requires PROB-060 landed and a clean tree before the tier-lift; EPIC risk row 1 requires the **T3-A reindex** to run only on a clean tree "сначала залендить PROB-060". The Hindsight-recalled gotcha is concrete: a reindex on a merge-duplicated branch **silently overwrites** a collision artifact with **no anomaly emitted**. PROB-060 does not appear landed to the trunk (the session opened on `feat/prob-060-snapshot-identity` with PRD-016/RFC-015 dirty). If Phase-0 tier-lift or T3-A reindex starts before PROB-060 lands, ADR-006's precondition is violated and the id-collision machinery the RFC builds (INV-7/E-ID-COLLISION) is undercut by the very index desync it is meant to survive. | Guardian/orchestrator to **confirm PROB-060 landed on a clean tree as a hard gate before Phase 0**; capture the pre-lift `typeTier`/`compactTierMap` golden AND an artifact-count before/after the reindex (EPIC mitigation) so an overwrite is detectable. |

### Operational concerns (🛠)

| # | Severity | Location | Description | Recommended next step |
|---|---|---|---|---|
| O-1 | LOW | RFC §"Complexity + budget"; core is pure | Observability is legitimately **N/A** — a synchronous pure lib in a Svelte reactive effect; NFR-001 forbids I/O. Agreeing with architect-reviewer. The one operational nuance: on real data the user opens the flagship "idef0" view and sees a tier-stack; `DensityVerdict.reason` exists (good) but the *host* must surface it prominently, else the feature reads as broken rather than honest (ties to S-1). | Host-layer concern (T2), flagged so it is not lost: ensure `DensityVerdict.reason` is user-visible when mode falls back. No core change. |

No operational concern above LOW at the core layer — correct for a pure, read-only library (rule 22: no `/api/*` mutation, no spawn, no workspace write).

### Blast radius (💥)

**Mandatory section.**

- **Affected scope:** client-side render only. (a) **7 existing hierarchical views** (Force/Radial/Tree/Sunburst/Matrix/Lanes/Sankey) via the **tier-lift** — the single highest-impact path; a one-index drift in `typeTier`/`compactTierMap` silently shifts the "altitude" of all 7 (verified consumers: `tree-layout.ts`, `sankey-layout.ts`, `sunburst-layout.ts`, `cluster.svelte.ts`, and the direct `SankeyView.svelte:35`). (b) **1 new `idef0` view** (T2). (c) The **frozen relation table** shared by the 7 views (`type-tier.ts:63-94`) — protected symbol-granularly (INV-9). **Zero server surface, zero data mutation, zero user-data risk.**
- **Second-host / composed-map graft (task-directed check):** **not de-risked — see S-4.** EPIC Outcome 5 ("≥2 surfaces from one core") is truly validated by only **one** host (T2) today.
- **Reversibility:** mostly reversible (pure lib ⇒ `git revert` = zero behavioural residue; Q1 re-bind = one line; Q2 re-letter = local-table edit). The **tier relocation is semi-irreversible** (ADR-006-owned) but made cheap by the byte-identity golden. De-facto kill-switch: the view is invisible until the `{:else if view==='idef0'}` branch + `ui-prefs` entry land — not registering it is the off switch.
- **Detection time if wrong:** immediate at CI — the 12-scenario harness + ADR-006 byte-identity golden + NFR-002 micro-benchmark gate each phase PR. **Blind spot:** the harness's *dense* fixtures are synthetic (S-1) — a regression in the idef0-mode diagram on *real* data would not be caught by any real-data test until T3 supplies dense authored structure.
- **Customer-visible impact if wrong:** worst case = altitude drift across the 7 views (silent, visual) or a wrong/absent 9th view. No checkout/billing/auth analogue — this is a dev-tooling viewer.

### Missed edge cases (🎯)

| # | Severity | Scenario | Recommended next step |
|---|---|---|---|
| **S-6** | LOW | **`serialiseKey` NUL-delimiter ambiguity.** `serialiseKey(k) = id + "\0" + title` is the sole identity codec for the flat `Map`. If an `id` or `title` contains a literal `\0` (adversarial/pasted markdown content), two *distinct* composite keys can serialise to the same string — silently **coalescing the exact nodes** the id-collision machinery (INV-7/E-ID-COLLISION) exists to keep distinct. Titles are arbitrary user strings. | One fixture asserting a `\0`-bearing title does not collapse two keys (or a documented precondition that `port()` strips control chars). Cheap; closes the one identity-codec hole. |
| E-note | — | Real-data compounding of architect-reviewer F1/F2: because real data is **always** tier-stack (S-1), F1's `diagram:null` tier-stack path is the **default real-data render**, not a rare edge — and F2's 16-root top tier is the live shape, not hypothetical. This *upgrades the practical severity* of both F1 and F2 from "edge" to "the common case". | Fold into F1/F2 reconciliation — the tier-stack representation contract is exercised on every real render. |

Not silent on edge cases: S-6 named; plus the real-data compounding of F1/F2 above.

### Contract impact (📜)

| # | Severity | Location | Description | Recommended next step |
|---|---|---|---|---|
| **S-4** | MEDIUM | RFC §"pure-core + N-host-adapter contract" (T4 = `MapNode[] → RawSnapshot` adapter) vs `docs/PROJECT-MAP-SPEC.md §23` (lines 68, 262, 317, 336) | **The T4 composed-map "reuse-not-fork" is asserted, not de-risked — and §23 actively contradicts it.** RFC-028 assumes T4 supplies a thin `MapNode[] → RawSnapshot` adapter so the core is reused "no algorithm fork." But §23 designs ComposedMap to **"own its `MapNode`… read `/api/map` exclusively — never shares"**, with node-type compatibility **explicitly excluded** ("Edge superset is real & free; **node superset is NOT**"; "no adapter"). Worse, `MapNode` is a **derived** artifact from `map.json`: nodes are pre-**zoned**, **mega-collapsed** (>8 → collapsed mega-node), and keyed by `sha1(kind+':'+path)[:12]` — **not** the core's composite `(id,title)`, and with the raw `refines` relations already rebinned. Lowering that back to a raw `(id,title,kind)+relation` `RawSnapshot` the decomposition core needs is a semantic mismatch, not a thin adapter. T4 *also* already ships its own pure layout core (`widgets/composed-map/model/layout.ts#computeComposedLayout`). NFR-004's import-not-reimplement test checks **symbol** non-duplication only — it structurally **cannot** catch this representational fork (T4 does not exist yet). **EPIC Outcome 5 ("≥2 surfaces from one core") is therefore aspirational until T4's contract is reconciled with §23.** | Before T1 evidence is used to *claim* Outcome 5, require a **render-proof that the composed-map's `map.json`/`MapNode` can actually lower to `RawSnapshot` with raw `refines` recoverable** — or explicitly downgrade the RFC's "two hosts" claim to "one host now (T2); T4 reuse pending §23 reconciliation". This is a `PRD-T4`↔`RFC-028`↔`§23` contract to settle, not a T1 blocker. |
| S-5 | LOW | RFC §"Function Signatures" (public core surface) | **No API-stability posture for a library the EPIC plans to feed 6 surfaces** (T2, T4 + Mechanism Atlas / ASSAY / Throughline / Waterline). SPEC-004 freezes the *data shapes* (good), but signature evolution across N hosts is unaddressed; once T2 imports `deriveIdef0`/`classifyIcom`, changing the core becomes an N-host breaking change. | A one-line stability note ("the `index.ts` barrel is the frozen public surface; internal modules may change") + a `@internal` boundary; cheap now, expensive to retrofit after 3+ hosts attach. |

### Test surface gap (🧪)

| # | Severity | Description | Recommended next step |
|---|---|---|---|
| T-1 | MEDIUM | **The dense idef0-mode path has no real-data test** (S-1): the 12-scenario harness exercises the flagship diagram only through synthetic dense fixtures, while the only *authentic* fixture (`graph --json` dogfood snapshot) hits the tier-stack path. So the highest-value code is conformance-green but real-world-unexercised. Additionally, F3's determinism hole (edge under id-collision) escapes the property test if its fixed reordering set omits collided ids. | Add (a) a real-`graph --json` fixture asserting tier-stack on today's data (locks S-1 as a known contract), and (b) once F1/F3 land, the architect-reviewer's proposed collided-id-edge fixture + an INV-10-in-tier-stack-mode assertion. |

### Chain-trust observation (not a new finding)

`forgeplan_score RFC-028` → R_eff 0.0, and **SPEC-004 / ADR-006 / ADR-007 are all skipped as evidence because they are `draft`.** The entire conformance chain the RFC rests on is unactivated, and parent EPIC-001 is evidence-less (R_eff 0). Activation of RFC-028 is independently blocked on this regardless of any finding here — the guardian should sequence the chain (activate the frozen SPEC + the 2 ADRs on their own EVIDENCE first, then RFC-028) rather than activate RFC-028 against a draft foundation.

## Recommended action

**CONCERNS — add mitigation + explicit acknowledgement before gate.** Recommended handoff to guardian:

1. **Hold activation** (already independently required: architect-reviewer F1–F4 unreconciled; no conformance/NFR-002 EVIDENCE exists; SPEC-004/ADR-006/ADR-007 still draft; EPIC-001 evidence-less).
2. **Require explicit acknowledgement of S-1 (HIGH)** in the gate record: the idef0-mode flagship is synthetic-only-validated and T3-gated; T1 evidence must **not** be used to claim EPIC Outcomes 2 ("real depth ≥3 / idef0 renders") or the idef0 half of Outcome 5. Add the real-data tier-stack fixture (T-1) so the real default is a tested contract.
3. **Track S-2 as a hard Phase-0 precondition** (PROB-060 landed on a clean tree + before/after count) and **S-4 as a T4-contract de-risk** before "two hosts" is claimed.
4. **Fold S-3 / S-5 / S-6** into the RFC's test-strategy + a one-line API-stability note (cheap, non-blocking).
5. This is **not** an `architect` redesign trigger — the core structure is sound; every finding closes via RFC edits, harness additions, and sequencing discipline.

## Residual risks

- The NFR-002 ≤50 ms@N=1000 budget is **target-until-measured** (correct posture; the real number is Phase-5 EVIDENCE) — orthogonal to S-1, which is about *which mode runs on real data*, not raw speed.
- Recursive-DFS stack depth on a pathological all-`refines` chain (RFC-disclosed; unrealistic at document-graph depth ≈3–5) — not a new finding.
- I did not measure the exact `roots` count after `port()` dedup/drop on the live workspace; the density figure (≈0.095) is an **upper bound** (multi-parent demotions only lower it), so S-1's conclusion (real data ⇒ tier-stack) is robust to that imprecision.
- `mm-gate-failures` mental model absent from this bank (404) — synthesis of prior gate failures could not be loaded; compensated by direct EVID-045/046 + EPIC risk-table + Hindsight recall.

## References

- Artifact under review: `RFC-028` (draft, R_eff 0.0, validate=passed).
- Parent: `EPIC-001` (critical; Outcomes 1/2/4/5/6 + risk table + T-track dependency graph).
- Frozen contract: `SPEC-004` (INV-1..10 / FR-001..007 / NFR-001..004 / AC-1..6 / 12 scenarios; Q1/Q3/Q4 RFC-bound).
- Governing ADRs: `ADR-006` (tier lift + Sankey shim + Phase-0 preconditions), `ADR-007` (IDEF0-STYLE projection, local relation table, two-table sync cost).
- Prior EVIDs: `EVID-045` (SPEC-004 C4 audit, CONCERNS F1–F6 — consumed by the SPEC revision), **`EVID-046` (architect-reviewer of RFC-028, CONCERNS F1–F4 — acknowledged, not re-litigated)**.
- Composed-map host contract: `docs/PROJECT-MAP-SPEC.md §23` (MapNode isolation — S-4).
- Live workspace signal: `forgeplan graph --json` → 117 nodes / refines 11·based_on 20·informs 100 → decomposition density ≈ 0.095.
- Ground-truth tree: `feat/idef0-decomposition-surfaces` @ `54a905c` — `SankeyView.svelte:35`, `cluster.svelte.ts:8`, `type-tier.ts:13/25/63/76/81/91`, `DependencyGraph.svelte:87-169`, `ui-prefs.ts:19/64/73`.
- Mental models consulted: `mm-gate-failures` — **absent from this bank (HTTP 404)**; `mental_model_list` → empty.




