---
depth: tactical
id: EVID-044
kind: evidence
links:
- target: ADR-002
  relation: informs
status: active
title: ADR-002 dispatch-claim protocol in force via rule-12
---

---

assigned_number: 44
created: 2026-06-30
id: EVID-044
kind: evidence
predicted_number: 44
slug: evid-adr-002-dispatch-claim-protocol-in-force-via-rule-12
status: draft
title: ADR-002 dispatch-claim protocol in force via rule-12
updated: 2026-06-30

---

# EVID-044: ADR-002 dispatch+claim protocol in force

| Field   | Value                                                                             |
| ------- | --------------------------------------------------------------------------------- |
| Status  | Draft                                                                             |
| Created | 2026-06-30                                                                        |
| Target  | ADR-002 — Sub-agent dispatch must go through forgeplan_dispatch + forgeplan_claim |

## Structured Fields

evidence_type: audit
verdict: supports
congruence_level: 3

## Measurement

Audit of whether ADR-002's `dispatch → claim → execute → release` protocol exists, is documented,
and is exercised — checked against the live workspace + this session's behaviour:

- `.claude/rules/12-forgeplan-agent-dispatch.md` exists and is listed in `.claude/rules/00-index.md`
  (ADR-002 postconditions, E3).
- The protocol was exercised this session: the conformance-audit workflow's reviewer agents claimed
  `RFC-008/009/010` (`forgeplan claims` showed 3 active claims with per-agent identity).
- The orphan-recovery mitigation (ADR-002 Negative trade-off + R2) was applied: those 3 claims were
  released via `forgeplan release <id> --force` after the reviewers crashed on a schema retry-cap;
  `forgeplan claims` → "No active claims" afterwards (E2: active_claim_count == 0).

## Result

- rule-12 exists + indexed → **PASS** (E3).
- rule-12 **hardened** in this change with two additions that close the observed gap:
  1. pre-dispatch step `0. forgeplan_claims` — the next agent checks what is already claimed and by
     whom before taking work (no double-assignment).
  2. a "Claim hygiene — no висяки" section — orchestrator MUST sweep orphaned claims after every
     sprint/workflow and force-release on crash/timeout (not wait for TTL), including read-only
     reviewers that self-claim.
- Protocol exercised + orphans swept this session → **PASS** (E1, E2).

## Interpretation

ADR-002's decision (mandatory dispatch+claim+release for parallel file-writing sub-agents, with
`release --force` as the crash escape hatch) is implemented (rule-12) and now in force. The observed
failure mode — read-only reviewers leaving 3 orphaned claims after a crash — is exactly the
"claim висит до expiry" trade-off ADR-002 anticipated; the mitigation worked, and rule-12 is now
hardened so the orchestrator sweeps proactively instead of relying on TTL. This evidence supports
activating ADR-002 (it was left in `draft` despite its postconditions calling for `active`).

## Congruence Level Justification

<!-- Legend: CL3 same-context (penalty 0.0); CL2 related (0.1); CL1 external (0.4); CL0 opposed (0.9). -->

CL3 — the audit is against the exact surface the decision governs (the rule file + the live
`forgeplan claims` state in this workspace/session). Same context, audit evidence.

## Related Artifacts

| Artifact | Relation |
| -------- | -------- |
| ADR-002  | informs  |


