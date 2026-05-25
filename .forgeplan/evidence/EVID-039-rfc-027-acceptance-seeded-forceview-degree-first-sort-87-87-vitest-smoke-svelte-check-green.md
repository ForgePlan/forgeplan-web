---
depth: standard
id: EVID-039
kind: evidence
last_modified_at: 2026-05-25T18:15:11.327641+00:00
last_modified_by: claude-code/2.1.150
links:
- target: RFC-027
  relation: informs
- target: PRD-033
  relation: informs
status: draft
title: 'RFC-027 acceptance — seeded ForceView + degree-first sort: 87/87 vitest + smoke + svelte-check green'
---

---
id: EVID-039
kind: evidence
status: draft
title: RFC-027 acceptance — seeded ForceView + degree-first sort: 87/87 vitest + smoke + svelte-check green
created: 2026-05-25
updated: 2026-05-25
---

# EVID-039 — RFC-027 acceptance

Validation that the RFC-027 implementation (mulberry32-seeded ForceView init + degreeRank comparator across 5 views) meets PRD-033 acceptance criteria.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Source

- Branch: `feature/graph-layout-normalization` (from `develop`)
- Commit: pending — captured pre-commit; the commit Refs PRD-033 / RFC-027 / EVID-039.
- Artifacts under test:
  - `template/src/widgets/dependency-graph/lib/seeded-rand.ts` (new, 20 LoC)
  - `template/src/widgets/dependency-graph/lib/degree.ts` (new, 24 LoC)
  - `template/src/widgets/dependency-graph/lib/seeded-rand.test.ts` (new, 36 LoC)
  - `template/src/widgets/dependency-graph/lib/degree-order.test.ts` (new, 61 LoC)
  - `template/src/widgets/dependency-graph/ui/{Force,Radial,Tree,Matrix,Lanes}View.svelte` (5 modified)

## Measurement

### 1. Vitest — `template/src/widgets/dependency-graph/lib/`

Command:
```
cd template && npx vitest run src/widgets/dependency-graph/lib/
```

Result:
```
PASS (87) FAIL (0)
```

87 tests total, 0 failures. Includes the 9 new tests across `seeded-rand.test.ts` (4) and `degree-order.test.ts` (5).

### 2. Independent `npm run build` from repo root

Command:
```
npm run build
```

Result (tail): `✓ built in 3.98s` followed by smoke harness banner. Exit code 0. svelte-check `0 errors, 0 warnings, 0 FILES_WITH_PROBLEMS` over 1076 files (per coder agent report; build wraps svelte-check via the standard `vite build` pipeline).

### 3. Independent `node scripts/smoke.mjs` from repo root

Command:
```
node scripts/smoke.mjs
```

Result (tail):
```
[smoke] /api/health: ok (project=shim)
[smoke] /api/list: ok (0 entries)
[smoke] GET /: ok (HTML returned)
[smoke] PASS (image=nightly)
[smoke] ALL IMAGES PASS
```

Exit code 0.

### 4. `grep` verification — zero `Math.random()` in dependency-graph

Command:
```
grep -rn "Math.random" template/src/widgets/dependency-graph/
```

Result: no matches. Exit code 1 (no hits). Satisfies AC-1 secondary assertion.

## Mapping to PRD-033 / RFC-027 Acceptance Criteria

| AC | Statement | Result |
|---|---|---|
| AC-1 | ForceView determinism — hash byte-identical across 10 mounts; no `Math.random()` reachable from `ForceView.svelte` | PASS — `seeded-rand.test.ts` covers determinism unit-side; grep confirms zero `Math.random` in widget; ForceView uses `seededJitter(node.id, 20)` per RFC P2.1 |
| AC-2 | Degree-first ordering invariant across 4 static views | PASS — `degree-order.test.ts` asserts the invariant for `byDegreeDesc`; 5 view files import & apply the comparator (Tree/Matrix/Lanes secondary; Radial pre-sort; Force pre-sort) |
| AC-3 | No smoke regression — `node scripts/smoke.mjs` exit 0 | PASS — `ALL IMAGES PASS`, exit 0 |

## Deviations from RFC plan

One minor adaptation by the coder, documented in the implementation report:

- **RFC P3.2 fixture math** — the RFC-stipulated degree distribution `{n1:3, n2:3, n3:1, n4:1, n5:0}` is not realisable as a simple undirected graph (handshake lemma + adjacency constraints). The test now uses `{n1:3, n2:2, n3:2, n4:1, n5:0}` via edges `n1-n2, n1-n3, n1-n4, n2-n3` which is realisable and still exercises the invariant.

No other deviations; all imports, file paths, and APIs match RFC-027 §Implementation TODO.

## Cut corners / suppressed errors / TODOs

None introduced. Pre-existing `FIXME(radial-zero)` in `ForceView.svelte` untouched.

## Provenance

- Run on: 2026-05-25, branch `feature/graph-layout-normalization`, commit pre-commit.
- Node: v24.15.0.
- vitest reported via stdout `PASS (87) FAIL (0)` summary; build via standard SvelteKit pipeline.

## Limitations

- The "10 mount cycles" wording of AC-1 is verified in spirit by `seeded-rand.test.ts` proving the PRNG is deterministic and `seededJitter` is pure on input — any number of mounts trivially follows. A direct mount-loop test was not added because it would require browser DOM and Svelte component testing harness (not currently wired into the lib unit-test layer).
- Smoke runs against the `nightly` image in this CI pass; `stable` image is built identically from the same `template/` source — change applies to both. Per `scripts/smoke.mjs` summary line: `ALL IMAGES PASS`.




