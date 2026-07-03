---
depth: standard
id: EVID-055
kind: evidence
last_modified_at: 2026-07-01T13:04:58.106397+00:00
last_modified_by: claude-code/2.1.196
links:
- target: EPIC-001
  relation: informs
status: active
title: 'Develop graph baseline: edge/spine/density measurement grounding EPIC-001'
---

# EVID-055: Develop graph baseline — edge/spine/density measurement grounding EPIC-001

## Summary

Baseline measurement of the develop-derived forgeplan workspace (2026-07-01)
that grounds EPIC-001's problem premise and fixes its Outcome baselines. This
is a `measurement` EvidencePack against the actual `forgeplan graph/list` surface.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: measurement

## Measurement (111 artifacts, branch feat/idef0-decomposition-surfaces off develop)

- `forgeplan graph --json`: **120 indexed edges** (informs 98, based_on 13,
  refines 9) — equal to the **120 relations declared** in the markdown source of
  truth (`grep -rhoE 'relation:' .forgeplan`). Index == source on develop (the
  earlier 49/113 gap was a thin-branch artifact, not a develop condition).
- Structural spine (`based_on` + `refines`): **22 edges**. `contains` /
  `belongs_to`: **0** anywhere in the 111 artifacts.
- Real decomposition depth: **2** (RFC `refines`/`based_on` PRD; no deeper
  structural chain declared).
- Structural density ≈ **0.095** (« the 0.3 idef0 gate).
- Kinds: prd 32, rfc 26, evidence 43, adr 5, spec 3, epic 1, note 1; **zero**
  `problem`/`solution`.

## What it supports

EPIC-001's premise and framing: the real graph is sparse and shallow, so a
progressive-reveal IDEF0 surface is warranted, and the **honest default render
is tier-stack** until T3 authors the spine (density 0.095 « 0.3). It also fixes
the Outcome baselines — index-fidelity is already 100% on develop; real depth is
2, target ≥3 once T3 mints Epics + `contains`/`belongs_to` edges.

## Method / reproducibility

`forgeplan graph --json | (count edges by relation)`, `forgeplan health` (kind
counts), and `grep -rhoE 'relation:\s*[a-z_]+' .forgeplan --include='*.md'`
(declared-edge count), all on this branch. Re-runnable; deterministic given the
markdown source of truth.


