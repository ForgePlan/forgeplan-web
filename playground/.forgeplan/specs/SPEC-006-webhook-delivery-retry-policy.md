---
depth: standard
id: SPEC-006
kind: spec
links:
- target: PRD-003
  relation: refines
status: active
title: Webhook delivery retry policy
---

# SPEC-006: Webhook delivery retry policy

## Delivery semantics

At-least-once. Webhook receivers MUST treat deliveries as idempotent;
each delivery includes a unique `Helios-Delivery-Id` header.

## Retry schedule

Exponential backoff with jitter:

| Attempt | Delay (s) | Cumulative (s) |
|---------|-----------|----------------|
| 1 | 0 | 0 |
| 2 | 5 ± 1.5 | ~5 |
| 3 | 30 ± 9 | ~35 |
| 4 | 120 ± 36 | ~155 |
| 5 | 600 ± 180 | ~755 |
| 6 | 3600 ± 1080 | ~4355 |

After attempt 6 (≈ 1h 13min cumulative), delivery is moved to dead
letter queue. Tenant receives a notification after 3 successive DLQ
events.

## Retry triggers

| Response | Retry? |
|----------|--------|
| 2xx | No (success) |
| 408, 429, 5xx | Yes |
| 4xx (other) | No (terminal failure; logged) |
| Connection timeout (10s) | Yes |
| TLS error | No (terminal; logged with cert details) |

## Headers

```
POST /your-webhook HTTP/1.1
Content-Type: application/json
Helios-Event: alert.fired
Helios-Delivery-Id: 01HXYZ...
Helios-Tenant-Id: tnt_acme
Helios-Signature-256: sha256=<hex>
Helios-Timestamp: 1713793200
User-Agent: helios-webhook/1.0
```

## Signature verification

```
signature = HMAC_SHA256(
  key = tenant_webhook_signing_secret,
  msg = timestamp + "." + raw_body
)
```

Receivers MUST verify signature AND check timestamp within ±5 min
to mitigate replay.

## Tenant-side admin endpoints

- `GET /webhooks/{id}/deliveries` — list recent deliveries with status
- `POST /webhooks/{id}/deliveries/{delivery_id}/retry` — manual retry
- `GET /webhooks/{id}/dlq` — list dead-letter deliveries

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-003 | refines |
| EVID-010 | informs (signature scheme post-pen-test) |


