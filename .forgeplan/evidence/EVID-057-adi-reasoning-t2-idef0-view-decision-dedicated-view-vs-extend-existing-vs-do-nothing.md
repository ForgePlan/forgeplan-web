---
depth: standard
id: EVID-057
kind: evidence
last_modified_at: 2026-07-01T17:46:06.046834+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-034
  relation: informs
status: active
title: 'ADI reasoning: T2 idef0 view decision (dedicated view vs extend-existing vs do-nothing)'
---

## Summary

This EvidencePack records the **design-time ADI reasoning** that justifies PRD-034's decision to build the T2 `idef0` surface as a **dedicated, additive view** rather than extending an existing view or doing nothing. It is reasoning/audit evidence (not a test or measurement yet) — the executable proof (the SPEC-005 render scenarios + the T1 conformance harness) lands later and will be its own EVIDENCE at build time. Captured here so the decision is attributable and auditable before any code is written.

- **Source**: `forgeplan_reason PRD-034` — FPF ADI cycle (Abduction → Deduction → Induction), model `gemini-3-flash-preview` (gemini), 2026-07-01.
- **Subject**: PRD-034 "Standalone idef0 decomposition view" (EPIC-001 T2 track, Phase 2 / GATE-A).
- **Author identity**: claude-code/opus-4.8/specification-task-t2-idef0-view.

## Decision under evaluation

How to render the shipped-but-headless T1 decomposition core (RFC-028: `deriveIdef0 → { forest, diagram, verdict, outline, signature }`, non-null diagram in both modes)? Three alternatives were weighed, including the mandated "reuse an existing view" and "do nothing" options.

## Hypotheses (Abduction) — 3 genuinely-considered

- **H1 — Dedicated additive view.** A new selectable view that consumes the T1 core and renders the outline + one-level ICOM diagram in its own surface.
  - Assumptions: the view switcher is extensible without refactoring; the headless core carries enough metadata (number/side/provenance — SPEC-004 INV-10) to lay out without back-channel geometry.
  - Confidence: **High** — aligns directly with reuse-not-fork (Outcome 5) and no-regression (Goal 4).
- **H2 — Reuse / extend an existing hierarchical view (Tree or Sunburst).** Add an "idef0/ICOM mode" toggle to an existing view instead of a new entry.
  - Assumptions: existing hierarchical render logic can accommodate side-based ICOM arrow placement; users prefer internal toggles to a new top-level entry.
  - Confidence: **Low** — high risk of regressing the seven existing views (a must-not per Goal 4 / AC-3) and forces a fork of the existing render logic (violates AC-4 reuse-not-fork).
- **H3 — Headless-to-overlay side-panel.** Render the decomposition as a contextual panel/modal opened from a selection in any of the 7 existing views.
  - Assumptions: the altitude-ordered outline compresses into a side-panel; the core tolerates frequent context-shifted focus requests.
  - Confidence: **Medium** — aids discovery but loses the standalone top-down altitude reading (Goal 1) and cannot fit FR-002 in constrained panel space; strategically misaligned with "standalone".

**Null baseline — do nothing.** Leave the core headless and defer any surface. Rejected: delivers zero user value, blocks GATE-A, and leaves Outcomes 5 + 6 unproven end-to-end. This is the baseline the chosen option must beat.

## Deduction (consequences + feasibility)

- **H1**: clean separation of concerns — the new view can window its outline (NFR-001) without adding DOM weight to Force/Sankey; honesty (solid/dashed) is cleanest in a clean-slate surface where it cannot collide with existing graph styling. Residual risks: switcher bloat and possible layout-logic duplication if SPEC-004/INV-10 is not strictly followed. Feasibility **High** — the core is frozen (SPEC-004) and already supplies `verdict` + `outline` + non-null `diagram`.
- **H2**: significant increase in the cyclomatic complexity of the existing hierarchical component, likely requiring a fork of its rendering; risks breaking existing hierarchical rendering for non-idef0 projects. Feasibility **Low** — directly contradicts no-regression + pure-consumer goals.
- **H3**: the user loses the whole-project top-down perspective (Goal 1) as the decomposition becomes secondary to the primary graph; cannot satisfy FR-002 in a constrained panel. Feasibility **Medium** — technically possible, strategically misaligned.

## Induction (recommendation)

**Proceed with H1 (dedicated additive view).** It is the only approach that guarantees zero regression of the existing views (AC-3) while fulfilling the mandate to prove the T1 core renderable (Outcome 5) without forking, and the honesty requirements (FR-010 / AC-5) are most cleanly satisfied in a clean-slate view where dashed/solid logic does not conflict with existing graph styling. Confidence **High** — the PRD is tightly coupled to the frozen RFC-028/SPEC-004 core, and H1 is the intended architectural path for EPIC-001 Phase 2.

## How this sharpened PRD-034

Two ADI-flagged evidence needs were folded into the acceptance criteria (not left implicit):

1. **Switcher capacity** — verify the view switcher accepts the new entry without CSS overflow / layout breakage → folded into **AC-3** (no-regression now also asserts switcher-layout integrity).
2. **N=1000 profiling** — profile the windowed outline pane at N=1000 to fix the TBD interactive frame budget → folded into **AC-6 / NFR-001** (budget explicitly TBD, fixed by this profiling; bound to RFC-028 Q4 / T1 NFR-002).

The rejected alternatives (H2 reuse-existing, H3 overlay, and the do-nothing baseline) are recorded in PRD-034's Decision context so the same ground is not re-litigated downstream.

## Scope / limits of this evidence

- This is **reasoning/audit** evidence, not a test or measurement. It supports the *choice* of approach; it does **not** prove the view renders correctly — that proof is the SPEC-005 render scenarios executed at build time (a future EVIDENCE).
- It does not, and must not, be used to activate PRD-034: activation requires the build-time conformance EVIDENCE (executable) and is owned by the guardian gate + orchestrator (rule 11). All three T2 artifacts remain `draft`.
- Congruence is CL2 (not CL3): the reasoning is about the *same* subject (the T2 view decision) and the same frozen core contract, but it is design-time judgement rather than a measurement against the running surface — hence one step below same-context test/measurement evidence.

## Structured Fields

verdict: supports
congruence_level: 2
evidence_type: audit

## Related Artifacts

- **PRD-034** — the decision this evidence supports; `informs` (auto-linked on creation).
- **EPIC-001** — parent epic (Outcomes 4/5/6, GATE-A) whose constraints the ADI weighed.
- **RFC-028 / SPEC-004 / ADR-006 / ADR-007** — the frozen T1 core contract the decision is coupled to.
- **SPEC-005** — the view-level render scenarios that will produce the executable follow-on evidence.
- **Provenance**: `forgeplan_reason PRD-034` (gemini-3-flash-preview, 2026-07-01).


