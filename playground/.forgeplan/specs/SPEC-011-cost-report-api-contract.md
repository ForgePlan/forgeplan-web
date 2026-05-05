---
depth: standard
id: SPEC-011
kind: spec
links:
- target: PRD-015
  relation: refines
status: active
title: Cost report API contract
---

# SPEC-011: Cost report API contract

## Endpoints

| Method | Path | Auth | Returns |
|--------|------|------|---------|
| GET | `/api/v1/cost/breakdown` | Bearer | breakdown JSON |
| GET | `/api/v1/cost/breakdown.csv` | Bearer | CSV download |
| POST | `/api/v1/cost/schedules` | Bearer | schedule a recurring report |

## Request: breakdown

```http
GET /api/v1/cost/breakdown?period=2026-04&group_by=service&top=20
```

| Param | Required | Description |
|-------|----------|-------------|
| `period` | Yes | YYYY-MM (current or prior) |
| `group_by` | Yes | `service`, `namespace`, `tag:<key>` |
| `top` | No | Top-N rows; default 50, max 200 |
| `include_other` | No | Aggregate remaining as "Other"; default true |

## Response

```json
{
  "period": "2026-04",
  "group_by": "service",
  "currency": "USD",
  "total": 12420.43,
  "rows": [
    { "key": "checkout", "spend": 4210.18, "share": 0.339 },
    { "key": "orders",   "spend": 2842.55, "share": 0.229 },
    ...
  ],
  "metadata": {
    "snapshot_taken_at": "2026-05-01T02:00:00Z",
    "next_snapshot_at": "2026-05-02T02:00:00Z"
  }
}
```

## Schedule POST

```json
{
  "cadence": "monthly",
  "delivery": { "type": "email", "recipients": ["finops@acme.com"] },
  "params": { "group_by": "tag:team", "top": 50 }
}
```

## Limits

- 60 requests/min per tenant
- Maximum 36 months of history per query
- Daily snapshot at 02:00 UTC

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-015 | refines |


