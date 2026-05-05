---
depth: tactical
id: PROB-011
kind: problem
status: active
title: Browser tab freezes on dashboards with 100 plus widgets
---

# PROB-011: Browser tab freezes on dashboards with 100+ widgets

## Status

| Field | Value |
|-------|-------|
| Reported | 2026-04-22 |
| Severity | High (customer-facing UX) |
| Owner | frontend-eng |

## Symptom

Dashboards with 100+ widgets cause Chromium tabs to freeze after
8–12 minutes of idle viewing. EVID-022 reproduces this with detailed
heap snapshots.

## Root cause

Widget DOM is replaced every 5 seconds during data refresh. Old DOM
nodes are detached but remain referenced by:
- A `Map<widgetId, ChartInstance>` keyed on stale chart instances
- ResizeObservers attached to old DOM
- Event listeners on stale elements

Result: linear listener leak. After ~10 min, 32k+ orphan listeners
+ 87k+ detached DOM nodes saturate the event loop and the GC.

## Customer impact

- 14 enterprise customers maintain "executive" dashboards in this size range
- Top complaint via support: "I leave it on a TV and the tab freezes
  by morning"

## Mitigations available

- SOL-008 (widget virtualization) renders only visible widgets
- Cleanup hook on widget unmount releases listeners
- Use `WeakMap` for ChartInstance registry to allow GC to reclaim
  detached widgets

## Long-term fix

SOL-008 deployment, plus mandatory listener cleanup in the widget
contract going forward.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-022 | informs (root cause) |
| SOL-008 | refines (fix) |


