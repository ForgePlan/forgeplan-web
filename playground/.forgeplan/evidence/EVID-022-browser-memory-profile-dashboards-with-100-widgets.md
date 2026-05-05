---
depth: tactical
id: EVID-022
kind: evidence
links:
- target: PROB-011
  relation: informs
status: active
title: Browser memory profile dashboards with 100 widgets
---

# EVID-022: Browser memory profile — dashboards with 100+ widgets

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-22 |
| Valid Until | 2026-07-22 |
| Target | PROB-011 (Browser tab freeze) |
| Author | frontend-eng |

## Structured Fields

evidence_type: measurement
verdict: supports
congruence_level: 3

## Method

Chromium DevTools heap snapshots taken at 30s intervals on a real
customer dashboard with 142 widgets, mix of time-series + topology
+ tables. Target: identify why tabs freeze after 8–12 min idle.

## Result

| Snapshot | Heap (MB) | Listeners | Detached DOM nodes |
|----------|-----------|-----------|--------------------|
| t=0 | 142 | 1,840 | 0 |
| t=2 min | 218 | 4,210 | 1,200 |
| t=5 min | 481 | 12,800 | 14,500 |
| t=10 min | 1,102 | 32,000 | 87,000 |
| t=12 min | 1,840 (frozen) | n/a | n/a |

Linear growth in detached DOM nodes and event listeners — classic
listener leak. Root cause: each timer-tick replaces widget DOM but
listeners are attached to old DOM and never released.

## Specific leak path

Time-series widgets re-render every 5s. Old DOM is detached but
remains referenced by `Map<widgetId, ChartInstance>` keyed on stale
chart instances. Map never pruned.

## Interpretation

PROB-011 is reproducible and root-caused. SOL-008 (widget
virtualization) should ALSO clean up listener registry on widget
unmount. Two fixes: cleanup hook + virtualization, in that order.

## Congruence Level Justification

CL3: real customer dashboard config (anonymised), real Chromium,
real heap profile.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-011 | informs (root cause) |
| SOL-008 | informs (must fix listener leak too) |


