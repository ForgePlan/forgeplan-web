---
depth: standard
id: EVID-056
kind: evidence
last_modified_at: 2026-07-01T15:04:39.709668+00:00
last_modified_by: claude-code/2.1.196
links:
- target: RFC-028
  relation: informs
status: active
title: 'Independent adversarial review of IDEF0 T1 core: 9 order-invariance/honesty gaps fixed (68a50cb), vitest 362/362'
---

Independent adversarial code review (generator != verifier) of the IDEF0 T1
keystone diff on `feat/idef0-decomposition-surfaces`, followed by a conformance
fix batch. 4 review dimensions × per-finding adversarial verification (18 agents).

## Summary

- 14 raw findings -> **9 CONFIRMED** (0 uncertain, 5 refuted). After adversarial
  severity correction: **0 blocker, 0 high** — every high downgraded to medium
  because the snapshot-identity path (`structuralSignature`) was already
  order-invariant (it token-sorts) and unaffected.
- Root cause (5 of 9 findings): two ENUMERATED outputs — `diagram.arrows` and
  `forest.derivedLinks` — tracked raw input order, violating SPEC-004 INV-8
  (order-invariance) for the `diagram`/`forest` outputs. Latent (no in-repo
  consumer deep-compares them) but a real frozen-contract gap.
- The INV-8 test fed the same snapshot object twice -> proved purity, not
  order-independence -> the reorder gap slipped through the suite.
- 5 findings correctly REFUTED (e.g. signature kind-injection impossible via
  lowercasing; `relRaw as Relation` guarded by exact-equality + total
  classifyIcom; icomToSide default unreachable behind a decomposition guard).

## Fixes (commit 68a50cb)

1. `diagram.ts` — canonically sort `arrows` before return.
2. `forest.ts` — canonically sort `derivedLinks`; de-dupe parent candidates
   (no phantom E-MULTI-PARENT from a duplicated refines edge).
3. `port.ts` — drop exact-duplicate edges; deterministic `kind` when two rows
   share (id,title) but disagree on kind (the one case that could perturb
   `structuralSignature`).
4. `idef0.test.ts` — real reorder regression test (reorders nodes+edges, asserts
   byte-identical diagram/derivedLinks/outline); replace dead `&& false` honesty
   predicate with a real-iff-canonical assertion.
5. `density.ts` — docstring interval [0,1) -> closed [0,1] (density reaches 1.0
   for a single-root fully-linked forest).

## Verification (against the actual T1 surface)

- `npx svelte-check` -> 0 errors / 0 warnings, 1131 files.
- `npx vitest run` -> 362/362 (33 files); idef0+tier 32/32 (was 31, +1 reorder
  regression that fails pre-fix, passes post-fix).
- Playwright visual: app renders on this code; Force + Tree (tier-lift consumer)
  + Sankey (TYPE_ORDER shim consumer) views intact, no error boundary.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

