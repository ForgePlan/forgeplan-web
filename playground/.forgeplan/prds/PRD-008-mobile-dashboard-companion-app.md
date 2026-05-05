---
depth: standard
id: PRD-008
kind: prd
links:
- target: EPIC-003
  relation: refines
status: draft
title: Mobile dashboard companion app
---

# PRD-008: Mobile dashboard companion app

## Executive Summary

### Vision

A focused mobile companion (iOS, Android) for on-call SREs:
acknowledge alerts, view trace summaries, run a curated list of
pre-saved queries. Not a full dashboard — explicitly the "5%
of features used during 2am pages".

### Problem

On-call SREs say they reach for a laptop because the existing web
dashboard is unusable on phone (8s+ load, complex graphs unreadable).
Time-to-acknowledge averages 4 min, dominated by laptop-fetch latency.

### Target Users

| Persona | Description | Pain |
|---------|-------------|------|
| On-call SRE | 2am page | Slow time-to-context |

## Success Criteria

| ID | Criterion | Metric | Target |
|----|-----------|--------|--------|
| SC-1 | Time to ack | page → ack via mobile | < 30s |
| SC-2 | Trace view | TTFB on phone | < 1.5s |
| SC-3 | Crash-free | session crash rate | ≥ 99.7% |

## Functional Requirements

| ID | Category | Priority | Requirement |
|----|----------|----------|-------------|
| FR-001 | Core | Must | On-call user can ack/snooze alerts from notification |
| FR-002 | Core | Must | On-call user can view a curated set of saved queries |
| FR-003 | UX | Should | On-call user can view trace timeline summary |
| FR-004 | UX | Could | On-call user can compose a Slack message linking the alert |

## Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-001 | Performance | TTFB on 4G < 1.5s |
| NFR-002 | Compatibility | iOS 16+, Android 11+ |
| NFR-003 | Compatibility | OAuth login works on Safari iOS 17 (PROB-006 fix required) |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EPIC-003 | parent |
| RFC-005 | SSE vs WebSocket for live updates |
| RFC-009 | SSR vs CSR rendering |
| EVID-009 | Browser compat |
| PROB-005 | Dashboard cold load |
| PROB-006 | OAuth Safari iOS 17 |

