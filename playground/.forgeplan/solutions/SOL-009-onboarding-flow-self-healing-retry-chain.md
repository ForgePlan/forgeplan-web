---
depth: tactical
id: SOL-009
kind: solution
links:
- target: PROB-007
  relation: refines
status: active
title: Onboarding flow self-healing retry chain
---

# SOL-009: Onboarding flow self-healing retry chain

## Problem addressed

PROB-007: 8% of onboarding attempts fail silently. EVID-018 traced
the dominant cause to provisioning hung at "PROVISIONING" state.

## Approach

The Tenant Operator (ADR-007) gains a self-healing layer that:

1. Detects stuck states (no transition in N minutes)
2. Identifies which sub-resource is hung
3. Attempts targeted recovery: retry just that sub-resource
4. If targeted recovery fails 3 times, escalates: full reconciliation
5. If full reconcile also fails, page operator on-call AND notify
   the tenant via email with a request ID for support

## State machine additions

New transient states added to SPEC-005:

```
PROVISIONING ─────► HEALING (transient, retries up to 3 times)
                      │
                      ├─ success ─► PROVISIONING (continues)
                      │
                      └─ exhausted ─► FAILED (with structured reason)
```

## Metrics

- `helios.onboarding.healing.attempted` (by reason)
- `helios.onboarding.healing.recovered` (by attempt #)
- `helios.onboarding.healing.escalated` counter

## SLO

`p95(provisioning_total_duration) < 5 min`. Page on breach.

## Tradeoffs

### Positive
- Eliminates the "silent stuck" failure mode
- Tenant gets actionable notification on truly failed paths

### Negative
- Operator gains an escape hatch that could mask deeper bugs
  (operator must NOT retry blindly — has structured retry policy)
- Healing introduces non-monotonic state transitions; auditors will
  ask why a tenant went from PROVISIONING → HEALING → PROVISIONING

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-007 | refines |
| ADR-007 | informs (operator pattern) |
| EVID-018 | informs |


