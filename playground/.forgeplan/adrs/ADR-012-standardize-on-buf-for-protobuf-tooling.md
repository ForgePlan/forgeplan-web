---
depth: standard
id: ADR-012
kind: adr
links:
- target: ADR-002
  relation: informs
status: active
title: Standardize on Buf for protobuf tooling
---

# ADR-012: Standardize on Buf for protobuf tooling

## Context

ADR-002 chose gRPC for internal service mesh. Tooling around protobuf
(linting, breaking-change detection, code generation) was a hand-rolled
pipeline using `protoc` directly. The setup was brittle (8-step
Makefile per service); breaking changes occasionally landed without
detection.

## Decision

**Selected: Buf CLI as the single tool for protobuf operations across
the monorepo. `buf.yaml` and `buf.gen.yaml` per package; CI gates on
`buf lint` + `buf breaking`.**

**Why selected**: Buf consolidates protoc, lint, breaking-change
detection, codegen, and registry into one tool. Strong community,
backwards-compatible with existing `.proto` files.

## Alternatives Considered

| Option | Verdict |
|--------|---------|
| Status quo (protoc + Makefiles) | Rejected — brittle, non-uniform |
| Buf | **Chosen** |
| Bazel for protobuf | Rejected — overkill at our scale |
| gRPC-Go's own tools | Rejected — TypeScript clients not first-class |

## Consequences

### Positive
- One tool, one configuration, one CI step
- `buf breaking` blocks consumer-breaking changes pre-merge
- Buf Schema Registry (BSR) considered for future cross-team `.proto`
  publishing

### Negative
- Locked in to Buf's view of protobuf; if Buf disappears we'd
  reverse-engineer (probably fine; the ecosystem is still proto)
- New tool for engineers to learn, though docs are excellent

## Invariants

- All `.proto` files live under `proto/` in the monorepo
- CI runs `buf lint` + `buf breaking` against main branch on every PR
- Generated code is committed (not regenerated in CI for prod artifacts)

## Valid Until

`valid_until: 2027-04-22`

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| ADR-002 | informs (gRPC choice) |


