---
depth: tactical
id: NOTE-004
kind: note
status: active
title: Postmortem template required sections
---

# NOTE-004: Postmortem template — required sections

## Required sections (every postmortem MUST include)

1. **Summary** (2–3 sentences, blameless)
2. **Timeline** (UTC, key events with timestamps)
3. **Impact** (customer-facing, internal-facing, financial if known)
4. **Root cause** (technical, not "human error")
5. **Contributing factors** (≥ 1, often more)
6. **What went well** (skipping this is a tell that the postmortem
   is finger-pointing in disguise)
7. **What went poorly** (specific actions that produced harm)
8. **Action items** (each one assigned, with owner + due date)

## Severity levels

| Sev | Examples | SLA to publish PM |
|-----|----------|-------------------|
| SEV-1 | Full outage; data loss | 5 business days |
| SEV-2 | Partial outage; degraded perf > 30 min | 10 business days |
| SEV-3 | Single-tenant impact; recovered < 30 min | optional |

## Tone

Blameless. "The deploy was misconfigured" not "Alice deployed wrong".
Postmortems are about systems improvements, not assigning fault.

## Distribution

- All SEV-1 / SEV-2 published to internal docs index within SLA
- Customer-facing summary written by support team for affected
  customers (separate from internal PM)

## Examples in this workspace

- EVID-004 — INC-204 ingest backlog (SEV-2)
- EVID-024 — INC-217 double billing (SEV-2)

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| EVID-004 | example |
| EVID-024 | example |


