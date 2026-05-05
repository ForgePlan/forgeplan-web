---
depth: standard
id: RFC-014
kind: rfc
links:
- target: PRD-012
  relation: refines
status: active
title: Audit log retention storage tier
---

# RFC-014: Audit log retention storage tier

## Summary

PRD-012 requires 7-year retention for audit log entries (SOC2 / GDPR).
Storage strategy: hot tier (Postgres) for last 90 days, cold tier
(S3 + parquet) for older entries. Single API serves both
transparently.

## Motivation

Audit log volume is small (~1 GB/tenant/year typical) but retention
is long. Storing 7 years in Postgres is wasteful. Cold tier with
columnar format (parquet) supports occasional auditor queries with
acceptable latency.

## Architecture

```
admin action
   ↓
audit-write service (validates, signs, appends)
   ↓
Postgres (hot, last 90d)
   ↓ daily archiver
Parquet on S3 (cold, 7y)
```

## Tamper-evidence

Each audit entry contains `prev_hash` = SHA-256 of previous entry
(per-tenant chain). Daily, we publish the latest hash to a
public-write-once log (e.g. AWS QLDB or Sigstore Rekor) so customers
can verify chain integrity.

## Risks

- Hash chain forks across cross-region replication. Mitigation:
  audit log entries are written single-region (us-east-1), with
  read replicas elsewhere
- Cold-tier query latency is several seconds. Mitigation: cache
  recent cold queries; auditor SLA permits delays

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-012 | refines |
| SPEC-012 | informs |


