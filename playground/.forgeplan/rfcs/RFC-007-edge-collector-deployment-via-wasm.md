---
depth: standard
id: RFC-007
kind: rfc
links:
- target: PRD-001
  relation: refines
status: deprecated
title: Edge collector deployment via Wasm
---

# RFC-007: Edge collector deployment via Wasm

## Summary

Deploy Helios edge collectors as WebAssembly modules running inside
proxy infrastructure (Envoy, Cloudflare Workers, Fastly Compute@Edge)
in addition to native Rust binaries. Wasm distribution lowers
deployment friction for customers running edge proxies.

## Motivation

Mid-market customers run Envoy or Cloudflare Workers but resist
adding "yet another sidecar". Wasm modules drop into existing edge
infra without new pods.

## Goals

- One Rust crate compiles to native + wasm32-wasi target
- Wasm version achieves ≥ 70% of native throughput per CPU
- Module is < 4 MB (cold start budget on edge platforms)

## Options

| Option | Pros | Cons |
|--------|------|------|
| Native sidecar only (status quo) | Performance | Deploy friction |
| Wasm only | Maximum reach | Performance ceiling |
| Native + Wasm (chosen) | Both audiences served | Build complexity |

## Risks

- R-1: Wasm module size bloat. Mitigation: feature flags to drop
  optional codecs; aggressive `--release --strip`.
- R-2: Async I/O model in Wasm is constrained. Mitigation: target
  platforms support `wasi-http`; degrade to polling where needed.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-001 | refines |
| ADR-004 | based_on |



