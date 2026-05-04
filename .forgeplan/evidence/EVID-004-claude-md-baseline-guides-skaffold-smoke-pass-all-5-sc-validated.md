---
created: 2026-05-04
depth: tactical
id: EVID-004
kind: evidence
links:
- target: PRD-001
  relation: informs
status: active
title: 'CLAUDE.md baseline + guides/ skaffold: smoke PASS, all 5 SC validated'
updated: 2026-05-04
---

# EVID-004: CLAUDE.md baseline + guides/ skaffold: smoke PASS, all 5 SC validated

| Field       | Value                                                  |
| ----------- | ------------------------------------------------------ |
| Status      | Draft                                                  |
| Created     | 2026-05-04                                             |
| Valid Until | 2026-08-04 (3 months — re-verify if CLAUDE.md changes) |
| Target      | PRD-001                                                |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Measurement

Two-part verification of PRD-001 acceptance criteria, run on `main` after
all CLAUDE.md edits + `guides/` scaffold landed but **before activation**.

### Part A — regression smoke

`npm run smoke` on the same scratch directory + `forgeplan-shim` that CI
uses. Builds `dist/`, scaffolds `.forgeplan-web/` into a temp dir twice
(once fresh, once `--force`), starts the server on a random port, and
hits `/api/health`, `/api/list`, `GET /`.

### Part B — acceptance checks (PRD-001 SC-1..SC-5 + NFR-001)

Direct shell measurements:

```bash
# SC-1: red lines block position
grep -n "🔴 Red lines" CLAUDE.md           # → line 22 (≤ 30% of 293)

# SC-2: guides reference
grep -n "guides/INDEX.md" CLAUDE.md        # → line 280

# SC-3: health blind_spots
forgeplan health --json | jq '.blind_spots'  # → []

# SC-4: guides files
ls guides/                                  # → 3 files

# NFR-001: line cap
wc -l < CLAUDE.md                           # → 293
```

## Result

### Part A — regression smoke

```
[smoke] init -y (run 1)              → ✓ ready
[smoke] gitignore: 1 match (preserved user content)
[smoke] init -y --force (run 2)      → ✓ ready (idempotent)
[smoke] gitignore: still 1 match     (idempotent)
[smoke] start (PORT=15899)           → Listening on http://127.0.0.1:15899
[smoke] /api/health: ok (project=shim)
[smoke] /api/list: ok (0 entries)
[smoke] GET /: ok (HTML returned)
[smoke] PASS
```

Exit code 0. No regressions in `bin/`, `scripts/`, `template/`, `dist/`.

### Part B — acceptance

| ID      | Target                                      | Measured | Verdict |
| ------- | ------------------------------------------- | -------- | ------- |
| SC-1    | Red lines block before line 87 (30% of 293) | line 22  | ✅ pass |
| SC-2    | `guides/INDEX.md` referenced ≥ 1            | 1 match  | ✅ pass |
| SC-3    | `blind_spots: []`                           | `[]`     | ✅ pass |
| SC-4    | `guides/` has 3 files                       | 3 files  | ✅ pass |
| SC-5    | `node scripts/smoke.mjs` exit 0             | 0        | ✅ pass |
| NFR-001 | `wc -l CLAUDE.md` ≤ 350                     | 293      | ✅ pass |

## Interpretation

PRD-001 acceptance is fully met:

- All 5 SMART success criteria pass with measured values.
- The non-functional cap (NFR-001) is well within budget (293/350 = 84%).
- The regression smoke proves the documentation-only change did not
  affect any of the surfaces this repo ships (`bin/`, `dist/`, `template/`).

The `forgeplan health` confirms the workspace is healthy after `--force`

- markdown restore + reindex (5 active artifacts, 4 typed links, 0 blind
  spots, 0 orphans, 0 at-risk).

PRD-001 is ready for activation per rule 11 (`R_eff > 0` and `active`
before merge).

## Congruence Level Justification

**CL3 (same-context, penalty 0.0)** is justified because:

- The smoke test runs on the **same** code paths the published package
  executes (`bin/forgeplan-web.mjs init/start` + `dist/index.js` server).
  No proxy, no abstraction layer. This is the canonical verification
  surface used in CI (`.github/workflows/smoke.yml`).
- The shell measurements run directly against the artifacts under test
  (the actual `CLAUDE.md` file, the actual `guides/` directory). No
  derived index, no cached snapshot.
- `evidence_type: test` rather than `measurement` because the smoke
  script is an automated test (asserts, exit codes), not a manual
  measurement.

## Related Artifacts

| Artifact | Relation | Notes                                           |
| -------- | -------- | ----------------------------------------------- |
| PRD-001  | informs  | This evidence directly tests PRD-001 SC-1..SC-5 |


