---
depth: standard
id: ADR-013
kind: adr
links:
- target: EPIC-002
  relation: informs
status: deprecated
title: Adopt Pulumi for infrastructure as code
---

# ADR-013: Adopt Pulumi for infrastructure as code

## Context

Helios infrastructure currently spans Terraform modules (legacy AWS),
hand-managed K8s YAML (control plane), and custom Bash for some glue.
This was tractable at one region; for EPIC-002 (multi-region) we need
infrastructure to be testable, reusable, and version-controlled in
the same languages we already use.

## Decision

**Selected: Pulumi (TypeScript flavour) for all new infrastructure.
Terraform retained for the resources it owns until they're naturally
replaced; no big-bang migration.**

**Why selected**: real programming language (vs HCL); shared types
between app code and infra code; supports all our cloud providers
plus K8s natively; same monorepo as the apps.

## Alternatives Considered

| Option | Verdict |
|--------|---------|
| Stay Terraform (HCL) | Rejected — language ceiling, no real abstraction |
| Pulumi (TypeScript) | **Chosen** |
| AWS CDK | Rejected — not multi-cloud (we use GCP for ML pipelines) |
| Crossplane | Rejected — wrong abstraction for our state |

## Consequences

### Positive
- Multi-region rollout in EPIC-002 expressible as a TypeScript loop
  over regions, not 3× duplicated YAML
- IDE support, refactoring, testing — all language-native
- Type-safe references between resources

### Negative
- State backend cost: Pulumi Cloud OR self-host (we picked self-host
  on S3+DynamoDB to avoid vendor data-residency complications)
- Migration toil for existing Terraform; doing it lazily

## Invariants

- All NEW infrastructure resources defined in Pulumi
- State backend: encrypted S3 + DynamoDB lock (per region)
- No imperative Bash in the deployment path

## Valid Until

`valid_until: 2027-05-05`

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-002 | informs |



