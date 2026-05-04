# Forgeplan is required

Every non-trivial change MUST be backed by a Forgeplan artifact. The
Forgeplan workspace (`.forgeplan/`) is the **single source of truth** for
"what was decided, why, and what proves it" — and, by extension, for
"what is being worked on" via artifact status (`draft / active / superseded
/ deprecated / stale`).

## What "non-trivial" means here

Tactical (no artifact required):

- Single-file rename, comment, doc typo.
- Lint / format only.
- One-line bug fix in `bin/forgeplan-web.mjs` or a template file with an
  obvious cause.
- README copy-edit (without changing public behaviour).
- Pure dev-dep bumps in `template/package.json` without API impact.

Standard or deeper (artifact required):

- New CLI flag or subcommand on `bin/forgeplan-web.mjs`.
- New `/api/*` endpoint or change to an existing endpoint's contract.
- Change to `template/` that affects the SvelteKit app's public behaviour
  or its `package.json` runtime deps.
- Change to `package.json#engines`, `bin`, `files`, or `name`.
- Anything that touches `.claude/rules/`.

## Required transitions

- Before opening a PR for a Standard+ change, the driving artifact MUST
  pass `forgeplan validate` (0 MUST errors).
- Before merging, the artifact MUST be `active` AND `R_eff > 0`.
- An EvidencePack MUST contain the structured fields `verdict`,
  `congruence_level`, `evidence_type` in the body — without them the
  parser silently sets CL0 and `R_eff` collapses to 0.1.

## Forbidden

- Reactivating a `superseded` artifact (terminal state).
- Activating a PRD with no evidence (`R_eff == 0`).
- Creating an empty artifact stub and abandoning it.
- Naming specific libraries / frameworks inside PRD functional
  requirements (implementation leakage).

## Rationale

Decisions decay without evidence. Forgeplan binds the decision to its proof
and surfaces stale assumptions before they become incidents. The markdown
files in `.forgeplan/` are the durable record; the Lance index is derived
(`forgeplan scan-import`).
