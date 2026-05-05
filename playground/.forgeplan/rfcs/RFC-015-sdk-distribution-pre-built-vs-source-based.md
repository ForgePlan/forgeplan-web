---
depth: standard
id: RFC-015
kind: rfc
links:
- target: PRD-014
  relation: refines
status: active
title: 'SDK distribution: pre-built vs source-based'
---

# RFC-015: SDK distribution — pre-built vs source-based

## Summary

For PRD-014 (Node.js SDK), decide whether to ship pre-built tarballs,
source via npm, or both. Decision: **npm-published source with no
native bindings**, single package, plug-and-play.

## Options

| Option | Pros | Cons |
|--------|------|------|
| Pre-built (multiple platforms) | No customer build step | Native binding maintenance |
| Source via npm (chosen) | Zero ops on our side | Customer's `npm install` must succeed |
| Both | Belt-and-suspenders | 2× docs, 2× CI |

## Decision

**npm-published source.** No native bindings; everything pure JS/TS.
Performance impact measured in EVID-017 (under 5% overhead at p99
in v0.2). Customer's npm tooling handles the rest.

## Why not native bindings

- Each platform (linux-x64, linux-arm64, darwin-arm64, win-x64) needs
  prebuilds; extra CI burden
- Customer environments vary widely (Alpine, Lambda, Bun, etc.); broken
  binaries are a top support driver in our previous SDK attempt (2024)
- Pure JS/TS is easier to debug for both us and customers

## Risks

- Pure JS perf ceiling. Mitigation: EVID-017 confirmed acceptable at
  current target workload; revisit if hot-loop customers materialise
- Bundle size; current draft is 380 KB minified+gzipped. Acceptable
  for server-side (no concern for browser users — separate SDK)

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-014 | refines |


