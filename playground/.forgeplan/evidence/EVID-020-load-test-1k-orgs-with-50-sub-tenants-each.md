---
depth: tactical
id: EVID-020
kind: evidence
links:
- target: SPEC-014
  relation: informs
status: active
title: 'Load test: 1k orgs with 50 sub-tenants each'
---

# EVID-020: Load test — 1k orgs with 50 sub-tenants each

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-05-04 |
| Valid Until | 2026-08-04 |
| Target | SPEC-014 (Multi-account hierarchy data model) |
| Author | sre-platform |

## Structured Fields

evidence_type: test
verdict: weakens
congruence_level: 3

## Setup

Provisioned synthetic 1,000 orgs × 50 sub-tenants (= 50,000 total
sub-tenants) on staging. Ran realistic admin operations:

- 100 tenant lifecycle ops/min (create, suspend, archive)
- 500 RBAC checks/sec on cross-tenant queries
- 2,000 concurrent admin dashboard sessions

Goal: verify SPEC-014 holds at projected 2027 scale.

## Result

| Metric | Target | Observed | Verdict |
|--------|--------|----------|---------|
| Tenant create p95 | < 60s | 84s | **fail** |
| RBAC check p99 | < 50ms | 220 ms | **fail** |
| Org-tree traversal p95 | < 200ms | 110 ms | pass |
| Storage size for 50k tenants | < 200 GB | 142 GB | pass |

## Investigation

Tenant create p95 regression: provisioning operator's leader-elect
queue serialises operations beyond 50 concurrent. Need worker-pool
parallelism per leader (RFC-018 covers).

RBAC check p99: query plan does a full hierarchy scan when claim
includes `ancestor=*`. Needs materialised closure table (covered
in SPEC-014 v2).

## Interpretation

SPEC-014 needs revision before PRD-016 GA. Two fixes identified;
both look straightforward but require explicit work. Block GA on
re-test passing.

## Congruence Level Justification

CL3: synthetic provisioning load on real production-equivalent
control plane; realistic admin op mix.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| SPEC-014 | informs (gaps to fix) |
| PRD-016 | informs (GA blocker) |


