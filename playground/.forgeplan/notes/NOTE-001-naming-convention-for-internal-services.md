---
depth: tactical
id: NOTE-001
kind: note
status: active
title: Naming convention for internal services
---

# NOTE-001: Naming convention for internal services

## Conventions

| Surface | Pattern | Example |
|---------|---------|---------|
| Service binary name | `helios-<noun>` | `helios-collector`, `helios-query` |
| K8s deployment | `<noun>` (no prefix) | `collector`, `query` |
| K8s namespace | `helios-<env>` | `helios-prod`, `helios-staging` |
| Public endpoint | `<verb-noun>` | `/api/query`, `/api/list` |
| Internal RPC | `helios.<service>.v<N>.<Method>` | `helios.collector.v1.Export` |
| Database name | `helios_<service>` | `helios_billing`, `helios_tenant` |
| Container image | `helios/<noun>:<sha-or-tag>` | `helios/collector:1.4.2` |

## Reasoning (why these specific patterns)

- Binary + image use the `helios-` prefix because they coexist on
  shared registries with non-Helios software
- Deployments / pods do not use the prefix because they live inside
  Helios-only namespaces — prefix would be redundant and noisy in
  `kubectl get pods` output
- Public endpoints stay verb-noun (REST-conventional) for client SDK
  ergonomics — e.g., `helios.list_artifacts()` reads naturally

## Don't bikeshed

This document is the answer to "what do we name this thing". If you
disagree, open a PR amending the table — don't argue in Slack.


