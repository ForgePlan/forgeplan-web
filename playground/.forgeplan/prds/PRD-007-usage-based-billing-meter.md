---
depth: standard
id: PRD-007
kind: prd
links:
- target: EPIC-003
  relation: refines
status: active
title: Usage-based billing meter
---

# PRD-007: Usage-based billing meter

## Executive Summary

### Vision

Helios bills tenants on usage signals (spans ingested, bytes stored,
queries executed) computed continuously, surfaced in real-time dashboards,
and reconciled to invoices monthly with auditor-grade evidence trail.

### Problem

Current billing is flat-tier ("up to 100M spans"). Tenants overshoot
silently and disputes erupt at invoice time. Sales has no story for
prospects who want consumption pricing.

**Impact**: 14% of monthly invoices in 2025 raised dispute tickets.

### Target Users

| Persona | Description | Pain |
|---------|-------------|------|
| Tenant admin | Manages spend | "Bill is a black box" |
| Helios Finance | Issues invoices | Dispute resolution toil |

## Success Criteria

| ID | Criterion | Metric | Target |
|----|-----------|--------|--------|
| SC-1 | Dispute rate | invoice disputes / month | < 2% |
| SC-2 | Meter freshness | usage panel lag | < 5 min |
| SC-3 | Reconciliation | meter vs storage delta | < 0.1% |

## Functional Requirements

| ID | Category | Priority | Requirement |
|----|----------|----------|-------------|
| FR-001 | Metering | Must | System can meter spans ingested per tenant per minute |
| FR-002 | Metering | Must | System can meter bytes stored daily per tenant |
| FR-003 | UX | Must | Tenant admin can view usage dashboard scoped to billing period |
| FR-004 | Audit | Must | Finance can export raw meter records for any past invoice |
| FR-005 | Pricing | Should | Pricing engine supports volume tiers and free credits |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-003 | parent |
| ADR-005 | Postgres for billing storage |
| SPEC-005 | Tenant provisioning state machine |


