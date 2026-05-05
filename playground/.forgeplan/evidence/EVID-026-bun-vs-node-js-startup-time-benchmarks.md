---
depth: tactical
id: EVID-026
kind: evidence
links:
- target: ADR-010
  relation: informs
status: active
title: Bun vs Node.js startup time benchmarks
---

# EVID-026: Bun vs Node.js startup time benchmarks

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-04-08 |
| Valid Until | 2026-10-08 |
| Target | ADR-010 (Bun for new tooling scripts) |
| Author | dev-platform |

## Structured Fields

evidence_type: benchmark
verdict: supports
congruence_level: 2

## Setup

7 representative tooling scripts in our internal CLI:
1. `helios-config validate` (parse 12 YAML files)
2. `helios-tenant list` (single Postgres query, 100 rows)
3. `helios-rule lint` (parse + validate 50 rule files)
4. `helios-export csv` (stream 10k rows to stdout)
5. `helios-bench harness` (orchestrate 4 sub-procs)
6. `helios-doc gen` (TypeDoc + Markdown)
7. `helios-deploy preview` (Pulumi-stack diff)

Each measured 50 times on macOS arm64 (M2) and Linux x86_64
(GH-Actions ubuntu-latest). Reported are median wall-clock from
process spawn to exit.

## Result (median, ms)

| Script | Node 20 | Bun 1.1 | Δ |
|--------|---------|---------|---|
| 1 (config validate) | 142 | 38 | −73% |
| 2 (tenant list) | 184 | 92 | −50% |
| 3 (rule lint) | 421 | 178 | −58% |
| 4 (csv export) | 95 | 84 | −12% |
| 5 (bench harness) | 220 | 198 | −10% |
| 6 (doc gen) | 1,840 | 1,920 | +4% |
| 7 (deploy preview) | 480 | 510 | +6% |

Cold-start dominated scripts (1–3) win big with Bun. I/O-bound or
sub-process-orchestrating scripts (4–7) are roughly equivalent;
doc-gen is slightly slower due to TypeDoc compatibility quirks.

## Compatibility notes

- 6/7 scripts ran unchanged
- `helios-doc gen` needed a Bun-compat shim for one TypeDoc internal
- `helios-deploy preview` works on Bun but suppressed warnings about
  Pulumi's ESM resolution differ — non-blocking

## Interpretation

ADR-010 (Bun for new tooling) supported. Recommend: write new tools
in Bun; do not rewrite existing tools unless their cold-start is a
proven bottleneck.

## Congruence Level Justification

CL2: real internal tooling, but workload mix may not be representative
of all CLIs in the codebase. Larger sample (40+ tools) would yield
CL3.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| ADR-010 | informs |


