---
depth: standard
id: ADR-009
kind: adr
links:
- target: RFC-019
  relation: based_on
status: active
title: Adopt Temporal for long-running workflows
---

# ADR-009: Adopt Temporal for long-running workflows

## Context

We have 4 services running custom job runners with bespoke retry logic,
durable state, and timeouts. Three classes of workflow: (1) tenant
provisioning state machine (15-step process, 12-min mean), (2) data
exports (DSAR, often 1–4h), (3) compaction/migration jobs (hours to
days). RFC-019 evaluated alternatives.

## Decision

**Selected: Temporal (self-hosted) for all new long-running workflows.
Existing custom job runners migrate opportunistically.**

**Why selected**: durable execution as first-class primitive; SDK in
TypeScript and Go matches our stack; battle-tested at scale.

## Alternatives Considered

| Option | Verdict |
|--------|---------|
| Sidekiq (with our own durability layer) | Rejected — re-implementing Temporal poorly |
| AWS Step Functions | Rejected — vendor lock; cross-region complexity |
| Cadence (Uber) | Rejected — Temporal is the actively-developed fork |
| Temporal | **Chosen** |
| Custom built on Postgres | Rejected — high build/maintain cost |

## Consequences

### Positive
- Workflow-as-code with deterministic replay; debugging is straightforward
- Activity retry / timeout / heartbeat semantics are first-class
- Operations: one cluster runs all workflows for all services

### Negative
- New dependency to operate (Postgres + Cassandra + workers)
- Workflow code MUST be deterministic; subtle bugs (e.g. `Date.now()`)
  surface at replay time
- SDK upgrade cadence requires coordinated worker version bumps

## Invariants

- Workflow code uses Temporal SDK primitives only (no direct DB calls
  outside Activity boundaries)
- Activities are idempotent (signed by sequence number where applicable)
- Workflow versioning uses `getVersion` for backwards-compat changes

## Valid Until

`valid_until: 2027-05-05`

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-019 | based_on |
| SPEC-005 | informs (provisioning state machine) |


