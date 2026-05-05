---
depth: standard
id: ADR-008
kind: adr
links:
- target: EPIC-005
  relation: informs
status: active
title: Use Pyroscope for continuous profiling
---

# ADR-008: Use Pyroscope for continuous profiling

## Context

Performance regressions historically caught only after customers reported
latency increases (PROB-001 was a 17-day window of regression before fix).
Periodic on-demand profiling missed slow drift. Continuous profiling has
matured (Pyroscope merged into Grafana stack 2024) — time to adopt.

## Decision

**Selected: Pyroscope (self-hosted, Grafana-stack version) deployed across
hot path components: collectors, query engine, ingest pipeline. Sample rate
100Hz; tagged by service, version, region, tenant tier.**

**Why selected**: open-source self-host avoids data-residency concerns;
Grafana-stack integration aligns with our existing dashboards; pull-based
profile collection is cheap (minor CPU overhead, ~1.5%).

## Alternatives Considered

| Option | Verdict |
|--------|---------|
| Status quo (on-demand pprof) | Rejected — too slow to detect drift |
| Pyroscope self-hosted | **Chosen** |
| Datadog Continuous Profiler | Rejected — vendor cost + customer-data egress concerns |
| Polar Signals | Rejected — strong product but smaller community |

## Consequences

### Positive
- Per-release flame graph diff via built-in compare view
- Per-tenant attribution via Pyroscope labels
- EVID-025: TLS handshake overhead (22%) discovered immediately

### Negative
- Adds another stateful service to operate (~$310/month/cluster storage)
- Some teams resist sampling tools that collect during incidents

## Invariants

- Profiling is read-only; cannot modify running service
- Per-tenant labels never include user-identifiable data
- Profile retention 30 days; older data dropped

## Valid Until

`valid_until: 2027-04-15`

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-005 | informs |
| EVID-025 | informs |


