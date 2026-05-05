---
depth: standard
id: SPEC-015
kind: spec
links:
- target: PRD-016
  relation: refines
status: active
title: API rate limit policy spec
---

# SPEC-015: API rate limit policy spec

## Scopes (in precedence order)

1. **API key** — per-key bucket
2. **Sub-account** — per-sub-account bucket (sum across keys)
3. **Organization** — per-org bucket (sum across sub-accounts)

A request that exceeds ANY tier returns 429.

## Default buckets

| Tier | Sustained | Burst | Window |
|------|-----------|-------|--------|
| Free | 100 RPS | 200 | per-key |
| Paid | 1,000 RPS | 2,000 | per-key |
| Enterprise | configurable | 5× sustained | per-key |

Enterprise plans configure custom limits per-org via control plane.

## Algorithm

Token bucket, per-tier:

```
bucket = min(bucket + refill_rate * dt, max_tokens)
if request_cost <= bucket:
  bucket -= request_cost
  allow
else:
  reject (HTTP 429, Retry-After = (request_cost - bucket) / refill_rate)
```

## Per-endpoint cost

| Endpoint | Cost (tokens) |
|----------|---------------|
| GET /api/v1/list | 1 |
| GET /api/v1/query | 5 |
| POST /api/v1/query | 5 |
| GET /api/v1/audit | 10 |
| POST /v1/traces (ingest) | varies — separate ingest meter |

## Response on 429

```json
{
  "code": "RATE_LIMITED",
  "scope": "api_key",
  "limit": 1000,
  "current": 1024,
  "retry_after_seconds": 1.5
}
```

`Retry-After` header set per RFC 7231.

## Telemetry

- `helios.api.rate_limit.allowed` counter (by scope, tier)
- `helios.api.rate_limit.rejected` counter (by scope, tier)
- `helios.api.rate_limit.bucket_fill_ratio` gauge

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-016 | refines |
| SPEC-014 | informs (org/sub model) |


