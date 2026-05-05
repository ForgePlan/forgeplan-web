---
depth: standard
id: PRD-003
kind: prd
links:
- target: EPIC-001
  relation: refines
status: active
title: Alerting rules engine v2
---

# PRD-003: Alerting rules engine v2

## Executive Summary

### Vision

Helios alerting fires on user-defined rules with sub-minute evaluation,
groups duplicates intelligently within configurable windows, and
delivers via the user's chosen channels (Slack, PagerDuty, webhook,
email) with at-least-once semantics and signed payloads.

### Problem

Alerting v1 fires every rule independently → 70% of alerts ignored
(EVID-005). On-call SREs maintain private mute lists outside the
product. Critical signals get lost in storm.

**Impact**: NPS for "alerting" feature = +12 (lowest of 9 tracked
sub-features). Top reason cited: "noise".

### Target Users

| Persona | Description | Key pain |
|---------|-------------|----------|
| On-call SRE | Receives alerts | Storm during incidents; can't filter |
| Platform engineer | Authors rules | Hard to test before enabling |

## Success Criteria

| ID | Criterion | Metric | Current | Target |
|----|-----------|--------|---------|--------|
| SC-1 | Alert dedup | duplicate ratio | 30% | < 5% |
| SC-2 | Eval cadence | rule eval p95 | 90s | < 30s |
| SC-3 | NPS for alerting | tracked feature NPS | +12 | ≥ +30 |

## Functional Requirements

| ID | Category | Priority | Requirement |
|----|----------|----------|-------------|
| FR-001 | Authoring | Must | Engineer can write rules in PromQL DSL with `for:` duration |
| FR-002 | Grouping | Must | System can group fired alerts by service+symptom within window |
| FR-003 | Delivery | Must | System can deliver to Slack, PagerDuty, generic webhook |
| FR-004 | Testing | Should | Engineer can dry-run rules against historical data |
| FR-005 | Silencing | Should | Engineer can silence by matcher with TTL |

## Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Performance | Rule eval p95 < 30s for 95% of rules at 10k rules/tenant |
| NFR-002 | Reliability | Alert delivery at-least-once with signed payload |
| NFR-003 | Throughput | 1000 fires/sec/tenant without queueing |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-001 | parent |
| SPEC-004 | Alert rule DSL grammar |
| SPEC-006 | Webhook delivery retry policy |
| SOL-003 | Smart alert grouping with dedup windows |
| EVID-005 | User research (alert fatigue) |
| PROB-003 | Alert fatigue |


