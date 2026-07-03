---
depth: standard
id: EVID-058
kind: evidence
last_modified_at: 2026-07-01T17:46:06.737085+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-034
  relation: informs
status: active
title: 'Artifact-health audit: PRD-034 + SPEC-005 — CONCERNS (SPEC-005 missing graph link to PRD-034; R_eff design-time-only)'
---

# Artifact-health audit: PRD-034 + SPEC-005 (Wave T2 idef0 view)

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit

(Fields above are the Forgeplan R_eff parser contract. The artifact-**health** verdict is **CONCERNS** — see `## Verdict`. `verdict: supports` means the audit affirms the two artifacts are schema-valid and structurally well-formed; it does **not** assert activation-readiness, which is gated on the build-time SPEC-005 conformance EVIDENCE and R_eff, owned by the guardian.)

## Verdict

**CONCERNS** — PRD-034 and SPEC-005 are schema-valid (0 MUST errors each), every MUST section is non-stub, the PRD functional requirements carry **no** implementation leakage (rule 11), Non-Goals correctly fence off T3 mutation / browser writes (rule 22) / T4–T5, all four mandated links exist, and EVID-057's `congruence_level` is a valid integer (no R_eff-collapse parse error). One **MEDIUM** link-graph gap (SPEC-005 has no graph edge to its own driving PRD-034 — the trace is prose-only) plus two **LOW** SHOULD-warnings remain. The evidence chain is design-time-only by design (R_eff 0.10 / 0.00), so neither artifact is activatable yet — the executable SPEC-005 render-conformance EVIDENCE is the gating follow-on. No CRITICAL/HIGH finding; **not a BLOCKER**.

## Ground-truth verification

- Base..head: n/a — artifact mutation via forgeplan MCP; no git file-change claimed in the SPARC dispatch.
- Diff probe: n/a — verified via `forgeplan_get` (each artifact body read in full) + `forgeplan_graph` (link edges) + `forgeplan_validate` + `forgeplan_score`.
- Diff state: n/a (MCP artifact state, not a file diff).
- Expected delta tokens (from SPARC report): PRD-034 {FR-001…FR-011, AC-1…AC-7, "ADI Reasoning Outcome"}; SPEC-005 {13 `#### Scenario`, RC-1…8, V-* errors}; EVID-057 {`## Structured Fields` CL2 audit}.
- Token probe (against `forgeplan_get` bodies): PRD-034 → `FR-011` FOUND, `AC-7` FOUND, "ADI Reasoning Outcome" FOUND, Non-Goals FOUND. SPEC-005 → 13 `#### Scenario` FOUND incl. "honest tier-stack fallback" / "dense idef0 render" / "no-regression of the seven existing views", `RC-1`…`RC-8` FOUND, `V-EMPTY`…`V-UNKNOWN-ROLE` FOUND. EVID-057 → `congruence_level: 2` + `evidence_type: audit` FOUND.
- Link probe (`forgeplan_graph`): `PRD-034 -->|refines| EPIC-001` FOUND; `PRD-034 -->|based_on| RFC-028` FOUND; `SPEC-005 -->|based_on| SPEC-004` FOUND; `EVID-057 -->|informs| PRD-034` FOUND.
- Verdict floor from ground-truth gate: **PASS-eligible** — every claimed section/field and all four mandated links are present in stored state; no claim-vs-reality gap.

## Schema completeness

PRD-034 (kind=prd — MUST: Problem, Goals, Non-Goals, Functional Requirements, Target Users, Related Artifacts):

| MUST section | Present | Notes |
|---|:-:|---|
| Problem | ✓ | Rich; includes a "Decision context" weighing 3 alternatives (a/b/c) |
| Goals | ✓ | 6 goals, each measurable; mapped to EPIC Outcomes 4/5/6 |
| Non-Goals / Out of scope | ✓ | 7 exclusions (rule-22 browser writes, T3 authoring/reindex, T4, T5, no-regression, no new install dep, no core-algo/geometry change) |
| Functional Requirements | ✓ | FR-001…FR-011, capability-only, each with acceptance criteria |
| Target users / actors | ✓ | 5 actors (practitioner, a11y user, snapshot poller, core, reviewers) |
| Related Artifacts | ✓ | EPIC-001, RFC-028, SPEC-004, ADR-006, ADR-007 + planned RFC/SPEC + EVID |

Validation: PASS — 0 MUST, 2 SHOULD + 1 COULD warnings.

SPEC-005 (kind=spec — MUST: Contract, Data Models, Errors):

| MUST section | Present | Notes |
|---|:-:|---|
| Contract | ✓ | RC-1…RC-8 frozen render obligations, each backed by a scenario |
| Data Models | ✓ | core-read shapes (Idef0Diagram/DensityVerdict/OutlineRow…) + view-local render-state |
| Errors | ✓ | V-EMPTY / V-FALLBACK / V-ROLLUP / V-DERIVED-ONLY / V-COLLISION / V-UNKNOWN-ROLE, all no-throw |

Validation: PASS — 0 MUST, 0 warnings.

EVID-057 (kind=evidence): `## Structured Fields` present — verdict: supports / **congruence_level: 2 (numeric ✓)** / evidence_type: audit. No CL parse error (the primary R_eff-collapse vector is absent).

## Section coherence

| Check | Coherent | Note |
|---|:-:|---|
| PRD AC ↔ FR / Goals | ✓ | AC-1↔FR-004 (fallback), AC-2↔FR-003 (dense), AC-4↔FR-011 (reuse-not-fork), AC-5↔FR-010 (honesty), AC-7↔FR-006/007 (a11y) |
| PRD ADI outcome ↔ Decision context ↔ EVID-057 | ✓ | H1(chosen)/H2/H3 + null baseline identical across Problem's Decision context, the ADI section, and EVID-057 |
| SPEC scenarios ↔ PRD FR/AC | ✓ | 13 Given/When/Then scenarios; first three are the PRD-mandated minimum (fallback / dense / no-regression) |
| SPEC RC/Data-Models/Errors ↔ SPEC-004 core | ✓ | reads mode/provenance/number/side from the core; re-derives nothing (consumes SPEC-004 INV-5/10) |
| "seven vs 9th" naming | ✓ | Both artifacts consistently say "seven existing views" + "a new view"; no incorrect 8-count asserted |

## Link graph health

| Relation | Source | Target | Status |
|---|---|---|---|
| refines | PRD-034 | EPIC-001 | OK — target active (R_eff 1.0) |
| based_on | PRD-034 | RFC-028 | OK — target active, valid_until null (fresh) |
| informs | EVID-057 | PRD-034 | OK |
| based_on | SPEC-005 | SPEC-004 | OK — target active (R_eff 0.3) |
| based_on/informs | SPEC-005 | PRD-034 | **MISSING** — only outbound edge from SPEC-005 is `based_on SPEC-004`; the "Driving PRD: PRD-034" relationship is prose-only (MEDIUM) |

All four **mandated** links present. The SPEC-005 → PRD-034 render-contract trace exists only in prose; project convention (SPEC-003 → `based_on` → PRD-027) realises it as a graph edge.

## Freshness

- References to active artifacts: EPIC-001 (active), RFC-028 (active, valid_until null), SPEC-004 (active), ADR-006, ADR-007 — all active.
- References to superseded/deprecated artifacts: none.
- Stale reference count: 0.

## R_eff trust

- **PRD-034 R_eff = 0.10** — weakest link RFC-028 (via `based_on` CL penalty). Sole informing EVID is EVID-057 (CL2 audit, score 0.9). Below the ≥0.7 activation band — expected at shape phase.
- **SPEC-005 R_eff = 0.00** — no informing EVID yet (weakest link SPEC-004 `based_on` penalty). Expected: the executable render-conformance EVID lands at build time.
- Linked EVID count: PRD-034 ← 1 (EVID-057); SPEC-005 ← 0.
- Weakest EVID: EVID-057, congruence_level = 2 — appropriate and self-justified in-body (design-time judgement, one step below a running-surface measurement).
- CL parse errors: **none** — EVID-057 `congruence_level` is numeric integer 2.
- Activation note: neither artifact is activatable now (R_eff below gate). This is **by design** — SPARC left all T2 artifacts `draft`; activation is the guardian gate's job after the build-time conformance EVIDENCE (rule 11 / red-line 3). Flagged so the guardian does not activate prematurely, not as a defect.

## Findings (severity-ranked)

- 🟡 MEDIUM: **SPEC-005 § Link graph** — no graph edge to its driving PRD-034. SPEC-005 declares "Driving PRD: PRD-034" and states its scenarios "operationalise its FR-001…FR-011 + AC-1…AC-7", yet its only outbound edge is `based_on SPEC-004`. A reviewer/guardian traversing outward from PRD-034 cannot discover its executable render contract via the graph. Fix: add `SPEC-005 based_on PRD-034` (matches the SPEC-003 → PRD-027 convention).
- 🔵 LOW: **PRD-034 § Functional Requirements** — orphan FRs FR-005/FR-006/FR-008/FR-009/FR-011 are not referenced outside the FR block (validator SHOULD `prd-orphan-frs`). Cross-reference each to its AC (e.g. FR-005 legend↔AC-1, FR-008 theme↔AC-7, FR-009 data-parity↔AC-1) to close the trace.
- 🔵 LOW: **PRD-034 § FR-006 (line 89)** — filler phrase "the system shall allow" (validator SHOULD `prd-filler-phrases`); prefer capability voice ("users can navigate…"). Cosmetic.

(Dismissed, not findings: COULD `prd-fr-format` "use checkbox FRs" is a validator-heuristic mismatch — the `### FR-NNN` + description/priority/AC form is richer and house-consistent. AC-6's "budget = TBD" is an explicitly-deferred number with a named owner/resolution path (RFC-028 Q4 / N=1000 profiling) — a traceable deferral, not a vague AC. EVID-057's CL2 is correct for design-time audit evidence. All checked and cleared.)

## Recommendation

**CONCERNS** — resolve via `artifact-maintainer` before the guardian activation gate:
- Add the missing **SPEC-005 → PRD-034** render-contract link (`based_on`), so PRD-034 traces to its executable render spec through the graph, not only prose.
- (Optional, LOW) close PRD-034's two SHOULD warnings: cross-reference the five orphan FRs to their ACs, and de-filler FR-006.

**Not a BLOCKER**: no missing MUST section, no CL parse error, no broken or stale link, no implementation leakage, Non-Goals correctly fenced. The thin R_eff (0.10 / 0.00) is the expected shape-phase state — the gating follow-on is the build-time SPEC-005 conformance EVIDENCE, after which the **guardian** (not this reviewer) owns activation.

Out of scope for this audit (handed off): whether the dedicated-additive-view design is architecturally the right choice is **architect-reviewer**'s call; correctness of the idef0 render behaviour is proven later by the **SPEC-005 conformance harness** (tester). This audit reviewed form — schema, coherence, links, freshness, R_eff — only.

## Related Artifacts

- **PRD-034** — audited target; this EVID `informs` it (auto-linked on creation).
- **SPEC-005** — co-audited render-conformance spec.
- **EVID-057** — the ADI reasoning evidence already informing PRD-034 (CL2 audit).
- **EPIC-001 / RFC-028 / SPEC-004 / ADR-006 / ADR-007** — parents/context read to verify link correctness and freshness.


