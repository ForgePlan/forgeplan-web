---
depth: tactical
id: SOL-008
kind: solution
links:
- target: PROB-011
  relation: refines
status: active
title: Widget virtualization for large dashboards
---

# SOL-008: Widget virtualization for large dashboards

## Problem addressed

PROB-011: dashboards with 100+ widgets cause Chromium tabs to freeze
after 8–12 minutes due to listener / detached-DOM leak.

## Approach

Two complementary fixes, deployed together:

### Fix 1: viewport-based virtualization

Only widgets in the visible viewport are mounted; widgets scrolled
off-screen are unmounted and re-created on scroll-into-view. Same
pattern as react-window / react-virtualized.

### Fix 2: explicit listener cleanup

Each widget MUST register listeners through a wrapper that records
them in a `WeakSet`. On unmount, the wrapper releases all recorded
listeners. ResizeObservers, ChartInstances, timers — all routed
through the same lifecycle hook.

## Architecture

```
Dashboard
  └── VirtualGrid
        ├── WidgetSlot (visible) → ChartWidget (mounted, listeners attached)
        ├── WidgetSlot (visible) → TableWidget (mounted)
        └── WidgetSlot (off-screen) → placeholder div (no listeners)
```

## Effect on heap (target)

| Metric | Before | After |
|--------|--------|-------|
| Heap at t=10 min | 1.1 GB | < 250 MB |
| Listener count | 32,000 | < 4,000 |
| Detached DOM | 87,000 | < 200 |

## Tradeoffs

### Positive
- Eliminates leak class
- Off-screen widgets cost ~zero memory
- Pattern is now mandatory for new widget types

### Negative
- Slight scroll-in latency (~100ms) for newly-visible widgets;
  acceptable given the size of the dashboards in question
- Some widget types (e.g. live alarm strip) MUST stay mounted —
  marked `pinned: true` in widget config

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-011 | refines |
| EVID-022 | informs |


