---
depth: standard
id: SPEC-010
kind: spec
links:
- target: PRD-009
  relation: refines
status: active
title: Anomaly rule DSL grammar
---

# SPEC-010: Anomaly rule DSL grammar

## Surface

Extends SPEC-004 (alert rule DSL) with `auto` and `expected` constructs.

## Grammar additions (EBNF)

```ebnf
auto_rule ::= "auto" service_selector ("model" model_id)? ("baseline" duration)?
expected  ::= "expected" "{" condition+ "}"
condition ::= time_window operator value
```

## Examples

```dsl
auto checkout-svc

auto orders-svc
  model seasonal_hybrid_esd
  baseline 14d

auto auth-svc
  expected {
    window: hour < 1
    rps: < 100
  }
```

`auto` enables auto-detection on a service. `expected` describes
known-quiet patterns the detector should NOT fire on.

## Validation rules

- `service_selector` must match an existing service in tenant's catalog
- `baseline` MUST be ≥ 14d (training period)
- `expected` conditions are conjunctive
- Tenant cap: 5,000 auto-rules

## Default behaviour

If no `auto` rule exists for a service, no auto-detection runs. This
is opt-in by design (PRD-009 SC-1).

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-009 | refines |
| SPEC-004 | extends |


