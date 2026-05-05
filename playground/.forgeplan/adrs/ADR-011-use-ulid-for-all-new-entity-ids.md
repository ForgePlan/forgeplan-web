---
depth: standard
id: ADR-011
kind: adr
links:
- target: SPEC-014
  relation: informs
status: active
title: Use ULID for all new entity IDs
---

# ADR-011: Use ULID for all new entity IDs

## Context

Helios entity IDs (tenant_id, alert_id, dashboard_id, etc.) currently
mix UUID4 (services in TypeScript) and KSUID (services in Go). The
inconsistency causes friction in cross-service joins and debugging.
ULID has the sortability of KSUID with broad library support.

## Decision

**Selected: ULID (Crockford base32, 26 chars) as the standard ID
format for all new entities. Existing UUID4 / KSUID IDs remain
unchanged; new entities created in any service use ULID.**

**Why selected**: monotonic time-ordered prefix → trivial range
queries by creation time; URL-safe; case-insensitive; broad library
support across languages.

## Alternatives Considered

| Option | Verdict |
|--------|---------|
| Stay UUID4 (random) | Rejected — no time ordering |
| KSUID | Rejected — fewer libraries; alphabet inconsistency with ULID |
| ULID | **Chosen** |
| Custom (Snowflake-style) | Rejected — operational complexity |

## Consequences

### Positive
- Time-ordered IDs simplify range queries and pagination
- 26-char Crockford alphabet looks cleaner in URLs and logs
- Dual-stack with existing UUID4/KSUID is acceptable; old IDs still work

### Negative
- Two ID formats coexist for years; consumers must accept both
- 128-bit space same as UUID; randomness in last 80 bits — collisions
  effectively impossible at our rate

## Invariants

- New entity tables use ULID column type (CHAR(26))
- ID generation always server-side (no client-supplied IDs)
- ULID timestamp prefix is the source of truth for creation time
  (no separate created_at column for new entities)

## Valid Until

`valid_until: 2028-05-05`

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| SPEC-014 | informs (tenant hierarchy IDs) |


