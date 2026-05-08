---
depth: standard
id: PRD-016
kind: prd
last_modified_at: 2026-05-08T18:56:39.960252+00:00
last_modified_by: claude-code/2.1.132
status: active
title: PROB-060 slug-canonical identity in Web + snapshot error surfacing
---

## Problem

Forgeplan introduced **slug-canonical identity** (parent-repo PROB-060). Each
artifact now exposes:

- `slug` — canonical, immutable (e.g. `prd-auth-system`)
- `predicted_number` — local hint
- `assigned_number` — stamped by CI bot at merge (`null` for draft)
- `id_display` — `PRD-074` (post-merge) or `PRD-74?` (pre-merge marker)
- `id_canonical` — equals slug, fallback to lowercased display

The Forgeplan CLI (v0.28+) already returns the full identity triple in
its JSON outputs. The Web viewer (`@forgeplan/web` v0.1.13) **discards
these fields** because the route guards and the in-process types
predate the upstream change. Concrete observable effects:

1. **HTTP 400 on pre-merge artifacts.** `/api/get/[id]` route guard
   regex rejects slug input — any artifact whose `assigned_number` is
   still `null` cannot be opened from the side panel.
2. **Silent type erasure.** `ArtifactSummary`, `ArtifactDetail`, and
   `ArtifactSnapshot` strip the five new fields on parse — even when
   the CLI returns them, downstream code cannot use them.
3. **Wrong UI display.** All seven graph view modes, plus the
   `InsightsRail` headers and the `ArtifactPanel` title, render the
   raw `id` without the `?` marker. A draft and an activated artifact
   look identical.
4. **Markdown export drift.** The `Copy as markdown` button emits
   `[PRD-074]` even for unmerged drafts that should read `[PRD-74?]`,
   leaking unstamped identity into shareable artefacts.

Independently of PROB-060, the time-travel slider (PRD-008 / RFC-007)
has a related discoverability defect: when reconstruction in
`shared/server/snapshot.ts` fails (`worktree add` error, missing host
config, reindex failure, list parse error), the user receives a
generic `502 "snapshot reconstruction failed (git worktree or
forgeplan list)"`. Two outstanding markers at `:268-270` and
`:282-284` explicitly note that specific stderr is collapsed into
`null`. Real-world incident (observed today on `@gertsai/shared`):
host workspace gitignored `config.yaml` legitimately, reindex failed
with `os error 2`, and ~60 minutes were spent narrowing the cause
because the API never surfaced which step failed or why.

Both defects share the file `shared/server/snapshot.ts`. Fixing them
together avoids two PRs touching the same module within a release
window and double-validating against the same smoke surface.

## Target Audience

- **Web viewer end users** (developers / tech leads opening Forgeplan
  workspaces in `@forgeplan/web`) — they currently hit 400 errors on
  drafts and cannot distinguish drafted vs activated artifacts visually.
- **`@forgeplan/web` maintainers** — they bear the support cost of
  generic 502 responses on the time-travel slider; this PRD removes a
  recurring mystery from the bug-triage queue.
- **Host workspace authors** with non-canonical `.forgeplan/.gitignore`
  configurations — they receive an actionable error instead of a wall.
- **CLI integration partners** (consumers of `@forgeplan/web` who pin
  Forgeplan CLI versions) — guaranteed forward-compatibility for
  forgeplan ≥ 0.28; legacy 0.27-style outputs continue to render.

## Goals

- **G-1.** The Web viewer represents Forgeplan canonical identity for
  every artifact (slug-aware and legacy) without lossy parsing.
  *Supported by:* FR-001, FR-002, FR-003, FR-004, FR-006, FR-007.
- **G-2.** `/api/snapshot` produces actionable error responses naming
  the failing reconstruction step plus its stderr excerpt, replacing
  the current generic 502.
  *Supported by:* FR-005.
- **G-3.** No regression on legacy hosts (artifacts without slug, hosts
  on forgeplan 0.27 returning the older JSON shape).
  *Supported by:* FR-003 and NFR-003.
- **G-4.** Single PR delivers both the identity-triple work and the
  error-surface work on `shared/server/snapshot.ts` — one review, one
  smoke pass, no second round-trip on the same module.
  *Supported by:* FR-004 and FR-005 sharing the same module.

## Functional Requirements

- [ ] **FR-001:** A Web user can open an artifact whose only stable
      identifier is the slug (e.g. `prd-auth-system`) via the side
      panel — `/api/get/[id]` accepts slug input and returns 200.
- [ ] **FR-002:** A Web user can open a draft artifact via the
      pre-merge display id with marker (e.g. `PRD-74?`,
      URL-encoded `%3F`) and receive 200 with the artifact body.
- [ ] **FR-003:** A Web user opening a legacy artifact without slug
      (raw display id like `PRD-001`) sees the same behaviour as
      before — no 400, no warnings.
- [ ] **FR-004:** Every UI surface that renders an artifact identifier
      uses `id_display` when present, falling back to `id`. Surfaces:
      seven graph view modes, `InsightsRail` (Recent / Drafts /
      Lowest R_eff), `ArtifactPanel` header, markdown export, search
      hits, error toasts.
- [ ] **FR-005:** A Web user scrubbing the timeline sees an
      actionable error toast naming the failing reconstruction step
      (e.g. `host_config_missing` / `commit_unreachable` /
      `reindex_failed`) instead of a generic message.
- [ ] **FR-006:** The `/api/get/[id]` route returns 404 (not 400) when
      a syntactically valid identifier does not match any artifact —
      separating "bad input" from "no such artifact".
- [ ] **FR-007:** The markdown export emits `[PRD-74?](...)` for a
      draft and `[PRD-074](...)` for an activated artifact — preserving
      the marker distinction in shared content.

## Non-Functional Requirements

- **NFR-001 — type safety.** The static-type checkpass MUST report
  `0 errors / 0 warnings` after the change. No `any`, no
  type-suppression comments, no widening to `string` for identifiers.
- **NFR-002 — bundle budget.** Client bundle size MUST NOT grow by
  more than +2 KB gzipped (identity rendering is presentational).
- **NFR-003 — additive type evolution.** Consumers reading
  `ArtifactSummary.id` continue to work without changes; new fields
  are additive only — no rename, no removal.
- **NFR-004 — cross-host smoke.** Verified against at least two host
  workspaces — the `@forgeplan/web` self-host (slug-aware,
  config.yaml committed) and a host with config.yaml gitignored
  (e.g. `@gertsai/shared`).
- **NFR-005 — error-channel discipline.** The stderr excerpt MUST NOT
  leak host filesystem absolute paths beyond the workspace root,
  secrets from environment variables, or internal Forgeplan binary
  paths.
- **NFR-006 — wire stability.** Successful `/api/snapshot` response
  shape MUST remain compatible with the current consumer
  (`widgets/timeline/lib/snapshot-state`). Adding fields is allowed;
  renaming or removing existing fields is not.

## Acceptance Criteria

- **AC-1.** `curl -i /api/get/prd-auth-system` returns `200 OK` with
  the artifact body when a slug-only artifact exists; returns `404`
  (not `400`) when the slug does not match. *(satisfies FR-001 +
  FR-006)*
- **AC-2.** `curl -i /api/get/PRD-74%3F` returns `200 OK` for a draft
  with predicted but unassigned number. *(satisfies FR-002)*
- **AC-3.** `curl -i /api/get/PRD-001` returns `200 OK` for a legacy
  artifact without slug — no regression. *(satisfies FR-003)*
- **AC-4.** Opening a draft in any of the seven graph view modes
  renders the node label with a trailing `?`; opening an activated
  artifact renders without `?`. Verified by Playwright snapshot
  covering all seven views. *(satisfies FR-004)*
- **AC-5.** Static type check after the patch reports `0 errors`.
  *(satisfies NFR-001)*
- **AC-6.** A failing `/api/snapshot` against a host where
  `.forgeplan/config.yaml` is gitignored returns `502` with body
  `{"ok": false, "error_code": "host_config_missing",
  "stderr_excerpt": "..."}`. The stderr excerpt contains the literal
  `os error 2` substring from the underlying reindex. *(satisfies
  FR-005)*
- **AC-7.** A failing `/api/snapshot` against an unreachable SHA
  (e.g. pruned post-rebase) returns `502` with `error_code:
  "commit_unreachable"`. *(satisfies FR-005)*
- **AC-8.** A successful `/api/snapshot` response shape is unchanged
  for existing consumers — the timeline state reducer parses it
  without modification. *(satisfies NFR-006)*
- **AC-9.** Markdown export emits `[PRD-74?](...)` for a draft and
  `[PRD-074](...)` for an activated artifact. *(satisfies FR-007)*

## Non-Goals

- **Not** rewriting the time-travel slider UI (PRD-008 / RFC-007 stays
  current).
- **Not** mutating the host workspace from `/api/snapshot` (rule 22 —
  read-only proxy preserved).
- **Not** auto-fixing the host's `.gitignore` when `config.yaml` is
  missing — the user is told via `error_code` and pointed at
  `guides/FORGEPLAN-GITIGNORE.md`.
- **Not** copying the host's `config.yaml` into the ephemeral
  worktree to mask host misconfiguration. We surface the error; the
  user fixes their gitignore.
- **Not** adding a fallback that hits the npm registry or any
  external service from `/api/snapshot`.
- **Not** changing the wire shape of `/api/list`, `/api/health`,
  `/api/graph`, or any endpoint outside the PROB-060 surface within
  this PRD.

## Constraints / Assumptions

- **Forgeplan CLI ≥ 0.28** is on the host's PATH and returns the
  identity triple. Verified during smoke; if absent,
  `error_code: "list_parse_failed"` is the expected outcome.
- **Legacy artifacts** (73 in the `@gertsai/shared` host that is the
  reproduction surface) lack the slug field; the parser handles them
  via the optional-field rule, no schema bump required.
- **The `?` marker is rendered post-`id_display`** without further
  transformation — the CLI is the source of truth for what the marker
  looks like.
- **Two outstanding error-surface markers in `snapshot.ts:268-284`**
  are addressed in this PRD; the cache-write marker at `:367-369`
  remains and is out of scope.
- **Real-world reproduction available**: `@gertsai/shared` host on
  branch `feat/sprint-3-10-wave-5-polish` is a reliable reproduction
  of `host_config_missing` until that workspace's `config.yaml`
  lands in git.

## Risks

- **Regression on the seven graph view modes.** Rendering changes
  touching every view module are easy to ship inconsistently.
  Mitigation: a shared `displayId(artifact)` helper used by every
  view, plus per-view Playwright snapshots.
- **Wire-shape breakage on `/api/snapshot`.** Changing the response
  envelope is the easiest way to break the timeline reducer.
  Mitigation: add fields only, never remove or rename; cover with the
  existing snapshot-state unit test plus a new contract test.
- **Smoke gap on legacy hosts.** A host pinned to forgeplan 0.27
  returns no identity triple. Mitigation: optional-field types, plus
  AC-3 covers the legacy-only path.

## Related Artifacts

- **PRD-008** — Time-travel slider for workspace history. Provides
  the consumer (`widgets/timeline`) for `/api/snapshot`. This PRD
  preserves PRD-008's wire shape (NFR-006).
- **RFC-007** — Time-travel snapshot reconstruction scrubber UI.
  Defines the original error path; this PRD extends the error path
  with structured `error_code` + `stderr_excerpt`.
- **EVID-020** — F18 acceptance evidence (snapshot reconstruction
  verified end-to-end). Establishes the smoke baseline this PRD must
  preserve.
- **Rule 22** — `/api/*` read-only proxy. This PRD honours it (no
  mutating subcommands added).
- **`guides/FORGEPLAN-GITIGNORE.md`** — Operator-facing remediation
  for `host_config_missing` errors. Linked from the error response.
- **Parent-repo PROB-060** — Source of the slug-canonical identity
  contract. Drives FR-001 / FR-002 / FR-004.

## Refs

Source brief: `PHASE-3-PROB-060-BRIEF.md` (root, untracked). After
this PRD activates, the brief is removed — its contents are absorbed
into PRD-016 plus the corresponding RFC. Real-world reproduction:
`/Users/explosovebit/Work/GertsAi/shared` on
`feat/sprint-3-10-wave-5-polish` produces `host_config_missing`
until the host's `.forgeplan/.gitignore` is corrected per
`guides/FORGEPLAN-GITIGNORE.md`.




