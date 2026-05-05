---
depth: standard
id: RFC-009
kind: rfc
links:
- target: PRD-008
  relation: refines
status: active
title: 'Dashboard rendering: SSR vs CSR tradeoffs'
---

# RFC-009: Dashboard rendering — SSR vs CSR tradeoffs

## Summary

The Helios dashboard renders critical paths (login, alert list, query
view) via Server-Side Rendering (SSR). Heavy interactive components
(force-directed graph, dashboard editor) are Client-Side Rendered
(CSR) and lazy-loaded.

## Motivation

PROB-005: dashboard cold load > 8s on large tenants. Top contributors:
600 KB of JavaScript before first paint, plus a /api/list call that
blocks the whole bundle.

## Goals

- First contentful paint < 1.5s on cold load (4G network simulation)
- Critical paths usable without JS for accessibility
- Heavy interactive components don't block above-the-fold render

## Decision matrix

| Path | Strategy | Why |
|------|----------|-----|
| Login | SSR | small, critical, no interactivity |
| Alert list | SSR + island hydration | mostly read; ack action via form post |
| Query view | SSR shell + CSR results | interactive but slow data fetch |
| Service map | CSR (lazy) | heavy WebGL graph |
| Dashboard editor | CSR | drag-drop, complex state |

## Implementation

- SvelteKit `+page.server.ts` for SSR data
- `client:idle` hydration for islands
- Dynamic import for heavy CSR (`lazy(() => import(...))`)
- Service Worker caches SSR shells offline-first

## Risks

- R-1: SSR latency under load. Mitigation: edge caching for tenant-
  agnostic paths; per-tenant shell cached at edge with 30s TTL.
- R-2: Hydration mismatch bugs. Mitigation: hydration error reporter
  on client; fail to CSR fallback gracefully.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-008 | refines |
| PROB-005 | informs |


