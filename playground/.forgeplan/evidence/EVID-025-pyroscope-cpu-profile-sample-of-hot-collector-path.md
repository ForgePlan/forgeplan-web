---
depth: tactical
id: EVID-025
kind: evidence
links:
- target: ADR-008
  relation: informs
status: active
title: Pyroscope CPU profile sample of hot collector path
---

# EVID-025: Pyroscope CPU profile — hot collector path

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-15 |
| Valid Until | 2026-10-15 |
| Target | ADR-008 (Pyroscope adoption) |
| Author | platform-eng |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Method

Pyroscope continuous profiling deployed to 4 collector pods in
production for 7 days. Compared CPU breakdown vs the periodic
on-demand profiling we used previously.

## Result

| Function | Pre-Pyroscope estimate | Pyroscope measured |
|----------|-------------------------|--------------------|
| Span deserialisation | "~30%" | 27.4% |
| Attribute serialization | "~15%" | 8.1% |
| TLS handshakes | "~10%" | 22.3% |
| Kafka producer | "~20%" | 14.7% |
| Other | "~25%" | 27.5% |

TLS handshake CPU was significantly higher than estimate. Investigation
showed customers' SDKs were not reusing connections (no keep-alive
on default settings). 22% CPU on TLS = significant.

## Workflow improvements

| Aspect | Before Pyroscope | After |
|--------|-------------------|-------|
| Time to identify hot function | 2–4 hours | minutes (continuous) |
| Diff between releases | manual flame graph diff | built-in compare view |
| Per-tenant attribution | not possible | yes, via labels |
| Storage cost | ~negligible | $310/month/cluster |

## Interpretation

Pyroscope justifies its operational cost by the productivity gain
on per-release optimisation. ADR-008 confirmed. Next: optimisation
work on TLS reuse — separate effort.

## Congruence Level Justification

CL3: production deployment of the actual tool against real workload.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| ADR-008 | informs |


