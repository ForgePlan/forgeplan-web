---
depth: tactical
id: SOL-006
kind: solution
links:
- target: PROB-012
  relation: refines
status: active
title: Pre-warmed deploy strategy with dual-fleet rotation
---

# SOL-006: Pre-warmed deploy strategy with dual-fleet rotation

## Problem addressed

PROB-012: rolling deploy of collector fleet causes 0.49% mean trace
miss rate during deploy window.

## Approach

Run two fleets ("blue" and "green") simultaneously. Deploys
update the inactive fleet, pre-warm it, then shift traffic
gradually before scaling down the previous fleet.

```
[ before deploy ]
  active:  blue (24 pods, all traffic)
  standby: green (0 pods)

[ deploy starts ]
  Step 1: scale green → 24 pods, new image (pods take 60s to ready)
  Step 2: pre-warm green (fake load + DNS warmup) for 90s
  Step 3: shift traffic blue→green over 5 min via weighted DNS
  Step 4: scale blue → 0 (after green is stable for 5 min)

[ after deploy ]
  active:  green
  standby: blue (next deploy)
```

## Pre-warming

Pre-warm phase opens 1k mock connections per pod, sends 50k synthetic
spans/sec. This populates JIT caches, DNS caches, and any lazy-loaded
state.

## Tradeoffs

### Positive
- Trace miss rate during deploy: target <0.05% (vs 0.49% currently)
- Rollback is trivial: weighted-DNS shift back to old fleet
- Pre-warm catches "first 5s of new pod lifetime" issues

### Negative
- 2× compute during deploy window (~$300 per deploy at current scale)
- DNS-based traffic shift requires customer DNS clients to honour TTL;
  some misbehaving clients may stay on old fleet for hours

## Rollout

Behind feature flag; pilot for one week; then default-on.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-012 | refines |
| EVID-023 | informs |


