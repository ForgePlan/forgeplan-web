---
depth: standard
id: SPEC-005
kind: spec
links:
- target: PRD-007
  relation: refines
status: active
title: Tenant provisioning state machine
---

# SPEC-005: Tenant provisioning state machine

## States

```
PENDING ─────┐
   │         │
   ▼         │
PROVISIONING │
   │         │
   ▼         │
   │  ┌──── FAILED ◄── (any state on error)
   ▼  │
ACTIVE
   │
   ▼
SUSPENDING
   │
   ▼
SUSPENDED
   │
   ▼
DECOMMISSIONING
   │
   ▼
DECOMMISSIONED (terminal)
```

## Transitions

| From | To | Trigger | Validation |
|------|-----|---------|------------|
| (none) | PENDING | `CreateTenant` API | name available, plan valid |
| PENDING | PROVISIONING | operator picks up | quota check passes |
| PROVISIONING | ACTIVE | all sub-resources ready | health checks green |
| PROVISIONING | FAILED | sub-resource creation timeout | timeout > 15 min |
| ACTIVE | SUSPENDING | admin action or non-payment | confirmation required |
| SUSPENDING | SUSPENDED | ingest stopped, queries blocked | grace 30s |
| SUSPENDED | ACTIVE | admin reactivation | payment / verification |
| ACTIVE | DECOMMISSIONING | admin deletion | 30-day grace period |
| DECOMMISSIONING | DECOMMISSIONED | data purged, infra removed | audit log retained |
| FAILED | (recovery via operator retry) | operator retries N=3 | backoff |

## Sub-resources owned by tenant

- ClickHouse database + tables
- Kafka/Redpanda topics + consumer groups
- S3 bucket prefix for cold tier
- IAM role for cross-account exports
- Per-tenant K8s namespace (if isolated tier)
- Network policies

## Invariants

- DECOMMISSIONED is terminal — no transition back
- SUSPENDED preserves all data; reactivation is idempotent
- FAILED is recoverable for 7 days; auto-DECOMMISSIONED after

## Audit

Every transition emits a `TenantStateTransition` event to the
audit log. Events retained 7 years (compliance requirement).

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-007 | refines |
| ADR-007 | informs (operator pattern) |


