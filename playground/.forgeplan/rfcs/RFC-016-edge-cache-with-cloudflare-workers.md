---
depth: standard
id: RFC-016
kind: rfc
links:
- target: PRD-002
  relation: refines
status: deprecated
title: Edge cache with Cloudflare Workers
---

# RFC-016: Edge cache with Cloudflare Workers

## Summary

Cache hot read-only API responses (`/api/list`, dashboard config,
small static assets) at Cloudflare Workers edge. Goal: cut tail
latency for users far from us-east-1; reduce origin CPU.

## Motivation

Dashboard cold load (PROB-005, since fixed via RFC-009 SSR) was
exacerbated by long round-trips for users in EU/APAC. SSR helped;
edge caching could push the next 30%.

## Approach

- Cloudflare Workers in front of `*.helios.io`
- Cache key includes tenant ID + ETag
- Cache invalidation via Workers API on tenant config change
- Bypass cache for authenticated POST/PUT requests

## Cacheable surfaces

| Endpoint | TTL | Cache key |
|----------|-----|-----------|
| `/api/list` | 30 s | tenant + role |
| `/api/dashboards/{id}/config` | 60 s | tenant + dashboard_id + version |
| `/static/*` | 30 d | content hash |

## Risks

- Cloudflare-side outages affect all edge users; origin must handle
  fallback gracefully
- Cache poisoning if tenant boundary leaks into shared cache.
  Mitigation: cache key always includes `tenant_id` + RBAC fingerprint
- Workers free tier limits at 10ms CPU; some routes need paid plan

## Decision

**Adopt for read-only, tenant-scoped, frequently-hit endpoints.**
Not for query API (already has its own cache via SOL-004).

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-002 | refines (tangentially via /api/list) |



