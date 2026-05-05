---
depth: standard
id: PRD-005
kind: prd
links:
- target: EPIC-002
  relation: refines
status: active
title: Per-tenant retention policies
---

# PRD-005: Per-tenant retention policies

## Executive Summary

### Vision

Tenants configure span retention per-trace-attribute: e.g., keep
errors 90 days, latency-tail 30 days, normal traffic 7 days. Storage
costs follow policy automatically; cold tier archive supported.

### Problem

Today, retention is a single tenant-level dial. Tenants paying for
"90 days" pay for normal traffic they don't need. Tenants on "7 days"
lose error traces critical for trend analysis.

**Impact**: Top expansion blocker in 2026-Q1 deal reviews.

### Target Users

| Persona | Description | Pain |
|---------|-------------|------|
| Platform engineer | Owns observability budget | Pays too much for noise |
| SRE | Investigates incidents | Loses key historical traces |

## Success Criteria

| ID | Criterion | Metric | Target |
|----|-----------|--------|--------|
| SC-1 | Storage savings | observed vs flat retention | ≥ 35% |
| SC-2 | Trace recall on errors | retained ratio | 100% |
| SC-3 | Policy lag | change → effective | < 30 min |

## Functional Requirements

| ID | Category | Priority | Requirement |
|----|----------|----------|-------------|
| FR-001 | Authoring | Must | Tenant admin can author retention policies as predicate-based rules |
| FR-002 | Core | Must | System can evict matching spans on TTL boundary |
| FR-003 | Audit | Must | System can show policy effective time-to-live per match |
| FR-004 | Cold tier | Should | System can archive matching spans to S3 Glacier-class storage |

## Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Isolation | One tenant's policy cannot affect another |
| NFR-002 | Lag | Policy change effective within 30 min |
| NFR-003 | Audit | All policy changes are append-only logged |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-002 | parent |
| RFC-008 | Multi-tenant blast radius isolation |


