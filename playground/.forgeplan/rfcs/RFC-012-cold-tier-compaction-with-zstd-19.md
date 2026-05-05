---
depth: standard
id: RFC-012
kind: rfc
links:
- target: PRD-010
  relation: refines
status: active
title: Cold tier compaction with ZSTD-19
---

# RFC-012: Cold tier compaction with ZSTD-19

## Summary

Spans archived to S3 Glacier IR (PRD-010) are recompressed at higher
ZSTD level (19, vs hot-tier 3) before upload. Storage savings 2.6×
on representative workload; one-time CPU cost amortised over years
of archive retention.

## Motivation

S3 Glacier IR storage cost is per-GB. Hot tier is optimised for ingest
throughput (low compression CPU). Archive is read-rarely-written-once;
high-CPU compression is the right trade.

## Goals

- ≥ 2× additional compression ratio over hot-tier ZSTD-3
- One-time CPU cost amortised; not on hot path
- Decompression latency on retrieval acceptable (<2s for 1 GB chunks)

## Approach

Periodic batch job:
1. Identify partitions older than archive threshold
2. Read raw data from hot tier
3. Re-compress with ZSTD-19 (long mode, dictionary trained per tenant)
4. Upload to Glacier IR with metadata pointer
5. Drop hot-tier data after manifest verified

## Risks

- ZSTD-19 compression CPU is 20× ZSTD-3; throttle to off-peak hours
- Per-tenant dictionary requires periodic retraining as schema evolves;
  build automation around this
- Restoration path must understand dictionaries; spec change to manifest

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-010 | refines |
| SPEC-017 | informs (lifecycle) |


