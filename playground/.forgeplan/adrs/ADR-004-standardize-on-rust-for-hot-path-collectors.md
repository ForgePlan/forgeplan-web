---
depth: standard
id: ADR-004
kind: adr
links:
- target: RFC-007
  relation: based_on
status: active
title: Standardize on Rust for hot-path collectors
---

# ADR-004: Standardize on Rust for hot-path collectors

## Context

Helios collectors ingest spans from customer infrastructure and
forward to the central ingest pipeline. Hot path requirements:
- 50k–500k spans/sec per pod
- p99 ingest latency < 5ms
- Memory footprint < 1 GB at sustained load
- Single static binary deployment (no JVM, no GC pauses)

Previous Go-based prototype hit 60k spans/sec with 18% GC time.

## Decision

**Selected: Rust (stable channel, MSRV pinned to 1.78) with tokio
runtime for all hot-path collector code. Go retained for control-plane
auxiliary services where compile-time and ecosystem matter more than
hot-path perf.**

**Why selected**: predictable latency (no GC pauses), single static
binary, mature async ecosystem (tokio + tower + hyper). Type system
catches concurrency bugs at compile time.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| Go | Rejected | GC pauses observed at p99.9 in prototype |
| Rust | **Chosen** | predictable latency, static binary, ecosystem |
| C++ | Rejected | productivity, memory safety, build complexity |
| Zig | Rejected | not 1.0 yet; ecosystem too thin |

## Consequences

### Positive

- p99 ingest latency 2.1 ms vs Go prototype's 8.4 ms.
- Memory footprint 280 MB vs Go's 510 MB at same load.
- Compile-time concurrency safety has prevented 3 known classes of bugs.

### Negative (trade-offs)

- Hiring pool smaller than Go. Mitigated: 2 paid 6-week onboarding
  programs in 2025; team self-rates 7/10 at year mark.
- Compile times painful (full clean: 8 min). Mitigated by sccache.
- Async ergonomics steep; pin lifetimes are a perennial source of PR
  ping-pong.

### Risks

- Tokio LTS story not as strong as we'd like; major upgrades require
  careful auditing.
- Some enterprise customers run platforms (older RHEL) where modern
  glibc is missing; we ship `--target x86_64-unknown-linux-musl`
  binaries to dodge that.

## Invariants

- Hot path stays Rust; control-plane services may be TypeScript or Go
- MSRV bumps require ADR refresh
- All public Rust crates have `#![forbid(unsafe_code)]` unless
  justified by an in-file comment

## Valid Until

`valid_until: 2027-05-05`

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| RFC-007 | RFC | based_on (Wasm edge collector still Rust) |


