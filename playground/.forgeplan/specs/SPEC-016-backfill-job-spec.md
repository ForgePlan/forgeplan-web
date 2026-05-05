---
depth: standard
id: SPEC-016
kind: spec
links:
- target: RFC-017
  relation: refines
status: active
title: Backfill job spec
---

# SPEC-016: Backfill job spec

## Surface

Backfill jobs are Temporal workflows scoped to a sub-account.

## Workflow definition

```typescript
import { proxyActivities } from "@temporalio/workflow";
const { enumerate, fetchBatch, transform, write, recordIdempotency }
  = proxyActivities<typeof activities>({ startToCloseTimeout: "10 min" });

export async function backfillWorkflow(input: BackfillInput) {
  const items = await enumerate(input);
  let cursor = null;
  do {
    const batch = await fetchBatch(input, cursor);
    const transformed = await transform(batch);
    await write(input, transformed);
    await recordIdempotency(batch.checkpoint);
    cursor = batch.nextCursor;
  } while (cursor);
}
```

## Input shape

```typescript
type BackfillInput = {
  jobType: "dsar_export" | "tenant_split" | "rule_re_eval" | "span_reaggregate";
  scope: { subAccountId: string; ... };
  output: { sink: "s3" | "kafka" | "in_place"; uri?: string };
  rateLimitPerSec?: number;     // default 1000 items/sec
  resume?: { checkpoint: string };
};
```

## Activity contracts

Each Activity is idempotent — second invocation with same input yields
same output. Implementation per `jobType`.

## Idempotency record

```sql
CREATE TABLE backfill_checkpoint (
  job_id      CHAR(26) PRIMARY KEY,
  sub_account_id CHAR(26) NOT NULL,
  job_type    TEXT NOT NULL,
  cursor      TEXT,
  status      TEXT NOT NULL,    -- running | done | failed
  started_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  output_uri  TEXT
);
```

## Operator surface

```sh
helios-backfill list --status running
helios-backfill cancel <job_id>
helios-backfill resume <job_id>
```

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| RFC-017 | refines |
| ADR-009 | informs (Temporal) |


