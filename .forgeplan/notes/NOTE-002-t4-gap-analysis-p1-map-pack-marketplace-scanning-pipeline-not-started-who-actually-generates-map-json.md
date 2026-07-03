---
depth: standard
id: NOTE-002
kind: note
last_modified_at: 2026-07-03T19:58:23.606075+00:00
last_modified_by: claude-code/2.1.199
links:
- target: PRD-036
  relation: informs
- target: RFC-030
  relation: informs
- target: EVID-089
  relation: informs
status: draft
title: 'T4 gap analysis: P1 map-pack (marketplace scanning pipeline) not started — who actually generates map.json'
---

# NOTE-002: T4 gap analysis: P1 map-pack (marketplace scanning pipeline) not started — who actually generates map.json

| Field | Value |
|-------|-------|
| Status | Active |
| Created | 2026-07-03 |
| Valid Until | {auto: +90 days} |
| Context | composed-map / T4 map-pack program |

## Note

Nobody generates `map.json` today. The only artifact rendered by the shipped composed-map
view (PR #164, `feat/idef0-composed-map → develop`, unmerged) is a hand-authored fixture,
`template/src/entities/map/lib/fixtures/checkpoint-map.json` — a deliberate RFC-030
Phase-1 scope decision, not an oversight. No scanner, generator, or pipeline exists in this
repo (`forgeplan-web`) or anywhere else as of this session.

The real generator is **P1**: an 8-agent orchestrated scanning pipeline
(`map-orchestrator`, `code-scanner`, `forgeplan-scanner`, `docs-scanner`, `zone-extractor`,
`edge-verifier`, `map-emitter`, `map-guardian`) that is scoped to live in a **different
repository** — `ForgePlanMarketplace`, as a new plugin `plugins/forgeplan-map-pack/`. It has
not been started: only two loose, git-untracked planning docs (`MASTER-SPEC.md`,
`README.md`) exist there, no plugin skeleton yet.

`forgeplan-web` cannot run this scan itself, and this is architecture, not a gap to close
here. The SvelteKit server is structurally read-only (rule 22, `READ_ONLY_SUBCOMMANDS`
allow-list) and cannot spawn `claude` — a deliberate, documented red line, independently
confirmed by `MASTER-SPEC.md` §23 ("Headless bridge — CUT from MVP, verified impossible as
a web route"). There will never be a "run analysis" button inside forgeplan-web's UI;
scanning happens via a local headless agent the user invokes themselves
(`claude -p '/map-build ...' --allowedTools Read Glob Grep Write`), or eventually a P5
local refresh daemon.

The just-completed compliance audit (EVID-089) independently corroborates this: it lists
the P1 pipeline (plus P2/P3/P5) under "Correctly-scoped-out (deliberate, already
recorded)" — confirmed zero code/route/widget anywhere in `forgeplan-web`. This is a known,
expected absence, not a newly discovered defect.

Whoever picks up P1 should create the Epic → PRD → Spec → RFC → ADR chain **in
`ForgePlanMarketplace`'s own `.forgeplan/` workspace** (not this repo's), following the
concrete shape already laid out in `docs/MAP-PACK-BUILD-BRIEF.md` §5.

See `docs/MAP-PACK-BUILD-BRIEF.md` (full build brief) and `EVID-089` (compliance audit) for
complete detail.

## Related

| Artifact | Relation |
|----------|----------|
| RFC-030 | informs |
| EVID-089 | informs |




