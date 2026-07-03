---
depth: standard
id: EVID-077
kind: evidence
last_modified_at: 2026-07-02T13:29:40.306406+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-030
  relation: informs
status: draft
title: 'System-dev staff audit of RFC-030: CONCERNS — snapshot-mode honesty gap + 4 medium system findings'
---

# EVID-077: System-dev staff audit of RFC-030 (T4 Phase-1 render-proof) — system-wide / long-horizon review

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit

(`supports` with named CONCERNS: the design chain is sound and honest; findings below are system-level gaps to acknowledge or mitigate, not refutations. CL3: audit ran against the actual artifact bodies + the actual `template/` code on the arc branch.)

## Verdict

**CONCERNS**

One-line justification: RFC-030's verified-in-code claims all check out and ADR-008's governance posture is honest and correctly human-gated, but the widget-owned-poller decision (SD-1) silently exempts the map view from time-travel/snapshot mode — a direct, unnamed contradiction of the program's own honesty invariant — plus four MEDIUM cross-feature findings the RFC does not surface.

## Ground-truth verification

- Base..head: `54a905c862b5` (merge-base with origin/develop) .. `HEAD` on `feat/idef0-composed-map`
- Claim under audit: artifact-authoring wave (PRD-036 / SPEC-006 / ADR-008 / RFC-030 created draft; no code claimed). Code delta on the branch (5008 insertions / 29 files) belongs to the stacked T2 work, not this wave.
- Diff probe: `ls -la .forgeplan/{prds/PRD-036*,specs/SPEC-006*,adrs/ADR-008*,rfcs/RFC-030*}` + `git status --porcelain`
- Diff state: **DELTA=PRESENT** — all four artifact files exist untracked on disk (19.9k / 30.9k / 27.6k / 31.4k bytes respectively)
- Expected delta tokens: `forgeplan.map/v1` → **FOUND** (RFC-030: 4 hits; SPEC-006: 9 hits); `onboard/scan` → **FOUND** (ADR-008: 10 hits)
- Verdict floor from ground-truth gate: **PASS-eligible** (work is real; verdict below is CONCERNS on merit, not on absence)

## Artifact under review

- ID: `RFC-030` (kind: rfc, draft, R_eff 0.0 at audit time — expected pre-prove)
- Parents: `PRD-036` (based_on) + `SPEC-006` (based_on); program parent `EPIC-001` (active)
- Prior `architect-reviewer` EVID: **not yet available** — claim on RFC-030 held live by `claude-code/fable-5/architect-reviewer-task-5` (expires 14:20 UTC), i.e. that review runs in parallel with this one. This audit therefore does NOT restate single-RFC fitness; it covers only the system-wide/long-horizon layer.
- Claim contention: this agent (`claude-code/fable-5/system-dev-task-5`) attempted `forgeplan_claim RFC-030` three times (1× workspace-lock timeout, 2× held-by-architect-reviewer). Proceeded claim-less per rule 12's read-only-reviewer allowance; no force-release used; no claim left behind by this agent.

## System-wide scope inspected

- **Related artifacts:** PRD-036 (parent, Phase staging + FR-012 human gate), SPEC-006 (frozen C1–C6 contract), ADR-008 (rule-22 write amendment, draft/human-gated), EPIC-001 (GATE-C ordering supersession context, honesty outcome #6).
- **Codebase surfaces grepped/read:** `shared/config/ui-prefs.ts` (registry = exactly 8 entries incl. idef0 → "9th" is correct); `widgets/dependency-graph/ui/DependencyGraph.svelte` (final `{:else}` fallback at line 182 — exact per RFC); `entities/graph/model/types.ts` (`GraphEdge {from,to,relation}` byte-exact); `shared/api/poller.svelte.ts` (`POLL_INTERVAL_MS = 10_000` — RFC's SD on SPEC Q2 correct); `shared/server/forgeplan.ts` (`workspaceRoot()` exported at :201); `shared/server/` (registry.ts + snapshot.test.ts precedent real); `widgets/mosaic/{ui/MosaicCanvas.svelte,ui/PaneFrame.svelte,lib/persist.ts}` (auto-enrol + `allViewsKnown` rollback path real); `pages/home/{ui/HomePage.svelte,lib/settings.ts}` (snapshot-mode prop substitution :87–97; persisted-view validation :103); `routes/api/timeline-events/+server.ts` (full read); `shared/lib/idef0/relation.ts`; root `.gitignore`; `.forgeplan/` directory layout.
- **Prior context recalled (Hindsight, 12 hits):** PR #158 rule-22 amendment precedent; rule-22 read-only scope decisions; CLI-vs-MCP contract split for @forgeplan/web; scan-import/reindex coverage leverage; gitignored `.forgeplan/config.yaml` incident (`isHostConfigMissingError`).
- **Out of scope:** forgeplan core CLI source (separate repo — daemon/`map serve` behaviour and scan-import's tolerance of `.forgeplan/map/` assessed from in-repo precedent only); the marketplace map-pack; Phase-2–4 designs beyond their leakage into Phase-1 contracts.

## Methodology

| Step | Detail |
|---|---|
| Categories applied | Long-term maintainability / Migration risk / Blast radius / Missed edge cases / Contract impact / Test surface gap |
| Horizon checked | 6+ months (EPIC-001 program runs to 2026-H2+; T5 adds more surfaces) |
| Related artifacts traversed | 4 (both parents + ADR-008 + EPIC-001) |
| Prior incidents recalled | 12 Hindsight hits |
| Analysers | grep/sed/git (executed, exit 0); `mm-gate-failures` mental model → **404, bank has zero mental models** (skipped, recorded as CONCERNS not silent pass — consistent with all four sibling-wave reports); cloc/madge → skipped (not verified installed; breadth achieved via targeted grep instead) |

## Staff-level findings

### (a) Rule-22 tension — ADR-008 audit result

- **Precedents: all five REAL.** Verified against the live text of `.claude/rules/22-readonly-proxy.md`: `--version` flag-only (PRD-012/RFC-011), `/api/update-check` (PRD-013/RFC-012), `/api/instances` (PRD-027/RFC-023/SPEC-003/ADR-004), git-reconstruction `/api/snapshot` + `/api/timeline-events` (PRD-008/RFC-007 + PRD-016/RFC-015; PR #158 confirmed by memory), `OPTIONS`/CORS on `/api/instance-status` (issue #134). ADR-008's claim "no write-capable exception exists today" is TRUE against the rule text.
- **Hypothesis set: honest.** A vs B1/B2 vs C is a real trichotomy; B1's refutation ("relocates rather than removes the drive-by surface, contradicts the §23 file-watcher daemon contract") is technically correct; C's timing discipline is genuinely adopted, not lip-service — no rule edit, no code, Affected Files "none this wave" verified (`.claude/rules/` untouched in git status). Residual same-origin-bypass risk is named in Consequences/Negative instead of hidden — the exact honesty a human gate needs.
- **Human gate: correctly encoded in five places** (Status field, INV-5, Revisit Trigger 2's next-action, Appendix header, Rollback stage 1). Revisit triggers are parseable (2 event + 1 date 2027-01-02).

| # | Cat | Sev | Location | Finding | Recommended next step |
|---|---|---|---|---|---|
| C-1 | 📜 | MEDIUM | ADR-008 Appendix (rule text) + Open Q1/Q2 | The EXACT amendment text contains two unresolved placeholders — queue cap "N (fixed by the Phase-4 RFC)" and "same-origin check per the Phase-4 RFC's chosen mechanism". Applying it verbatim at the human gate would embed forward references to another document into an enforced rule file, breaking rule 22's "every constraint enforceable from the diff" property. | Add one sentence to Revisit Trigger 2's next-action: the Appendix MUST be re-materialized with the Phase-4 RFC's literal values (N, mechanism) before the rule file is edited; TBD tokens in `.claude/rules/` are a gate-blocker. |
| C-2 | 📜 | LOW | ADR-008 Revisit Trigger 1 | Trigger 1 covers only the `.jobs/` intake interface changing; it does not cover forgeplan core shipping different `.forgeplan/map/` path conventions for `map.json` itself (see M-1). | Widen trigger 1's wording to "any `.forgeplan/map/` path or format contract" or add a fourth trigger. |

### Missed edge cases (🎯)

| # | Sev | Scenario | Recommended next step |
|---|---|---|---|
| E-1 | **HIGH** | **Time-travel/snapshot mode shows the LIVE map as if historical.** Verified: `pages/home/ui/HomePage.svelte:87–97` substitutes `snapshotStore.current.artifacts/.edges` into the props all views consume when scrubbing; RFC-030's SD-1 makes `ComposedMapView` accept-and-IGNORE those props and pull from its own live `mapPoller`. A user scrubbed to a past timestamp with the map view (or a mosaic map pane) selected sees TODAY's map under a historical scrubber position — no indication. This directly contradicts EPIC-001 outcome #6 and PRD-036 Goal 4 (honesty), and SD-1's own rationale weighed mosaic hosting but not the snapshot host state. Cheap to fix if named now (disable or badge the map view while `snapshotStore.mode === 'single'`); expensive to discover post-ship. | RFC revision (one paragraph in SD-1 + one Phase-4 test): pick and pin a behaviour — recommend "map view renders a 'live data — not part of the snapshot' notice or is disabled while snapshotting". |
| E-2 | LOW | Committed `.forgeplan/map/map.json` enters the time-travel event stream: `routes/api/timeline-events/+server.ts` maps EVERY commit under the `.forgeplan/` pathspec to a scrubber event with no path filter (`events = commits.map(...)`, artifactId falls back to `"(repo)"`, kind from a subject heuristic — a subject containing "activate" would classify the map commit as an `activated` event). Phase 1 = 1–2 spurious events; grows if map edits continue while committed (until OQ-1 flips to gitignored). | Note in RFC OQ-1 that the gitignore flip also silences this; optionally add `:(exclude).forgeplan/map/` to the pathspec in the build wave. |

### Long-term maintainability (📈) — 6+ month horizon

| # | Sev | Location | Finding | Recommended next step |
|---|---|---|---|---|
| M-1 | MEDIUM | SPEC-006 C1 / RFC-030 module breakdown | `.forgeplan/map/` is a unilateral namespace claim inside a directory whose layout the forgeplan CLI owns. In-repo precedent tolerates foreign entries (`.forgeplan/` already carries `config.yaml`, `session.yaml`, `anomalies-journal.jsonl`, `memory/`, `state/`, `discovery/`) so near-term collision risk is low — but the DESIGNATED future owner of `.forgeplan/map/` is forgeplan core's unshipped daemon (§23), and both the web reader and ADR-008's amendment text hardcode the path. If core ships `forgeplan map` with different path/format conventions, this repo holds a contract nobody countersigned. Six-month projection: manageable IF the ownership handshake is recorded; a silent divergence otherwise. | Record the path contract as a named cross-repo dependency (one line in RFC Related Artifacts or a core-repo issue); widen ADR-008 trigger 1 (C-2). The `schema: forgeplan.map/v1` tag is the right versioning seam — keep it load-bearing. |
| M-2 | MEDIUM | RFC-030 data flow / §22 | Phase 1 ships a hand-authored, authoritative-looking map with NO freshness/provenance signal rendered (drift badges + `source_fingerprint` are Phase-2+ carried fields). Six-month projection: the checkpoint map silently rots against the moving repo while presenting as confirmed truth — the exact "curated map lies" failure §23's drift machinery exists to prevent, just earlier than that machinery ships. | Cheap Phase-1 mitigation: render a small "hand-authored · <meta.version/date>" chip from fields the schema already carries. Recommend as fast-follow, not a gate. |
| M-3 | LOW | `shared/config/ui-prefs.ts` growth path | Registry goes 8→9 now; EPIC-001's T5 + builder surfaces (Mechanism Atlas, ASSAY, Throughline, Waterline) put it on a path to 12+. The flat switcher + mosaic Select scale mechanically (PaneFrame uses a dropdown) but not cognitively; no grouping mechanism exists. Not this RFC's problem to solve — but the 10th registration should not repeat "additive entry" without a grouping decision. | Note for the T5 RFC: introduce view categories/grouping at or before the 10th entry. |

### Contract impact (📜)

| # | Sev | Location | Finding | Recommended next step |
|---|---|---|---|---|
| T-1 | MEDIUM | SPEC-006 C1 namespace default / `entities/map/lib` (planned) | The 11-entry `VALID_RELATIONS` list hardcoded into the map entity becomes the THIRD independent relation vocabulary in the system (forgeplan CLI's actual vocabulary; `shared/lib/idef0/relation.ts` ICOM table; now map's classifier). When the CLI adds a 12th relation, map edges carrying it silently classify as `code-dep` — by design "not an error", but silent misclassification with zero surfaced signal is drift, not forward-compat. | In the build wave: emit a `severity: "warning"` validation entry for a relation outside the known list (the validator's warning channel already exists per SPEC Q3 resolution), and/or source the list from one shared module with `idef0/relation.ts`. |
| T-2 | — | SPEC-006 C2 | Edges-only superset is structurally sound: `MapEdge extends GraphEdge` propagates upstream changes at compile time, and SPEC AC-4's narrowing assertion pins the Liskov invariant. Verified against the real `GraphEdge` (byte-exact). Transport duplication risk (audit focus d): **adequately contained.** | None. |

### Test surface gap (🧪)

| # | Sev | Location | Finding | Recommended next step |
|---|---|---|---|---|
| G-1 | MEDIUM | `widgets/dependency-graph/ui/idef0-view.render.test.ts:420` vs RFC-030 Invariant 6 | The existing T2 test hardcodes `expect(GRAPH_VIEW_IDS.size).toBe(8)` — registering the 9th view breaks it. RFC Invariant 6 ("the 8 pre-existing views … stay byte-untouched") and AC-3 ("verified by the existing test suite") do not carve out this necessary edit; a literal-minded builder either violates the invariant or "fixes" the failure wrongly. | One-line RFC amendment: name `idef0-view.render.test.ts:420` as the single sanctioned existing-file edit (8→9), keeping the invariant honest. |

### Phase-leakage check (audit focus c) — clean

Phase 1 leaks no Phase-3/4 CODE commitments: no POST route, no `.jobs/` handling, no chat/tour code paths are specified for this arc; the schema carries Phase-2+ FIELDS (`increments`, mega-nodes, `layers`, `capacity/overflow`, `description_ru`, `agent_run`) by explicit PRD constraint ("nothing shipped may need re-doing"), validated-but-inert, walk-backable via the `forgeplan.map/v1` schema tag. Design-level check only — no code exists yet to grep; the build-wave reviewer should re-run this check against the diff.

## Blast radius (mandatory)

- **Affected scope:** template UI viewer only — one new GET file-read endpoint, one new entity, one new widget, +1 registry entry auto-enrolling into mosaic. No forgeplan spawn-path, no bin/, no dist pipeline, no existing endpoint touched. Cross-repo: a soft namespace claim on `.forgeplan/map/` against unshipped forgeplan-core ownership (M-1). Cross-team: none (single-repo program).
- **Reversibility:** fully reversible, single revert. VERIFIED in code, not just asserted: `pages/home/lib/settings.ts:103` drops unknown persisted view ids; `widgets/mosaic/lib/persist.ts:15-38` (`allViewsKnown`) resets layouts containing removed views. ADR-008 adds zero files this wave; its own rollback plan is staged and credible. No one-way doors in this arc.
- **Downstream artifacts:** Phase-2–4 RFCs consume SPEC-006's frozen contract; ADR-008's Appendix consumes the Phase-4 RFC (C-1 ordering constraint).
- **Detection time if wrong:** render defects — immediately visible in the checkpoint proof; E-1 (snapshot dishonesty) — likely MONTHS (requires time-travel + map view simultaneously), which is why it is the lead finding.
- **Customer-visible impact if wrong:** worst credible case is a lying-but-plausible map (E-1, M-2) — reputational for a product whose stated core value is honesty; no data loss possible.

## Recommended action

**CONCERNS — accept budget with two targeted RFC touch-ups before the build wave**: (1) E-1 snapshot-mode behaviour pinned in SD-1 (one paragraph + one test hook); (2) G-1 named as the sanctioned existing-test edit. C-1/T-1/M-1/M-2 can ride as acknowledged follow-ups tracked in the build wave / Phase-4 gate. Nothing here warrants an `architect` redesign — the architecture is sound; the gaps are cross-feature blind spots, all cheap while the RFC is still draft.

## Residual risks

- forgeplan core CLI source not inspected (separate repo): scan-import/reindex tolerance of `.forgeplan/map/` inferred from in-repo precedent; the ephemeral-worktree `reindex` in `/api/snapshot` presumed inert on a stray `map/` dir — unverified against CLI internals.
- Parallel `architect-reviewer` EVID not yet landed at audit time — guardian should collate both; overlap (if any) resolves in guardian's favor.
- Checkpoint fixture ↔ workspace copy byte-drift (RFC SD-3) relies on a review-checklist, not automation — accepted by the RFC, watch on second occurrence.
- Render performance unmeasured until the prove-phase EVID (PRD Q3 method is sound; number still absent).

## References

- Artifact under review: RFC-030 (draft; informed by this EVID)
- Parents: PRD-036, SPEC-006; program: EPIC-001; governance sibling: ADR-008 (draft, human-gated — audited here, deliberately NOT linked for activation)
- Rule under tension: `.claude/rules/22-readonly-proxy.md` (all 5 cited precedents verified in its live text)
- Code ground truth: `template/src/shared/config/ui-prefs.ts` · `widgets/dependency-graph/ui/DependencyGraph.svelte:182` · `widgets/dependency-graph/ui/idef0-view.render.test.ts:420` · `pages/home/ui/HomePage.svelte:87-97` · `pages/home/lib/settings.ts:103` · `widgets/mosaic/lib/persist.ts:15-38` · `routes/api/timeline-events/+server.ts` · `entities/graph/model/types.ts:1-5` · `shared/api/poller.svelte.ts:4` · `shared/server/forgeplan.ts:201` · `shared/lib/idef0/relation.ts` · `.gitignore:17-27`
- Mental models: `mm-gate-failures` → 404 (bank empty; recorded honestly); Hindsight recall: 12 hits incl. PR #158
