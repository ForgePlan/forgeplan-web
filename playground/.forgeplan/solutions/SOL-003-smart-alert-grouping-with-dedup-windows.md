---
depth: tactical
id: SOL-003
kind: solution
links:
- target: PROB-003
  relation: refines
status: active
title: Smart alert grouping with dedup windows
---

# SOL-003: Smart alert grouping with dedup windows

## Problem addressed

PROB-003 (alert fatigue) — duplicate firing across services and
time windows accounts for 40% of silenced alerts (EVID-005).

## Approach

Introduce a grouping layer between rule evaluation and delivery:

```
[ rule eval ] ──fired alerts──> [ grouping layer ] ──grouped alerts──> [ delivery ]
                                       ▲
                                       └── dedup_window: 5m (default)
                                       └── group_by: [alertname, service]
```

Tenants configure:
- `dedup_window`: 1m / 5m / 15m / 30m
- `group_by`: list of label keys
- `repeat_interval`: how often to re-fire if condition still true (default 4h)

## Grouping algorithm

1. For each fired alert, compute `group_key = hash(alertname || group_by_values)`
2. If `group_key` exists in window-keyed cache: append to group's
   members, reset member dedup timer
3. If new: create group, schedule first delivery after `dedup_window`
   (collects more members)
4. Deliver: a single notification with `group_key` and member list

## Alert payload format

```json
{
  "alertname": "HighErrorRate",
  "group_key": "alertname:HighErrorRate;service:checkout",
  "status": "firing",
  "members": [
    { "instance": "checkout-1", "fired_at": "..." },
    { "instance": "checkout-2", "fired_at": "..." },
    { "instance": "checkout-3", "fired_at": "..." }
  ],
  "first_fired": "...",
  "summary": "HighErrorRate firing on 3 instances of checkout"
}
```

## Tradeoffs

### Positive
- Targets the #1 unprompted ask in EVID-005 (11/12 SREs)
- Reduces alert volume by ~60% in simulations on prod data
- Backwards compatible: tenants who don't configure grouping see
  no change

### Negative
- Adds 5-min delivery latency by default for grouped alerts (configurable)
- Alert UI must show grouping; existing single-alert views must
  understand the new shape

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-003 | refines |
| EVID-005 | informs |
| PRD-003 | refines |


