---
depth: standard
id: SPEC-004
kind: spec
links:
- target: PRD-003
  relation: refines
status: active
title: Alert rule DSL grammar
---

# SPEC-004: Alert rule DSL grammar

## Grammar (EBNF)

```ebnf
rule           ::= "alert" name "if" expr ("for" duration)? labels? annotations?
name           ::= identifier
expr           ::= promql_expression
duration       ::= integer ("s"|"m"|"h"|"d")
labels         ::= "labels" "{" (kv ("," kv)*)? "}"
annotations    ::= "annotations" "{" (kv ("," kv)*)? "}"
kv             ::= identifier ":" string_literal
identifier     ::= [a-zA-Z_][a-zA-Z0-9_]*
string_literal ::= '"' [^"]* '"'
```

## Example

```alert
alert HighErrorRate
if   sum(rate(helios_span_count{status_code="ERROR"}[5m])) by (service)
   / sum(rate(helios_span_count[5m])) by (service)
   > 0.05
for  10m
labels      { severity: "page", team: "platform" }
annotations { summary: "{{$labels.service}} error rate > 5%",
              runbook: "https://wiki/runbooks/error-rate" }
```

## Semantics

- `expr` MUST evaluate to a vector or scalar; matrix expressions
  rejected with parse error.
- `for` duration: alert fires only after expression has been true
  continuously for that duration. Default: 0 (immediate).
- `labels`: merged with auto-injected labels (`alertname`, `tenant_id`).
- `annotations`: support Go template syntax with `$labels` and `$value`.

## Validation rules

- Rule name MUST be unique per tenant
- `for` duration MUST be ≤ 24h
- `labels.severity` MUST be one of: `page`, `ticket`, `info`
- Total rules per tenant capped at 10,000

## Lifecycle

- `draft` → `enabled` → `disabled`
- `enabled` rules evaluated every 30s
- `disabled` rules retained but not evaluated; deletion is opt-in

## Versioning

Grammar v1 frozen at this spec. New constructs (e.g., multi-window
expressions) ship in v2 behind `dsl_version` field on the rule
resource.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-003 | refines |
| SPEC-006 | complements (delivery) |


