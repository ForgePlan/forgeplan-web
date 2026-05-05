---
depth: standard
id: PRD-004
kind: prd
links:
- target: EPIC-001
  relation: refines
status: active
title: Service map auto-discovery
---

# PRD-004: Service map auto-discovery

## Executive Summary

### Vision

Helios renders an up-to-date service-dependency graph for each tenant
without manual configuration: the product infers services, edges, and
RPS purely from observed spans within the last 15 min.

### Problem

New customers see an empty "service map" view because spans must be
flowing for >24h before any aggregation surfaces. Onboarding NPS
takes a 10–15 point hit on this single screen during demos.

### Target Users

| Persona | Description | Key pain |
|---------|-------------|----------|
| Sales engineer | Demoing to prospects | Empty map kills demos |
| Customer SRE | First-week onboarding | "Where are my services?" |

## Success Criteria

| ID | Criterion | Metric | Target |
|----|-----------|--------|--------|
| SC-1 | Time to first map | first span → visible map | < 5 min |
| SC-2 | Edge accuracy | observed vs known | ≥ 95% |
| SC-3 | Render time | p95 first paint | < 1.5s |

## Functional Requirements

| ID | Category | Priority | Requirement |
|----|----------|----------|-------------|
| FR-001 | Core | Must | System can derive service map from observed spans within 15 min window |
| FR-002 | Core | Must | User can pin nodes, edit display labels |
| FR-003 | Performance | Should | System can render 500-node maps with smooth interaction |
| FR-004 | UX | Should | User can drill into edge to see top-N RPCs |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-001 | parent |
| RFC-003 | Tail-based sampling (affects derivation cost) |


