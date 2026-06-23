# Domain Glossary

Terms an `fpl-skills` agent must use precisely when working in this
repo. Slang and synonyms get rejected at audit.

## The package surface

- **`@forgeplan/web`** — the published npm package. A tiny CLI that
  scaffolds a pre-built SvelteKit viewer into the user's project.
- **`forgeplan-web`** — the unscoped name of the bin script (also
  reachable as `npx @forgeplan/web …`).
- **`init`** — copies the chosen image (`dist/` for `stable` by default,
  `dist-<name>/` for `--image <name>`) → `<cwd>/.forgeplan-web/`,
  writes `forgeplan-web.json` (recording `image`, `scope`, `version`,
  `workspaceRoot`), appends `.forgeplan-web/` to host's `.gitignore`
  (project scope only). Idempotent.
- **`update`** — refreshes `<cwd>/.forgeplan-web/` to the version
  bundled with the currently-resolved `@forgeplan/web`. The image is
  **sticky**: read from `forgeplan-web.json#image` unless overridden
  with `--image <name>`. Preserves `workspaceRoot` + `createdAt`.
- **`start`** — `spawn('node', '.forgeplan-web/index.js')` with
  `PORT` / `HOST` / `FORGEPLAN_CWD` / `FORGEPLAN_BIN` env. Image-agnostic
  (does not branch on the image name).
- **Image** — a named build artifact of the scaffold. v1 ships
  `stable` (default) and `nightly`. Each image is one `dist*/` directory
  in the published tarball: `stable` → `dist/`, every other →
  `dist-<name>/` (e.g. `dist-nightly/`). All images share the same
  bundle shape (single esbuild ESM file, ~1.8 MB, no `node_modules/`,
  capped at 3 MB); they differ in the feature-flag set declared in
  `forgeplan-web-build.json`. Source of truth: `config/images.json`.
  PRD-030 / RFC-026 / ADR-005.
- **Feature flag** — entry in `config/features.json` with
  `{ id, description, addedIn, expiresIn, owner, rollout }`. The build
  pipeline fails fast when any flag has `expiresIn ≤ currentVersion`
  or when its lifetime exceeds 3 minor versions. Flags MUST graduate
  (promoted into mainline behaviour or dropped) before expiry. v1
  ships an empty registry — framework only. See `config/IMAGES.md`.
- **`--experimental`** — *deprecated*. Alias for `--image nightly`
  with a stderr warning. Removed in 0.3.0.

## Forgeplan terms (do not paraphrase)

- **Artifact** — any markdown file under `.forgeplan/` with a YAML
  frontmatter and a Forgeplan kind. Six kinds: `PRD`, `RFC`, `ADR`,
  `Spec`, `Epic`, `Evidence` (also: `Note`, `Problem`).
- **Lifecycle status** — one of `draft`, `active`, `superseded`,
  `deprecated`, `stale`. `superseded` is **terminal**; never
  reactivate.
- **R_eff** — effective reliability of an artifact. Computed by
  `forgeplan score` as **`min(evidence_scores)` — weakest link, not
  average**. Activation gate (rule 11) requires `R_eff > 0`.
- **EvidencePack** — an artifact of kind `Evidence`. Body MUST
  contain a `## Structured Fields` section with three keys:
  - `verdict` — `supports` / `weakens` / `refutes`
  - `congruence_level` — `0` / `1` / `2` / `3`
    (CL3 = same context, best; CL0 = opposed, worst)
  - `evidence_type` — `measurement` / `test` / `benchmark` / `audit`
  Without all three, the parser silently sets CL0 → `R_eff` collapses
  to 0.1 → activation fails.
- **CL penalty table** — CL3 = 0.0, CL2 = 0.1, CL1 = 0.4, CL0 = 0.9.
  Aim for CL3 (`evidence_type: test` or `measurement` against the
  actual surface, e.g. `node scripts/smoke.mjs` exit 0).
- **Lance index** — `.forgeplan/lance/`, derived vector store rebuilt
  by `forgeplan scan-import` / `forgeplan reindex`. Editing it by
  hand is forbidden.

## Routing depth

Mapped from rule 11. fpl-skills should propose the depth, not pick
silently:

| Depth     | Trigger                             | Required artifacts                   | ADI?           |
| --------- | ----------------------------------- | ------------------------------------ | -------------- |
| Tactical  | 1 file, reversible                  | none / Note                          | —              |
| Standard  | feature 1–3 days, has a choice      | PRD → RFC                            | recommended    |
| Deep      | irreversible, 1–2 weeks             | PRD → Spec → RFC → ADR               | required       |
| Critical  | cross-cutting, strategy             | Epic → PRD[] → Spec[] → RFC[] → ADR[] | required + review |

**ADI** = Atomic Disagreement Investigation, run by `forgeplan reason
<id>` — at least 3 hypotheses, mandatory at Deep+.

## Hint protocol

Every `forgeplan` (CLI or MCP) output ends with one of:

- `Next: <full command>` — run as-is
- `Or: <full command>` — only if `Next:` blocks
- `Wait: <condition>` — retry after condition
- `Done.` — terminal, move on
- `Fix: <full command>` — error remediation

Execute **verbatim**. Never paraphrase or invent placeholders.

## Project taxonomies the viewer renders

| View name | Question it answers                                  |
| --------- | ---------------------------------------------------- |
| Force     | What's connected to what (default)?                  |
| Lanes     | Status flow — draft → active → ...                   |
| Matrix    | Adjacency — which kinds link to which?               |
| Radial    | Hierarchy — Epics at the centre, evidence at the rim |
| Tree      | Parent / child decomposition                         |

These names appear verbatim in UI strings, telemetry, and tests. Do
not rename without an updating Forgeplan artifact + cross-cutting
sweep.

## Branch naming

Per [`../../guides/GIT-FLOW-GUIDE.ru.md`](../../guides/GIT-FLOW-GUIDE.ru.md):

- `feature/<slug>` — new functionality
- `fix/<slug>` — bug fix
- `chore/<slug>` — tooling, deps, docs-without-content-change
- `docs/<slug>` — documentation
- `release/vX.Y.Z` — release candidate (only via Git Flow)
- `hotfix/vX.Y.Z+1` — emergency fix from `main`

Direct push to `main` / `develop` / `release/*` is forbidden (RED
LINE #2 in CLAUDE.md).
