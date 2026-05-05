---
depth: standard
id: RFC-019
kind: rfc
links:
- target: EPIC-001
  relation: informs
- target: ADR-009
  relation: supersedes
status: superseded
title: 'Background job runner: Sidekiq vs custom'
---

# RFC-019: Background job runner — Sidekiq vs custom

## Summary

We have 4 services with custom job runners. Each implements its own
durability, retry, and monitoring. RFC-019 evaluates options for
unification. Decision: **Temporal** (covered in ADR-009).

## Why this RFC exists separately

ADR-009 records the decision; this RFC records the comparison that
fed it. RFCs decay slower than ADRs; future readers can quickly find
the alternatives without re-tracing the original spec.

## Comparison

| Option | Durability | Multi-language | Op cost | Determinism |
|--------|-----------|-----------------|---------|-------------|
| Sidekiq (Ruby-only) | strong | no (Ruby) | low | n/a |
| BullMQ (Node) | medium | partial | low | n/a |
| Temporal (chosen) | strong | yes (TS, Go, Java, Python) | medium | strong |
| Custom Postgres-based | strong | DIY | high | DIY |
| AWS Step Functions | strong | yes (any) | low | strong |

## Selection criteria

1. Multi-language — we have TypeScript and Go services
2. Determinism — workflows must be replayable for debugging
3. Self-hostable — no vendor lock for cross-region rollout
4. Active community

Sidekiq fails (1). Step Functions fails (3). Temporal wins all.

## Risks captured in ADR-009

See ADR-009 § Consequences.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| ADR-009 | based_on |



