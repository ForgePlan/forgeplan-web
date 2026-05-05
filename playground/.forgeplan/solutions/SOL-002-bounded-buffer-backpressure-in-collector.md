---
depth: tactical
id: SOL-002
kind: solution
links:
- target: PROB-002
  relation: refines
status: active
title: Bounded-buffer backpressure in collector
---

# SOL-002: Bounded-buffer backpressure in collector

## Problem addressed

PROB-002 (memory leak in collector under burst load) — unbounded
retry queue accumulates batches during downstream backpressure,
leading to OOMKill cascades (INC-204).

## Approach

Replace the unbounded retry queue with a bounded ring buffer:
- Capacity: `4 × sustained_throughput_bytes` per tenant
- On overflow: oldest batches dropped with explicit metric
- Upstream HTTP/gRPC ingestion responds 429 + Retry-After when
  buffer is > 80% full

```rust
struct BoundedRetryQueue {
    capacity_bytes: usize,
    queue: VecDeque<SpanBatch>,
    bytes_in_queue: AtomicUsize,
}

impl BoundedRetryQueue {
    fn push(&mut self, batch: SpanBatch) -> Result<(), QueueFull> {
        let new_size = self.bytes_in_queue.load(Acquire) + batch.size_bytes();
        if new_size > self.capacity_bytes {
            metrics::counter!("collector.queue.dropped", batch.span_count() as u64);
            return Err(QueueFull);
        }
        self.queue.push_back(batch);
        self.bytes_in_queue.fetch_add(batch.size_bytes(), AcqRel);
        Ok(())
    }
}
```

## Behavior under burst

| Buffer fill | Action |
|-------------|--------|
| < 50% | Normal — no upstream signal |
| 50–80% | `Helios-Buffer-Pressure: warn` header on responses |
| ≥ 80% | 429 with Retry-After: 5 |
| 100% | Drop oldest batches; emit `collector.queue.dropped` |

## Tradeoffs

### Positive
- Eliminates OOMKill cascade (root cause of INC-204)
- Memory upper-bounded; predictable pod sizing
- Backpressure signal upstream lets clients adapt

### Negative
- Some span loss on extreme burst (metric makes this visible)
- More complex than unbounded; tuning required per tenant tier

## Rollout

- Phase 1: ship behind feature flag; enable on 1 tenant
- Phase 2: enable for all tenants over 2 weeks
- Phase 3: remove the unbounded path entirely

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PROB-002 | refines |
| EVID-003 | informs |
| EVID-004 | informs (INC-204) |


