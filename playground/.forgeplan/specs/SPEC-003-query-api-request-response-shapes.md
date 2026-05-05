---
depth: standard
id: SPEC-003
kind: spec
links:
- target: PRD-002
  relation: refines
status: active
title: Query API request/response shapes
---

# SPEC-003: Query API request/response shapes

## Endpoint

`POST /api/v1/query`
`POST /api/v1/query_range`

Authenticated via Bearer JWT (scope: `query:read`).

## Request — query (instant)

```json
{
  "query": "rate(helios_span_count{service=\"checkout\"}[1m])",
  "time": "2026-04-22T14:30:00Z",
  "timeout_ms": 5000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | PromQL expression |
| `time` | RFC3339 | No | Evaluation timestamp; default now |
| `timeout_ms` | int | No | 1–30000; default 5000 |

## Request — query_range

```json
{
  "query": "histogram_quantile(0.95, rate(span_duration_seconds_bucket[5m]))",
  "start": "2026-04-22T13:00:00Z",
  "end":   "2026-04-22T14:00:00Z",
  "step":  "30s",
  "timeout_ms": 30000
}
```

`step` accepts duration strings (Prometheus-compatible: `15s`, `1m`,
`5m`, `1h`).

## Response

```json
{
  "status": "success",
  "data": {
    "resultType": "matrix",
    "result": [
      {
        "metric": { "__name__": "span_duration_seconds", "service": "checkout" },
        "values": [
          [1713793200, "0.042"],
          [1713793230, "0.048"]
        ]
      }
    ]
  },
  "stats": {
    "execution_time_ms": 87,
    "samples_scanned": 14820,
    "cache": "hit"
  }
}
```

`stats.cache` is one of: `hit`, `miss`, `bypass`, `partial`.

## Error response

```json
{
  "status": "error",
  "error_type": "bad_data | timeout | execution | internal",
  "error": "human-readable message",
  "trace_id": "abc123..."
}
```

`trace_id` lets the customer cross-reference with our own observability
when contacting support.

## Limits

| Limit | Default | Tenant override |
|-------|---------|-----------------|
| Max series in result | 10,000 | tier-dependent |
| Max samples scanned | 50M | tier-dependent |
| Max query duration | 30 s | hard cap 60 s |
| Max concurrent queries / tenant | 16 | tier-dependent |

## Backwards compatibility

- Schema versioned via `Accept: application/vnd.helios.v1+json` header
- v1 frozen; v2 requires opt-in header

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-002 | refines |
| ADR-006 | informs (rejected GraphQL) |


