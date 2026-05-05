---
depth: standard
id: SPEC-013
kind: spec
links:
- target: PRD-014
  relation: refines
status: active
title: SDK auto-instrumentation interface
---

# SPEC-013: SDK auto-instrumentation interface

## Public API

```typescript
import helios from "@helios/sdk";

// Minimal: reads HELIOS_API_KEY from env
helios.init();

// Or explicit
helios.init({
  apiKey: process.env.HELIOS_API_KEY,
  serviceName: "checkout",
  environment: "production",
  sampleRate: 1.0,
});
```

## Auto-instrumented libraries (v1)

| Category | Libraries |
|----------|-----------|
| HTTP server | express, fastify, koa, hapi |
| HTTP client | got, axios, undici, native fetch |
| DB | pg, mysql2, mongoose, prisma |
| Cache | ioredis, node-redis |
| RPC | @grpc/grpc-js |

## Manual span API

```typescript
const span = helios.startSpan("custom-operation", { attrs: { foo: "bar" } });
try { /* work */ } catch (e) { span.recordError(e); throw e; }
finally { span.end(); }
```

## Conventions

- Wraps OTel SDK; users wanting OTel directly can `import { trace } from "@opentelemetry/api"`
- All instrumentations are opt-out: `helios.init({ disable: ["pg"] })`
- Sampling decision honoured at root span; child spans inherit
- Span batch flushed every 5s OR 4 KB compressed body, whichever first

## Configuration

| Field | Default | Notes |
|-------|---------|-------|
| `apiKey` | env HELIOS_API_KEY | required |
| `serviceName` | `process.env.npm_package_name` | falls back to `unnamed` |
| `environment` | env NODE_ENV | one of dev | staging | production |
| `sampleRate` | 1.0 | 0.0–1.0 |
| `disable` | `[]` | array of instrumentation names |
| `endpoint` | `https://ingest.helios.io` | for self-hosted/EU regions |

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-014 | refines |
| EVID-017 | informs (overhead) |


