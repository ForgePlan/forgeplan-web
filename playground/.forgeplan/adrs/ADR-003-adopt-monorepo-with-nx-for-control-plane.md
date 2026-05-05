---
depth: standard
id: ADR-003
kind: adr
links:
- target: EPIC-001
  relation: informs
status: active
title: Adopt monorepo with Nx for control plane
---

# ADR-003: Adopt monorepo with Nx for control plane

## Context

Helios control plane began as 3 services in 3 repos (2024). By 2026-Q1
we ran 7 services across 7 repos with shared TypeScript types,
generated proto clients, and a shared UI component library. CI was
duplicating identical lint/test/build pipelines in each repo;
cross-cutting refactors required 5+ PRs to land atomically.

## Decision

**Selected: monorepo (`helios-platform`) with Nx for build graph,
caching, and affected-projects detection. Polyrepo retained for
data plane Rust services only.**

**Why selected**: shared types and codegen become trivial; CI cost
drops with affected-detection; atomic cross-cutting changes possible.
Nx chosen over Turborepo because of its plugin ecosystem (we use
@nx/jest, @nx/eslint, custom executors for proto codegen).

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| Stay polyrepo | Rejected | duplicate CI; cross-cutting refactors painful |
| Lerna | Rejected | maintenance mode; weaker affected-detection |
| Turborepo | Rejected | thinner plugin ecosystem at our needs |
| Nx | **Chosen** | strong build graph + plugins + community |
| Bazel | Rejected | overkill at current size; steep learning curve |

## Consequences

### Positive

- 38% CI cost reduction observed in first month (Nx remote cache).
- Codegen: proto → TS clients in single graph; no version drift.
- Atomic refactors land in one PR.

### Negative (trade-offs)

- All control-plane engineers must learn Nx vocabulary (project, target,
  executor, generator). 2-week ramp-up observed.
- IDE workspace size: 1.2 GB after install; some VS Code extensions
  struggle (Pylance specifically had a memory leak; removed).
- Single repo means single CODEOWNERS surface; per-service ownership
  enforced via path patterns.

### Risks

- Repo grows beyond ~3M LoC: need to evaluate sharding into multiple
  workspaces.
- Nx is dependent on a single vendor (Nrwl); mitigation by keeping
  custom executors minimal.

## Invariants

- All TypeScript control-plane services live in this repo
- Shared types live exactly once (in `libs/shared/types`)
- Generated code (proto, OpenAPI clients) is committed (not regenerated
  on each install) for deterministic builds

## Valid Until

`valid_until: 2027-03-01`

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| EPIC-001 | Epic | informs |


