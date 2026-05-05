---
depth: standard
id: SPEC-017
kind: spec
links:
- target: PRD-010
  relation: refines
status: active
title: Cold tier archive lifecycle
---

# SPEC-017: Cold tier archive lifecycle

## States

```
HOT (ClickHouse, ZSTD-3)
   │  age > archive_threshold
   ▼
ARCHIVING
   │  re-compressed ZSTD-19, manifest signed
   ▼
COLD (S3 Glacier IR)
   │  retrieve request
   ▼
RESTORING
   │  decompress, re-ingest
   ▼
HOT  (back)
```

## Tenant configuration

```yaml
archive:
  threshold_days: 30        # hot → archiving cutoff
  retention_days: 365       # cold → delete cutoff
  retrieval_tier: instant   # instant | flexible | deep
```

## Archive manifest

For each archived partition:

```json
{
  "manifest_version": "1.0",
  "tenant_id": "tnt_acme",
  "partition": "2026-03-15",
  "row_count": 14820100,
  "compressed_size_bytes": 380914582,
  "uncompressed_size_bytes": 4120998301,
  "compression_codec": "ZSTD-19",
  "dictionary_id": "dict_v3_acme",
  "schema_version": "v1.3",
  "checksum_sha256": "...",
  "archived_at": "2026-04-15T02:14:00Z",
  "signed_by": "helios-archiver-prod"
}
```

## Retrieval semantics

- `instant`: data available within 5s; query layer paginates
- `flexible`: ≤ 12h; query API returns 202 Accepted with poll URL
- `deep`: 24–48h; for compliance / DSAR scenarios only

## Verification

A nightly job samples 0.1% of manifest entries and verifies checksums
against the archived data. Mismatches page on-call.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-010 | refines |
| RFC-012 | informs (compaction codec) |


