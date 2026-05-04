# `@forgeplan/web` — documentation

Project documentation index. The public landing page is the root
[`../README.md`](../README.md) (also available in [Russian](../README.ru.md)).

## Where to start

| I want to...                           | Go to                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| **Use the package** as an end user     | [`USAGE.md`](USAGE.md) — install, CLI, env vars, what the UI shows                  |
| **Contribute** to the package itself   | [`CONTRIBUTING.md`](CONTRIBUTING.md) — repo layout, dev loop, CI, release procedure |
| **Work with the agent / methodology**  | [`../CLAUDE.md`](../CLAUDE.md) — RED LINES, Forgeplan workflow, hint protocol       |
| **Read the long-form guides**          | [`../guides/INDEX.md`](../guides/INDEX.md) — CLAUDE-MD-GUIDE, GIT-FLOW-GUIDE        |
| **Browse the project's own artifacts** | [`../.forgeplan/`](../.forgeplan/) — PRDs, RFCs, ADRs, Evidence                     |

## Reference layout

```
README.md           ← public landing (en) — install + 60s demo + pillars
README.ru.md        ← Russian translation, same structure

docs/
  README.md         ← (you are here) docs index
  USAGE.md          ← end-user reference: install, CLI, env, server endpoints
  CONTRIBUTING.md   ← contributor reference: layout, dev loop, CI, release flow

CLAUDE.md           ← agent entry point — methodology, RED LINES, git workflow
guides/
  INDEX.md
  CLAUDE-MD-GUIDE.ru.md   ← how to write CLAUDE.md (LLM weaknesses)
  GIT-FLOW-GUIDE.ru.md    ← Git Flow + Conventional Commits + safety

.forgeplan/         ← project's own Forgeplan workspace (markdown)
.claude/
  rules/            ← enforced repo rules (10-comments, 11-forgeplan-required, …)
  hooks/            ← pre/post tool-use safety hooks
  settings.json     ← hook wiring + permissions
```

## Methodology in one paragraph

`@forgeplan/web` follows its own methodology — Forgeplan engineering
cycle (`OBSERVE → ROUTE → SHAPE → BUILD → PROVE → SHIP`). Standard+ work
requires a Forgeplan artifact (PRD/RFC/ADR/Spec/Epic) with `R_eff > 0`
backed by an EvidencePack containing structured fields (`verdict`,
`congruence_level`, `evidence_type`). All non-trivial changes go through
PR from `feature/*` / `fix/*` / `docs/*` / `chore/*` into `develop`,
then `release/v*` into `main`, then a tagged GitHub Release fires the
auto-publish workflow. See [`../CLAUDE.md`](../CLAUDE.md) for the full
playbook.
