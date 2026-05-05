---
depth: standard
id: ADR-001
kind: adr
links:
- target: RFC-004
  relation: based_on
status: active
title: Choose ClickHouse over TimescaleDB for span storage
---

# ADR-001: Choose ClickHouse over TimescaleDB for span storage

## Context

Helios ingests 1M+ spans/sec at peak. Span workload is overwhelmingly
columnar range scans (`time BETWEEN x AND y` + group-by service/op)
with high cardinality string fields (trace_id, span_id) and low
cardinality enums (kind, status). RFC-004 explored columnar layouts
for span data.

We benchmarked ClickHouse 24.3 against TimescaleDB 2.14 (PG16) on
identical hardware (6× r6i.4xlarge) at 1M spans/sec sustained — see
EVID-001.

## Decision

**Selected: ClickHouse 24.3+ (MergeTree engine) for hot tier span
storage. TimescaleDB retained only for control-plane metadata (PG16,
small footprint).**

**Why selected**: ClickHouse demonstrated 6.4× lower query p95 and
2.7× better compression on representative workload. TimescaleDB
saturated CPU at 91% under same load; ClickHouse had ~40% headroom.
Cost model (EVID-008 derived) saves ~$420k/yr at projected 2026-Q4
scale.

## Alternatives Considered

| Option | Verdict | Why |
|--------|---------|-----|
| TimescaleDB hypertable + native compression | Rejected | CPU saturated; query p95 7× target |
| ClickHouse MergeTree | **Chosen** | best fit for columnar+TTL+compression |
| Druid | Rejected | operational complexity (3 node roles); team has 0 prod experience |
| Pinot | Rejected | strong real-time, weak ad-hoc queries |
| Custom Parquet + DuckDB | Rejected | no clustered query layer; sharding from scratch |

## Consequences

### Positive

- Linear scaling proven to 5M spans/sec on 12 nodes (EVID-013)
- 11× compression ratio on cold tier; storage cost dominates → big win
- SQL surface familiar to engineers and customers; fewer custom DSLs

### Negative (trade-offs)

- ClickHouse cluster operational expertise is concentrated in 2 engineers;
  bus factor risk. Mitigation: Altinity support contract + cross-training.
- No transactional UPDATE/DELETE; mutations are heavy. Acceptable for
  spans (immutable by design); painful for any retention-policy edits.
- Eventual-consistency on replicated MergeTree; query layer must accept
  staleness up to 2× replication lag.

### Risks

- Major version upgrade requires careful read/write split during cutover.
- Schema changes on 100M+ row tables can take hours; needs migration
  playbook.

## Invariants

- Spans are immutable once persisted (no UPDATE).
- Retention is enforced via TTL clauses, not application deletes.
- All queries go through the planner; no direct SQL access for tenants.

## Evidence Requirements

- Sustained 1M spans/sec ingest with p99 < 50ms — **MET (EVID-001)**
- Query p95 < 500ms on 100M-row range — **MET (EVID-001, EVID-013)**
- 90-day production data with 0 data-loss incidents on replication
  — pending (target: 2026-Q3)

## Valid Until

`valid_until: 2027-04-12`. 12-month TTL from decision date.

**Refresh Triggers**:
- ClickHouse releases major rewrite of MergeTree (>= 25.x)
- Sustained traffic exceeds 5M spans/sec (current ceiling tested)
- Cost crossover: if cloud-native alternatives (BigQuery, Snowflake)
  drop streaming-ingest pricing >50%

## Pre-conditions

- [x] Benchmark on representative workload (EVID-001)
- [x] Migration dry-run on 3 staging tenants (EVID-013)
- [x] Cost model approved by finance (EVID-008 derivative)
- [x] Altinity support contract signed
- [ ] On-call runbooks for ClickHouse-specific failure modes (in progress)

## Post-conditions (Definition of Done)

- [x] Production migration plan documented and reviewed
- [ ] All 8 production tenants migrated
- [ ] TimescaleDB span tables decommissioned
- [ ] Query p95 SLO observed for 30 consecutive days

## Admissibility

- NOT: direct tenant SQL access to ClickHouse (always via planner)
- NOT: cross-tenant joins at storage layer
- NOT: row-level UPDATE on span tables

## Rollback Plan

**Triggers**:
- Sustained ingest p99 > 100ms for 1h
- 2+ data-loss incidents in 30d window

**Steps**:
1. Stop new tenant migrations to ClickHouse
2. Re-enable TimescaleDB ingest path (kept warm 90 days)
3. Replay last 24h from Kafka backup
4. Failback at tenant granularity

**Blast Radius**: All migrated tenants; estimated 6h to fully revert
8 tenants assuming 24h Kafka retention.

## Weakest Link

The 0.08% non-deterministic query result delta seen during EVID-013
dry-run. Mitigated by stable sort tie-breaker; tracked in SPEC-002.

## Related Artifacts

| Artifact | Type | Relation |
|----------|------|----------|
| RFC-004 | RFC | based_on |
| EVID-001 | Evidence | informs |
| EVID-013 | Evidence | informs |
| EVID-008 | Evidence | informs (cost) |
| SPEC-002 | Spec | implements |


