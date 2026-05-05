---
depth: tactical
id: EVID-011
kind: evidence
links:
- target: EPIC-003
  relation: informs
status: active
title: 'Compliance audit: SOC2 Type II readiness gaps'
---

# EVID-011: Compliance audit — SOC2 Type II readiness gaps

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-25 |
| Valid Until | 2026-10-25 |
| Target | EPIC-003 (Self-serve observability for product teams) |
| Author | compliance-program |
| Auditor | A-LIGN, pre-engagement gap assessment |

## Structured Fields

evidence_type: audit
verdict: weakens
congruence_level: 2

## Scope

Pre-SOC2-Type-II readiness review across 5 trust services criteria:
Security, Availability, Processing Integrity, Confidentiality,
Privacy. 6-month observation window planned for 2026-Q3+Q4.

## Gap categories

| TSC | Gaps | Critical |
|-----|------|----------|
| Security | 14 | 3 |
| Availability | 6 | 1 |
| Processing Integrity | 4 | 0 |
| Confidentiality | 9 | 2 |
| Privacy | 5 | 1 |

## Critical gaps (must close before observation start)

1. **CC6.1**: privileged access reviews not on a documented quarterly
   cadence — 2 cycles missed in 2025.
2. **CC7.2**: change management does not consistently link production
   changes to approved RFC/ADR. *Forgeplan adoption directly addresses
   this.*
3. **CC8.1**: incident response runbook is documented but not tested
   on non-Sev-1 cadence.
4. **A1.2**: BCP/DR tabletop has not run in 14 months (target: ≤12).
5. **C1.1**: customer-data classification policy is silent on trace
   payloads (high-cardinality tags may include PII).
6. **P3.1**: data subject access request workflow is manual; SLA risk.

## Recommendations

- 90-day project to close the 7 criticals before observation start
- Adopt Forgeplan as the authoritative change-management trail
  (CC7.2 fully addressed by ADR-* + EvidencePack model)
- Quarterly access review automated via control-plane audit log

## Interpretation

EPIC-003 (self-serve) cannot ship to enterprise plans before the
Confidentiality (C1.1) and Privacy (P3.1) gaps close — those plans
require SOC2 evidence. Roadmap dependency confirmed.

## Congruence Level Justification

CL2: pre-engagement gap review by reputable auditor, but findings
based on document review + 8 control walkthroughs. Final audit
opinion pending observation window.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-003 | informs (gating dependency) |
| EVID-010 | informs (security control evidence) |


