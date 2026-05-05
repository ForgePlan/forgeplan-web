---
depth: standard
id: ADR-007
kind: adr
links:
- target: RFC-008
  relation: based_on
status: active
title: Adopt Kubernetes Operators for tenant lifecycle
---

# ADR-007: Adopt Kubernetes Operators for tenant lifecycle

## Context

Tenant provisioning currently goes through a Terraform pipeline that
generates Helm values, runs `helm upgrade`, and waits for pods. The
flow takes 12–18 minutes per tenant, is brittle (15% failure rate
under concurrent provisioning), and lacks reconcile semantics.
RFC-008 (multi-tenant blast-radius isolation) needs deterministic
tenant lifecycle as a prerequisite.

## Decision

**Selected: build a Helios Tenant Operator (controller-runtime, Go)
that manages a `HeliosTenant` CRD. Operator owns: creation,
configuration, scaling, deletion, and per-tenant network policies.**

**Why selected**: declarative reconcile loop fits multi-tenant lifecycle
naturally; CRD becomes the single source of truth; failure recovery
becomes implicit (operator retries until convergence). Trades 6
weeks of build effort for a 10× reduction in tenant ops toil.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| Status quo (Terraform + Helm) | Rejected | brittle, no reconcile, slow |
| Argo CD application-of-applications | Rejected | wrong abstraction for tenant scope |
| Crossplane | Rejected | better for cross-cloud; overkill for our K8s-only target |
| Custom Operator | **Chosen** | fits domain model; team has experience |

## Consequences

### Positive

- Provisioning latency: 12–18 min → 2 min mean.
- Self-healing: operator reconciles drift without manual intervention.
- Tenant lifecycle becomes auditable via CRD events.

### Negative (trade-offs)

- Operator adds another service to operate (although small: ~3k LoC).
- CRD versioning is a new discipline; team needs to learn conversion
  webhooks.
- Local development experience changes; engineers must run
  `kubectl-helios` plugin to inspect.

### Risks

- Operator pattern has hidden complexity (owner refs, finalizers,
  status subresources). Mitigation: pair-program first 4 weeks with
  an external SME (consultant, 2 days/week).
- CRD schema changes require migration plan for existing tenants.

## Invariants

- Tenants are created exclusively via `HeliosTenant` CRD.
- Direct manual `kubectl edit` on tenant resources is forbidden in
  prod (RBAC enforced).
- Operator runs leader-elected, single replica active.

## Valid Until

`valid_until: 2027-02-15`

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| RFC-008 | RFC | based_on |
| SPEC-005 | Spec | implements (state machine) |


