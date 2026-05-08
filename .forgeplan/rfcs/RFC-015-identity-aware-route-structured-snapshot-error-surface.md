---
depth: standard
id: RFC-015
kind: rfc
last_modified_at: 2026-05-08T18:59:35.024489+00:00
last_modified_by: claude-code/2.1.132
links:
- target: PRD-016
  relation: refines
status: active
title: Identity-aware route + structured snapshot error surface
---

## Summary

Adopt slug-canonical identity (parent-repo PROB-060) inside `@forgeplan/web`
through optional type fields, a single `displayId()` helper, a three-shape
route guard, and a structured error envelope on `/api/snapshot`.
Implements PRD-016. One PR, one touch on `shared/server/snapshot.ts`.

## Motivation

The Web viewer currently rejects valid identifiers from forgeplan ≥ 0.28
(slug, draft-with-marker), discards five identity fields silently, and
collapses every reconstruction failure into one generic 502. PRD-016
captures the user-facing surface; this RFC captures the technical
shape that delivers it without a parent-repo schema migration and
without breaking the legacy 0.27-style consumer path.

The trigger for *bundling* the error-surface fix with the identity
work is single-module locality — both edits land in
`shared/server/snapshot.ts`. Splitting them creates two PRs that both
have to validate against the same time-travel smoke surface within
the same release window; merging them keeps the cost of review and
the smoke matrix to one pass each.

## Context

Existing entry points the work touches (auditable from the diff):

- `template/src/entities/artifact/model/types.ts` — `ArtifactSummary`
  / `ArtifactDetail` declarations.
- `template/src/shared/server/snapshot.ts` — `ArtifactSnapshot`
  interface plus `reconstructFromWorktree()` and `getSnapshot()`.
- `template/src/routes/api/get/[id]/+server.ts` — route guard regex.
- `template/src/widgets/dependency-graph/ui/{Force,Sunburst,Matrix,Lanes,Radial,Tree,Sankey}View.svelte`
  — node-label rendering, seven view modes.
- `template/src/widgets/insights-rail/ui/InsightsRail.svelte` — Recent
  / Drafts / Lowest R_eff list rendering.
- `template/src/widgets/artifact-panel/ui/ArtifactPanel.svelte` —
  side-panel header rendering.
- `template/src/widgets/artifact-panel/lib/markdown-export.ts` — copy
  as markdown.

## Decision

Five interlocking choices.

**D-1: identity triple is optional in shared types, not gated by a
schema bump.** The five new fields land on `ArtifactSummary` as
optional (`?`) properties; `ArtifactDetail` and `ArtifactSnapshot`
inherit. Legacy artefacts simply have `undefined` where the slug
would be. Avoids a coordinated migration with the parent CLI repo.

**D-2: a single `displayId(artifact)` helper in
`entities/artifact/lib/identity.ts`.** Every UI surface that renders
an artefact identifier imports this helper; nothing inlines the
fallback logic. The helper takes the full artefact (or any object
shaped like `{id, id_display?}`) and returns a string — `id_display`
when present, else `id`. This is the single place where the `?`
marker enters the UI.

**D-3: route guard accepts three shapes, not one.** `/api/get/[id]`
replaces the single `^[A-Z]+-[0-9]+$` regex with a normalising
parser:
1. Strip URL-decoding artefacts (already done by SvelteKit).
2. Try `^[A-Z]+-\d+\??$` → display id (with optional marker).
3. Try `^[a-z]+-[a-z0-9-]+$` → slug.
4. Else 400 `invalid_id_format`.
A match passes through to the existing CLI invocation; the CLI is
the source of truth for whether it actually exists. Misses on a
syntactically valid identifier return 404 `artifact_not_found`,
distinguishing "bad input" from "no such artifact" (FR-006).

**D-4: structured error envelope for `/api/snapshot`.** The current
`{ok: false, error: string, status: 502}` becomes:
```
{
  ok: false,
  error_code:
    | "host_config_missing"
    | "worktree_add_failed"
    | "reindex_failed"
    | "list_parse_failed"
    | "graph_parse_failed"
    | "commit_unreachable",
  stderr_excerpt: string,  // <= 1024 chars, sanitized
  at: string,              // pre-existing
  sha: string | null,      // pre-existing
  status: number           // pre-existing
}
```
The success envelope is unchanged (NFR-006). The
`reconstructFromWorktree()` return type evolves from
`Snapshot | null` to a discriminated union
`{kind: "ok", snapshot: T} | {kind: "err", error_code: …, stderr: …}`
so the caller can map directly to the response envelope.

**D-5: stderr sanitisation at the boundary.** A `sanitizeStderr(raw)`
helper strips:
- absolute paths under `/Users/`, `/home/`, `/private/var/` reducing
  them to `<host>/<relative>`,
- `FORGEPLAN_BIN` env value if it shows up as a literal,
- anything matching `^([A-Z][A-Z0-9_]+)=(\S+)` (env-style assignments).
Truncates to 1024 chars at a word boundary. Applied once, at
`getSnapshot()` before composing the response (NFR-005).

## Architecture

```
              ┌─────────────────────────────┐
URL /api/get  │  route guard (D-3)          │
   /<id>     ──▶ normaliser → CLI invocation│
              │  → 404 / 400 / 200          │
              └─────────────┬───────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │ entities/artifact/lib       │
              │   displayId(a) helper (D-2) │ ◀── used by
              │                             │   • 7 graph views
              └─────────────────────────────┘   • InsightsRail
                                                • ArtifactPanel
                                                • markdown-export

              ┌─────────────────────────────┐
URL /api/    │  shared/server/snapshot.ts   │
  snapshot  ──▶ reconstructFromWorktree()   │
              │   returns discriminated     │
              │   union (D-4)               │
              │   ├ ok    → Snapshot        │
              │   └ err   → {code, stderr}  │
              │                             │
              │  getSnapshot()              │
              │   sanitises stderr (D-5)    │
              │   maps to wire envelope     │
              └─────────────────────────────┘
```

## Implementation plan

Eight steps, ordered to keep the type checker happy at every commit
boundary so the work is rebase-friendly.

**T1 — Types (~20 min).** Extend `ArtifactSummary` /
`ArtifactDetail` with the five optional fields. `ArtifactSnapshot`
in `snapshot.ts` mirrors. Run static type check — expect 0 errors.

**T2 — Identity helper (~15 min).** Add
`entities/artifact/lib/identity.ts` exporting `displayId(a)` with
unit tests for the three branches (slug present + display present;
display only; id only).

**T3 — Route guard (~25 min).** Replace the regex in
`api/get/[id]/+server.ts` with the three-shape parser (D-3).
Add unit tests for slug, draft-with-marker, legacy display id, and
invalid input.

**T4 — `reconstructFromWorktree` discriminated union (~40 min).**
Convert the function to return `{kind} | {kind, error_code, stderr}`.
Replace the two outstanding markers (`:268-270`, `:282-284`) with
explicit error returns. Add a pre-flight `git cat-file -e <sha>`
that returns `commit_unreachable` instead of letting `git worktree
add` fail with a less-specific message.

**T5 — `getSnapshot` envelope (~30 min).** Map the discriminated
union to the structured response (D-4). Apply `sanitizeStderr()`
(D-5). Update the unit test for the existing 502 path; add new
tests for each `error_code` variant.

**T6 — UI rendering (~60 min, parallelisable across views).** Each
graph view module imports `displayId` and uses it in node label
rendering. `InsightsRail`, `ArtifactPanel`, and `markdown-export`
likewise. **No view-local fallback logic.** Playwright snapshots
updated to expect the `?` marker on draft fixtures.

**T7 — Smoke harness (~20 min).** A shell smoke that runs
`npm run check` plus `curl` against a self-hosted instance for AC-1
through AC-9, including the failing-host scenario via a temporary
worktree where `.forgeplan/config.yaml` is removed. The smoke
output becomes the EvidencePack body.

**T8 — Cleanup (~10 min).** Delete `PHASE-3-PROB-060-BRIEF.md` from
the repo root (its content is absorbed into PRD-016 + this RFC).
Update `widgets/timeline/ui/Timeline.svelte` error toast wiring to
read `error_code` and pick a localised message instead of forwarding
`error: string`.

Total: ~3h 40min sequential (~2h with one parallel pair on T4 + T6).

## Options Considered

- **Discriminated union vs sentinel value vs throw.** Throw was
  rejected because the timeline reducer treats throws as bugs, not
  recoverable failures. Sentinel was rejected because it forces the
  caller to interpret magic strings. Discriminated union gives type
  exhaustiveness in the static checker (NFR-001).
- **Pre-flight `cat-file -e` cost.** One extra git invocation per
  reconstruction (≈ 5–15 ms). Acceptable: reconstruction itself is
  100–500 ms; the diagnostic value of `commit_unreachable` is high.
  An alternative — parsing `git worktree add` stderr for "fatal: bad
  object" — was rejected as locale-fragile.
- **Helper location: `entities/artifact/lib/identity.ts` vs
  `shared/lib/identity.ts`.** The helper is artefact-specific (it
  knows about `id_display` shape) and follows feature-sliced design;
  it stays in `entities/artifact`. Project-local skill
  `feature-sliced-design` enforces this.
- **Stderr sanitisation: at-boundary vs at-source.** At-boundary
  (the chosen D-5 placement) means a single audit point and avoids
  every error-producing code path having to remember to sanitise. The
  trade-off is that a future logger that logs the raw stderr to disk
  would still capture absolute paths — that's acceptable because
  server-side log redaction is a separate concern (rule 22 governs
  the response surface, not the log surface).
- **Backward compat on the URL: should `?` be supported as raw or
  encoded?** Both. `?` in a path segment is permitted by RFC 3986 §
  3.3 ("reserved character" but allowed in path), but client tooling
  (curl, fetch) commonly URL-encodes it to `%3F`. The route accepts
  both forms.
- **Fallback strategy for `host_config_missing`: copy host's
  `config.yaml` vs surface error.** Copying would mask host
  misconfiguration (PRD-016 Non-Goals). Surfacing teaches the user
  to fix their `.gitignore` per `guides/FORGEPLAN-GITIGNORE.md` —
  same fix for the next user with the same misconfiguration.

## Invariants

- **I-1.** `/api/*` never invokes a mutating forgeplan subcommand
  (rule 22). `cat-file -e` is git, not forgeplan, and is read-only.
- **I-2.** `displayId(a)` is pure — no I/O, no side effects, no
  mutation of `a`. Safe to call inside reactive computations.
- **I-3.** Successful `/api/snapshot` envelope shape is append-only
  across this RFC. No field is renamed or removed.
- **I-4.** `sanitizeStderr()` never returns a string longer than
  1024 chars. Applied at exactly one boundary (`getSnapshot()`),
  never twice.
- **I-5.** Legacy artefacts without slug always render via raw `id`,
  never via empty string or `undefined`-stringification.

## Rollback Plan

Each step is individually reversible.

- **T1 (types) failure:** revert the diff on `types.ts` — fields are
  optional, no consumer required them. Build returns to previous
  shape.
- **T3 (route guard) failure:** revert the diff on
  `api/get/[id]/+server.ts`. Slug input returns to 400 — same as
  pre-PRD baseline.
- **T4 / T5 (snapshot) failure:** revert
  `shared/server/snapshot.ts`. The `error_code` consumers
  (`widgets/timeline`) tolerate the absence of the field by falling
  through to the legacy `error: string` path; tests cover this
  fallback.
- **T6 (UI) failure on a single view:** revert that view's diff
  individually — `displayId(a)` falls back to `a.id` when called on
  a non-slug artefact, so a partial revert leaves the legacy
  rendering intact.
- **Full rollback:** `git revert <PR>` is sufficient; no migration
  to undo, no schema rollback, no cache invalidation. The disk
  cache (`shared/server/snapshot.ts:disk`) persists structured
  snapshot envelopes — they remain readable by the legacy parser
  because the success envelope is wire-compatible (NFR-006).

Rollback decision criteria:

- Static type check fails after merge → revert immediately.
- Smoke against `@gertsai/shared` reports a regression on AC-1..9
  → revert and re-shape.
- Identity rendering inconsistent across the seven views in
  Playwright → revert T6 only; T1–T5 are independent and can stay.

## Out of scope

- The cache-write outstanding marker at `snapshot.ts:367-369` —
  governed separately, would touch the disk-cache layer not the
  reconstruction layer.
- A "snap to nearest live SHA" UI affordance for `commit_unreachable`
  errors — would be a follow-up RFC; this PRD only surfaces the
  error.
- Schema-level enforcement that legacy artefacts populate slug
  retroactively — by design, legacy artefacts coexist (NFR-003).
- Logging changes (server-side stdout / log file format).

## Refs

Implements: PRD-016. Reproduction surface:
`/Users/explosovebit/Work/GertsAi/shared` on
`feat/sprint-3-10-wave-5-polish`. Source brief absorbed:
`PHASE-3-PROB-060-BRIEF.md`.



