---
depth: standard
id: PRD-011
kind: prd
links:
- target: EPIC-004
  relation: refines
status: active
title: Real-time service dependency analytics
---

# PRD-011: Real-time service dependency analytics

## Vision

A live service-graph view that shows actual call topology, throughput
per edge, and error rate per edge — derived in real time from observed
spans. Updated every 60s; historical comparison view (this hour vs
24h ago).

## Problem

The current service map (PRD-004) shows topology but not "weight" —
no RPS per edge, no error contribution. SREs reach for it during
incidents and find it underwhelming for diagnosis.

## Target Users

| Persona | Pain |
|---------|------|
| On-call SRE | Need quick "who's calling who, how much" during incident |
| Platform engineer | Capacity planning needs throughput per edge |

## Success Criteria

| ID | Target |
|----|--------|
| SC-1: Edge throughput accuracy | within 2% of ground truth |
| SC-2: Update cadence | ≤ 60s lag |
| SC-3: Render time | < 1.5s on 200-node graph |

## Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-001 | Must | System derives edge throughput per (caller, callee, op) per minute |
| FR-002 | Must | UI overlays throughput on existing service map |
| FR-003 | Must | UI overlays error rate per edge |
| FR-004 | Should | User can compare "now" vs "24h ago" overlay |
| FR-005 | Could | User can filter graph to a single tenant's namespace |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-004 | parent |
| RFC-013 | algorithm choice |
| PRD-004 | base service map |


