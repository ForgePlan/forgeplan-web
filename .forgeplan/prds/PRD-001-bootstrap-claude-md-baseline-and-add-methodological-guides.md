---
created: 2026-05-04
depth: standard
id: PRD-001
kind: prd
priority: P1
status: active
title: Bootstrap CLAUDE.md baseline and add methodological guides
updated: 2026-05-04
---

# PRD-001: Bootstrap CLAUDE.md baseline and add methodological guides

## Problem

`ForgePlanWeb` ships with a working `CLAUDE.md` (208 lines) and 6 enforced
rules in `.claude/rules/`, **but the entry-point file lacks the structural
elements the reference repo (`/Users/explosovebit/Work/ForgePlan/CLAUDE.md`)
established as agent-safety baseline**:

- No top-level **Red lines** block listing irreversible actions. Agent has
  to discover deny-list rules from `.claude/settings.json#permissions.deny`
  and from grepping hooks — both are not in the U-shaped attention zone
  (start of file).
- No **Routing table** — depth selection (Tactical/Standard/Deep/Critical)
  is buried in one prose paragraph (lines 92–94 of the original file).
- No **Forge Mode permission zones** table — agent does not know that
  `.claude/hooks/forge-safety-hook.sh` blocks `npm publish`, `git push --force`,
  `rm -rf /...`. This is dangerous because agent may attempt these without
  knowing they are blocked, then re-attempt with workarounds.
- No reference to **methodological guides** (how to write CLAUDE.md, git flow
  best practices). The reference repo bundles authored guides; this repo has
  no equivalent.
- The **EvidencePack structured-fields trap** (silent CL0 → R_eff = 0.1) is
  mentioned in one sentence with no example — agents miss the trap.

**Impact**: Standard+ tasks executed by agents in this repo are at higher
risk of (a) destructive actions blocked by the hook (wasted context),
(b) skipped methodology (creating EvidencePack without structured fields,
silently scoring 0.1), (c) inconsistent depth routing.

## Target Users

| Persona           | Description                                          | Pain                                                                                  |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Claude Code agent | LLM operating on this repo via `claude-code` harness | Has to grep hooks/rules to know what's blocked; misses cry-wolf U-curve start of file |
| Repo contributor  | Human reading CLAUDE.md before opening a PR          | No quick "what not to do" reference; depth routing buried in prose                    |

## Goals

| ID   | Criterion                                                    | Metric                                         | Target                     | How to measure |
| ---- | ------------------------------------------------------------ | ---------------------------------------------- | -------------------------- | -------------- |
| SC-1 | CLAUDE.md has Red lines block in the first 30% of the file   | `grep -n "🔴 Red lines" CLAUDE.md` line number | line number ≤ 30% of total | shell command  |
| SC-2 | CLAUDE.md references methodological guides                   | `grep "guides/INDEX.md" CLAUDE.md`             | ≥ 1 occurrence             | shell command  |
| SC-3 | `forgeplan health` reports 0 blind_spots after reindex       | `forgeplan health --json`                      | `blind_spots: []`          | jq query       |
| SC-4 | `guides/` exists with 3 files (INDEX + 2 guides)             | `ls guides/`                                   | 3 files                    | shell command  |
| SC-5 | `node scripts/smoke.mjs` passes (no regression in build/bin) | exit code                                      | 0                          | CI smoke       |

## Non-Goals

- Do **not** modify `bin/forgeplan-web.mjs`, `template/`, `scripts/`,
  `package.json`. This is a documentation-only change.
- Do **not** add new `.claude/rules/*.md` files. Existing 6 rules are correct.
- Do **not** change `.claude/hooks/`. Existing 4 hooks stay as-is.
- Do **not** configure an LLM provider in `.forgeplan/config.yaml`. Reset
  to default (gemini block commented out) is intentional — provider config
  is per-developer and lives outside the repo.
- Do **not** delete or rewrite existing artifacts (RFC-001, ADR-001,
  EVID-001/002/003) — only add new ones.

## Functional Requirements

| ID     | Category      | Priority | Requirement                                                           | Acceptance                                                                                     |
| ------ | ------------- | -------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| FR-001 | Agent safety  | Must     | Agent can find red-line rules within the first 60 lines of CLAUDE.md  | Block titled `🔴 Red lines (never do)` exists, lists ≥5 rules, before line 60                  |
| FR-002 | Methodology   | Must     | Agent can pick depth via a 4-row routing table                        | Table with rows Tactical/Standard/Deep/Critical, columns Complexity/Depth/Artifacts/ADI        |
| FR-003 | Methodology   | Must     | Agent has a concrete `## Structured Fields` example for EvidencePacks | Code block with `verdict`/`congruence_level`/`evidence_type` literal values + CL penalty table |
| FR-004 | Agent safety  | Must     | Agent knows what each `.claude/hooks/*.sh` blocks                     | Table listing all 4 hooks with Blocks + When columns                                           |
| FR-005 | Documentation | Must     | Repo has `guides/` directory with index + ≥2 methodological guides    | `guides/INDEX.md` + `CLAUDE-MD-GUIDE.ru.md` + `GIT-FLOW-GUIDE.ru.md` exist                     |
| FR-006 | Documentation | Must     | CLAUDE.md links to `guides/INDEX.md`                                  | `Reference (guides)` section present, mentions all 3 files                                     |
| FR-007 | Recovery      | Should   | RED LINES warns about destructive `forgeplan` commands                | Pending — see future RFC; not in scope of PRD-001                                              |

## Non-Functional Requirements

| ID      | Category      | Requirement                                                                                    | Metric                           |
| ------- | ------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| NFR-001 | Length        | CLAUDE.md stays under 350 lines                                                                | `wc -l < CLAUDE.md` ≤ 350        |
| NFR-002 | Idempotency   | Re-running the bootstrap skill against `guides/` does not duplicate files                      | `ls guides/ \| wc -l` stays at 3 |
| NFR-003 | Compatibility | All existing `.claude/rules/*.md` remain valid (no contradictions with new CLAUDE.md sections) | Manual review by reviewer        |

## Affected Files

- `CLAUDE.md` — modified (~+85 lines)
- `guides/CLAUDE-MD-GUIDE.ru.md` — new (copy from `~/.claude/skills/bootstrap-claude-project/resources/guides/`)
- `guides/GIT-FLOW-GUIDE.ru.md` — new (same source)
- `guides/INDEX.md` — new (from skill template)
- `.forgeplan/config.yaml` — reset to default (per user request after `init --force`)

## Related Artifacts

| Artifact | Relation                                                                          | Status  |
| -------- | --------------------------------------------------------------------------------- | ------- |
| RFC-001  | Existing — describes the published-package pre-build pipeline                     | active  |
| ADR-001  | Existing — describes `init` writing to host `.gitignore`                          | active  |
| EVID-\*  | Smoke evidence for the build pipeline                                             | active  |
| RFC-002  | Will be created — adoption plan + future RED LINE additions                       | planned |
| EVID-004 | Will be created — proves CLAUDE.md baseline and `forgeplan health` post-bootstrap | planned |

## Risks & Mitigations

| ID  | Risk                                                                       | Probability | Impact | Mitigation                                           |
| --- | -------------------------------------------------------------------------- | ----------- | ------ | ---------------------------------------------------- |
| R-1 | Cry-wolf: too many RED LINES dilute attention                              | Low         | Medium | Capped at 7; each tied to a real hook or rule        |
| R-2 | CLAUDE.md grows past attention limit                                       | Low         | Low    | NFR-001 caps at 350 lines                            |
| R-3 | Drift between CLAUDE.md and `.claude/rules/`                               | Medium      | Medium | Always cross-reference rule numbers; reviewer checks |
| R-4 | `forgeplan init --force` recurrence (it deleted artifacts in this session) | Low         | High   | Add to a future RED LINE in a follow-up RFC (FR-007) |

