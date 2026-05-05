---
depth: tactical
id: EVID-005
kind: evidence
links:
- target: PRD-003
  relation: informs
status: active
title: 'User research: 12 SRE interviews on alert UX'
---

# EVID-005: User research — 12 SRE interviews on alert UX

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-02-15 |
| Valid Until | 2026-08-15 |
| Target | PRD-003 (Alerting rules engine v2), PROB-003 (Alert fatigue) |
| Author | product-research |
| Method | semi-structured interview, 45–60 min each |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 2

## Sample

12 SREs across 9 customer organisations (4 enterprise, 5 mid-market,
3 startup). Tenure: 2–11 years on-call. All currently use Helios for
production observability.

## Method

Semi-structured Zoom interviews, recorded and coded by two researchers
(inter-rater agreement κ=0.81). Discussion guide covered: 24h alert
volume, top 3 noisy rules, mute/snooze behaviour, dashboard fallback
patterns, would-pay-for features.

## Key findings

1. **70% of fired alerts are silenced without action** (median across
   12 interviews). Of those, 40% are "duplicate of an alert from 5 min
   ago", 30% are "transient blip — resolved itself", 30% other.
2. **9/12 SREs maintain a private mute list** outside Helios UI
   (Slack reactions, personal Notion). The product loses visibility.
3. **Top requested feature**: alert grouping by service+symptom across
   a 5-min window (mentioned unprompted by 11/12).
4. **Severity is broken**: 8/12 reported they ignore "severity" because
   "everything is P2".

## Interpretation

Alert fatigue is the dominant pain (PROB-003), and the symptom is
duplicate firing across a short window. SOL-003 (smart alert grouping
with dedup windows) maps directly to the top unprompted ask. PRD-003
should treat grouping as P0, not P1.

## Congruence Level Justification

CL2: real users on real product, but qualitative (interviews, not
production telemetry). Sample is representative but not statistical
(n=12, not powered). Use as directional, not as a statistical baseline.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-003 | informs (feature priority) |
| PROB-003 | informs (problem validation) |
| SOL-003 | informs (solution match) |


