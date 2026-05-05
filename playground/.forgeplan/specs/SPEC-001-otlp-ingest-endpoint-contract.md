---
depth: standard
id: SPEC-001
kind: spec
links:
- target: PRD-001
  relation: refines
status: active
title: OTLP ingest endpoint contract
---

# SPEC-001: OTLP ingest endpoint contract

## Surface

| Endpoint | Method | Auth | Body |
|----------|--------|------|------|
| `/v1/traces` | POST | Bearer JWT | `ExportTraceServiceRequest` (OTLP/HTTP) |
| `helios.collector.v1.TraceService/Export` | gRPC | Bearer JWT | `ExportTraceServiceRequest` |

Both endpoints accept identical payload shape per OTLP spec v1.3.

## Authentication

`Authorization: Bearer <JWT>`

JWT is signed with tenant-specific HS256 key. Claims:

- `iss`: `helios-collector-token-issuer`
- `sub`: tenant_id (ULID)
- `aud`: `helios-ingest`
- `exp`: ≤ 24h from issue
- `scope`: `ingest:write`

Invalid token → 401 with structured error (no info leak about tenant
existence).

## Request constraints

- Maximum payload: 4 MB per request (gRPC max-message-size)
- Maximum batch: 10,000 spans per ExportRequest
- Compression: gzip and zstd accepted (header negotiation)

## Response shape

### Success (200 OK)

```json
{
  "partial_success": {
    "rejected_spans": 0,
    "error_message": ""
  }
}
```

### Backpressure (429)

```json
{
  "code": "RATE_LIMITED",
  "message": "Tenant rate limit exceeded",
  "retry_after_seconds": 5,
  "tenant_quota": {
    "limit_spans_per_sec": 100000,
    "current_rate": 152000
  }
}
```

Response header: `Retry-After: 5`

### Schema violation (400)

```json
{
  "code": "INVALID_SPAN",
  "message": "Span at index 42 has invalid trace_id length",
  "field_path": "spans[42].trace_id",
  "expected": "16 bytes",
  "got": "8 bytes"
}
```

## Error codes

| HTTP | gRPC | Code | Meaning |
|------|------|------|---------|
| 200 | OK | — | Success (with possible partial_success) |
| 400 | INVALID_ARGUMENT | INVALID_SPAN, MISSING_REQUIRED_FIELD | Request shape error |
| 401 | UNAUTHENTICATED | INVALID_TOKEN | Auth failure |
| 403 | PERMISSION_DENIED | INSUFFICIENT_SCOPE | Wrong scope |
| 413 | OUT_OF_RANGE | PAYLOAD_TOO_LARGE | > 4 MB |
| 429 | RESOURCE_EXHAUSTED | RATE_LIMITED | Backpressure |
| 503 | UNAVAILABLE | INGEST_DEGRADED | Storage tier degraded |

## Idempotency

Each ExportRequest is independent. Spans are deduplicated by
(trace_id, span_id) at storage tier; retries are safe.

## Telemetry

Endpoint emits its own OTel metrics:
- `helios.ingest.spans.received` (counter)
- `helios.ingest.spans.rejected` (counter, by reason)
- `helios.ingest.duration` (histogram)

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-001 | refines |
| SPEC-002 | complements (span schema) |


