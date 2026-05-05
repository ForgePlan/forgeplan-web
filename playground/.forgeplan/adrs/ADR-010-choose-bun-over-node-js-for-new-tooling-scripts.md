---
depth: standard
id: ADR-010
kind: adr
links:
- target: ADR-003
  relation: informs
status: active
title: Choose Bun over Node.js for new tooling scripts
---

# ADR-010: Choose Bun over Node.js for new tooling scripts

## Context

We have 40+ internal tooling CLIs (`helios-*`) used in CI and developer
workflows. Cold start dominates wall-clock for short-lived scripts;
EVID-026 showed 50–73% startup-time reduction on Bun for our typical
scripts. Node 20 remains the runtime for production services.

## Decision

**Selected: Bun (1.1+) for new internal tooling scripts. Node 20 stays
as the production server runtime. Existing tools NOT rewritten unless
their cold-start is a measured developer-experience pain point.**

**Why selected**: directly improves dev/CI iteration speed; 6 of 7
representative scripts ran unmodified on Bun; the 1 that needed a shim
was a non-blocking compat issue.

## Alternatives Considered

| Option | Verdict |
|--------|---------|
| Stay Node 20 | Rejected — leaving 50%+ wall-clock on the table |
| Bun for tooling, Node for prod | **Chosen** |
| Bun across the board (incl. prod) | Deferred — production stack on Bun is risky pre-1.5 |
| Deno | Rejected — npm compat issues with internal packages |

## Consequences

### Positive
- 50–73% faster CLI cold start on hot-loop tools (config validation,
  rule linting)
- Developer sentiment: 4 engineers reported "noticeably snappier"
  CI feedback within first week

### Negative
- Two runtimes to support; documentation must specify which
- Some npm packages with native bindings have Bun-compat issues
- Bun v1.1 is the floor; we are committed to follow Bun's release cadence

## Invariants

- Production server processes stay on Node 20 LTS until Bun reaches
  parity (revisit 2027-Q2)
- New tooling scripts use Bun unless they pull in a known-incompatible
  dependency

## Valid Until

`valid_until: 2027-04-08`

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| ADR-003 | informs (monorepo tooling) |
| EVID-026 | informs |


