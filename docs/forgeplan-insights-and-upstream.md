# Forgeplan insights & upstream findings

Durable notes from working `@forgeplan/web` against **forgeplan 0.33.0** — the
non-obvious things worth keeping, plus the upstream issues they spawned.
Last consolidated: 2026-06-30.

---

## 1. Insights (durable understanding)

### CLI vs MCP are two different contracts

`forgeplan` exposes **different data over the CLI vs the MCP**. `@forgeplan/web`
is a read-only CLI proxy (rule 22 — it shells `forgeplan <cmd> --json`), so it
only ever sees the CLI contract.

- The slug-canonical **identity triple** (`id_display`, `id_canonical`,
  `predicted_number`, `assigned_number`) is **not** in CLI JSON. `list`/`get`
  expose only `id/kind/status/title` (+ a nullable frontmatter `slug` in `get`).
  `id_display`/`id_canonical` exist only in the **MCP** DTO;
  `predicted_number`/`assigned_number` only in markdown frontmatter.
- Consequence for the viewer: the PROB-060 identity-display path (`displayId`,
  the `?` draft marker) is **forward-compatible scaffolding that is dormant** —
  it degrades to the raw `id` because the data never arrives over the CLI. Not a
  bug, not a regression; it activates only if the CLI grows a render projection
  (→ forgeplan#397) or the proxy moves to MCP (would need an ADR vs rule 22).
- **Lesson:** when a viewer feature depends on a field, verify it's in the
  _transport you actually use_, not just "in forgeplan somewhere."

### R_eff is a property of decisions, not evidence

`R_eff = min(scores of an artifact's linked evidence)` — weakest link, 0..1. It
measures _how well-proven a decision is_.

- It is computed for **decisions** (PRD/RFC/ADR/SPEC/EPIC), not for EvidencePacks.
  An EVID's own `r_eff` field is **always 0** (e.g. EVID-008 and the fresh
  EVID-041 both read `r_eff: 0`) — that's "n/a for this kind," not a problem.
  Evidence _feeds_ the parent's R_eff via its CL + verdict.
- A decision with **no linked evidence** → `R_eff = 0`. `draft` is then a
  _consequence_ (rule 11 blocks activation at R_eff = 0), not the cause. Fix =
  link evidence + score + activate (e.g. ADR-002 went 0 → 0.80 once EVID-044 was
  linked).
- The Lance-served `r_eff` in `get`/`list` can be **stale** until a recompute:
  `get PRD-011 --json` returned 0.0 while `score` computed 1.0; `reindex` fixed
  it (→ forgeplan#393 comment, related #392).

### Make mistakes cheap and self-correcting (process model)

Fast autonomous work _will_ produce недочёты. The goal is not zero mistakes but a
loop where each one is caught cheaply and turned into a guardrail:

1. **Revertible PRs into `develop`, never straight to prod** — any miss is one
   `git revert` / closed PR. main/npm only via a deliberate manual release.
2. **generator ≠ verifier** — an independent agent/context re-checks the builder.
   This caught the orphaned claims, the spec-vs-constraint drift, and confirmed
   the hints-engine self-verify.
3. **Every lesson → a rule or a memory.** This session added rule-12 claim
   hygiene, the rule-22 git-reconstruction section, and three memory entries.
   Mistakes compound into rules instead of recurring.

---

## 2. Stats dashboard reading guide (`stats-pulse`, PRD-010)

Four health gauges in the InsightsRail "Stats" tab. _What / how to read / why /
when:_

| Panel                  | What                                                                            | Read it                                                                                                           | Look when                                                                 |
| ---------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **R_eff distribution** | # of _evidenced_ artifacts per trust bucket (0.0…1.0)                           | right-heavy (0.8–1.0) = decisions well-proven; left bars = thin evidence (risk). Unscored artifacts are excluded. | before a release / maturity check → left-heavy means go shore up evidence |
| **Weekly velocity**    | net artifacts progressed/week (activations − new drafts), from the activity log | above zero = forward progress; below = WIP piling up                                                              | retro/standup; a drop fires the "progress slowed" hint                    |
| **Status transitions** | lifecycle moves over 90d (e.g. `draft → active: 18`)                            | high `draft→active` = good throughput; lots of stuck drafts = bottleneck                                          | diagnose flow / bottlenecks                                               |
| **Decay risk**         | coarse at-risk / stale / stale-draft counts from `health`                       | `>0 stale` = rot — refresh or supersede                                                                           | periodic hygiene                                                          |

Quick triage: **Health score + R_eff** (is it solid?), **velocity + transitions**
(is it moving?), **decay** (is it rotting?).

> The same signals are what `/smith` and agents should read to route work — they
> already have the raw data (`health`/`score`/`log --json`); what's missing is the
> plain-language interpretation layer (→ marketplace#167). The `hints-engine`
> (PRD-011) is a first step: it turns these signals into actionable hints.

---

## 3. Upstream issues filed

Things that belong in the CLI or the plugins, not in this read-only viewer.

| Finding                                                                                                            | Where it belongs         | Issue                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------- |
| Identity triple + per-EVID CL/evidence_type not in CLI JSON                                                        | forgeplan CLI            | [forgeplan#397](https://github.com/ForgePlan/forgeplan/issues/397)                        |
| Duplicate artifact-id collision silently overwrites on reindex                                                     | forgeplan CLI            | [forgeplan#394](https://github.com/ForgePlan/forgeplan/issues/394)                        |
| `get`/`list` serve stale `r_eff` until recompute                                                                   | forgeplan CLI            | comment on [forgeplan#393](https://github.com/ForgePlan/forgeplan/issues/393) (rel. #392) |
| `Next: forgeplan score-all` hint — command doesn't exist (`score --all`)                                           | forgeplan CLI            | already [forgeplan#348](https://github.com/ForgePlan/forgeplan/issues/348)                |
| `blindspots`/`decay`/`coverage` lack `--json`                                                                      | forgeplan CLI            | already [forgeplan#374](https://github.com/ForgePlan/forgeplan/issues/374)                |
| AGENT-AUTHORING-GUIDE addendum: claim-hygiene + StructuredOutput-precedence + CLI-vs-MCP (shared agent discipline) | marketplace (fpl-skills) | [marketplace#168](https://github.com/ForgePlan/marketplace/issues/168)                    |
| Profile-B reviewer agents don't reliably emit StructuredOutput under a workflow schema                             | marketplace (agents)     | [marketplace#165](https://github.com/ForgePlan/marketplace/issues/165)                    |
| Read-only reviewer agents self-claim + leak claims on crash                                                        | marketplace (agents)     | [marketplace#166](https://github.com/ForgePlan/marketplace/issues/166)                    |
| `/smith` should consult `forgeplan_claims` + a health/stats digest before routing                                  | marketplace (fpl-skills) | [marketplace#167](https://github.com/ForgePlan/marketplace/issues/167)                    |

---

## 4. Local @forgeplan/web follow-ups (this repo)

Small things to fix here (not upstream):

- **Risk anatomy shows 1.00 for evidence packs.** The ArtifactPanel risk-anatomy
  section computes `riskScore = (1 − R_eff) × decay`; since EVIDs structurally have
  `R_eff = 0` it always reads 1.00 for them — misleading. The graph glow already
  excludes non-scored kinds correctly; the panel section should gate to decision
  kinds (prd/rfc/adr/spec/epic) or show "n/a". (driving artifact: PRD-009/RFC-008.)
- **FR-007 (weakest evidence with CL/type) ships degraded** — unblocks once
  forgeplan#397 lands (then drop the "—" fallback).
- **PRD-017** (Shared Select / view picker) — last remaining draft; build or close.

---

## 5. Hardening already done (2026-06-30)

- **rule-12** — claim hygiene: pre-dispatch `forgeplan_claims` check + post-run
  orphan sweep + force-release on crash. **ADR-002** activated (was draft).
- **rule-22** — documented the git-reconstruction endpoints (`/api/snapshot`,
  `/api/timeline-events`) + the `/api/instance-status` OPTIONS/CORS carve-out.
- **PRD-016 / RFC-015** — reconciled (identity comments corrected to the real
  CLI-vs-MCP contract); the `/api/snapshot` structured-error wire fixed (EVID-040).
- **PRD-010 / RFC-009** — reconciled (dropped the forbidden `/api/pulse` +
  server-written `health-history.json`; client-side compute instead).
