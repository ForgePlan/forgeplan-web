# Session handoff — composed-map (T4) + map-pack dogfood loop

> **Date:** 2026-07-04 → 05 · **Branch:** `feat/idef0-composed-map` · **Repo:** `~/Work/ForgePlanWeb`
> Read this top-to-bottom to resume. It is self-contained: assumes you did NOT see this session.

---

## 0. TL;DR — where we are right now

The composed-map (9th graph view) **renderer is polished and shipped** — it now
matches the reference spike (text clips, flow chips, animated arrows, step
captions, 2D-ready). The **map-generation pipeline** (`forgeplan-map-pack`
marketplace plugin) went through a full dogfood loop: 6 pipeline defects found &
fixed (→ v0.5.0), then 3 output-quality gaps found & fixed (→ **v0.6.0**, merged).

**The ONE thing not yet done:** regenerate `map.json` with v0.6.0 and eyeball it.
The clean re-run was dispatched but **died at Stage-1 SCAN on the weekly API
limit** (now reset). That's the immediate next step.

---

## 1. IMMEDIATE NEXT STEP — regenerate the map with v0.6.0

The API limit is clear now. Re-run the pipeline. **Two must-dos** learned this
session:

1. **Dispatch the orchestrator WITHOUT a name** (plain `subagent_type:
"forgeplan-map-pack:map-orchestrator"`, no `name:`). A _named_ teammate
   dispatch grants a broad profile incl. Bash + bypassPermissions — and a
   Bash-capable orchestrator WILL route around the fail-closed write-hook (a
   prior run did exactly that: wrote `map.json` via a `node` script through Bash
   after the hook denied the emitter). Nameless → restricted profile → can't
   bypass. Also put in the prompt verbatim: _"if any gate/hook blocks a stage, do
   NOT route around it — report and STOP."_
2. **Pre-flight GC-5:** the guardian's GC-5 check fails if there's any _tracked_
   change under `.forgeplan/` outside `map/`. Before running, ensure that's
   clean. (This session I stashed `.forgeplan/config.yaml` for that — see §5.)

Command (or just open a session in this repo and run `/map-build`):

```
claude -p '/map-build' --add-dir /Users/explosovebit/Work/ForgePlanWeb \
  --allowedTools Read Glob Grep Write Task
```

After it lands, **verify the 3 v0.6.0 improvements** by reading `map.json` +
rendering live (see §3):

- **O-1** `node.meta` is a SHORT subline (a tag/path, not a 146-char sentence);
  long prose is in `node.description_ru`.
- **O-2** `flows[]` is non-empty (built from the composition's `flow_hints`).
- **O-3** `canvas.grid.cols >= 2` (zones in a 2D grid, not one vertical column).

If all three hold and it renders clean → **base confirmed**, greenlight the
overlay engine (§6). If any is off, the emitter instructions need another pass
before building on top.

---

## 2. What shipped this session (forgeplan-web, all committed on the branch)

| Commit    | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `527a67f` | **Stats-tab eternal-spinner fix.** `createPoller`'s interval tick aborted the still-pending fetch forever → `state.loading` stuck `true`. Now a tick skips if a fetch is in flight; manual `.refresh()` still immediate. Also `/api/score` timeout 120s→600s (real `forgeplan score --all` measured **7m33s** on this workspace — 170 artifacts + concurrent `forgeplan serve` lock contention). +`poller.render.test.ts` + a `$app/environment` vitest stub alias. |
| `a8d9ac0` | **Actionable empty-state.** "No map yet" now explains `map.json` is _generated_, gives the 2 steps (`/plugin install forgeplan-map-pack@ForgePlan-marketplace`, `/map-build`), links the marketplace plugin docs.                                                                                                                                                                                                                                                   |
| `07a4dc8` | **composed-map layout + spike flow experience.** See §4 detail. Text clip (29/32 overflow → 0), flow chips top-right + "All", clay marching-ants arrows, dim/light, numbered flowcap step bar. `vitest 488/488`, `svelte-check 0`.                                                                                                                                                                                                                                  |
| `5bac5a8` | **`docs/MAP-PACK-OUTPUT-FINDINGS.md`** — the O-1/O-2/O-3 handoff to marketplace (now resolved in v0.6.0).                                                                                                                                                                                                                                                                                                                                                           |

Earlier same session (already merged to `develop`): PRs **#162** (IDEF0 core T1),
**#163** (idef0 view T2), **#164** (composed-map render-proof T4-P1). The
EVID-089 compliance-audit fix-loop (EVID-090/091, NOTE-002) also landed.

---

## 3. How to look at it (live)

- **Instance:** use the forgeplan-web dev server started **with `FORGEPLAN_CWD`**
  (this session that was port **:5179**, pid varies). A plain dev server WITHOUT
  `FORGEPLAN_CWD` (e.g. old :5174) hits a dev-quirk (EVID-085): it resolves the
  workspace into `template/` and reads a non-existent
  `template/.forgeplan/map/map.json` → shows "No map yet" even when the map
  exists. Not a bug in the map — wrong instance.
- **Switch to the Map view:** top pane "Change graph view" → "Map".
- **Flow chips** appear top-right when the map has `flows`. Click one → everything
  dims, the flow path lights clay with animated marching-ants arrows + a numbered
  step caption at the bottom. "All" clears it.

---

## 4. The renderer components (`template/src/widgets/composed-map/ui/`)

- **`NodeCard.svelte`** — truncates `label`+`meta` to a card-width char budget
  with `…` + full text in a `<title>` tooltip (SVG `<text>` has NO css ellipsis —
  this is the fix for the overflow). Has a `lit` (clay) state for active-flow
  members.
- **`EdgeLayer.svelte`** — active-flow edges: clay + `@keyframes march`
  marching-ants (reduced-motion-guarded) + arrowhead markers + relation label at
  midpoint; non-flow edges dim to 0.12.
- **`FlowChips.svelte`** — top-right, `All` + one chip per flow; hidden at 0 flows.
- **`ZoneSlab.svelte`** — `dimmed` prop, opacity 0.45 while a flow is traced.
- **`ComposedMapView.svelte`** — orchestrates; derives `activeFlowObj`; renders the
  bottom `flowcap` numbered step bar (consumes `MapFlow.steps` — was carried but
  never rendered, EVID-089 finding 8d); d3-zoom + §15 nav; the live/empty/error
  discriminant.
- Tests: `nav-contract.render.test.ts` (7 cases incl. flowcap/lit), plus
  `composed-layout.test.ts`, `map.test.ts`, `validate.test.ts`.

**Reusable technique:** measure SVG text overflow live via
`element.getBBox().width` vs card width — gave hard numbers (706px) that made the
bug undeniable.

---

## 5. Repo hygiene to reconcile

- **STASHED — restore it:** `git stash@{0}` = _"WIP on feat/idef0-composed-map:
  5bac5a8"_ holding a `.forgeplan/config.yaml` change (unrelated LLM-provider
  edit) I stashed so GC-5 would pass. **`git stash pop`** to restore — don't lose
  it. (Verify with `git stash list`; `stash@{1}` is an older unrelated one.)
- **`.forgeplan/map/map.json` on disk is a HAND-PLACED PREVIEW**, not a real
  v0.6.0 output: it's the v0.5.0-era generated content (cols=1, 32 nodes) with **2
  demo flows I hand-added** over real node ids to demonstrate the chip experience.
  It is git-modified & revertible. The v0.6.0 re-run (§1) replaces it with the
  real thing.
- Untracked scratch at repo root (`*.png`, `*.yml`, `.playwright-mcp/`,
  `.forgeplan/anomalies-journal.jsonl`) — session debris, not committed.

---

## 6. What's NEXT after the render is confirmed — the overlay engine

User's stated plan (do NOT start before the v0.6.0 base render is eyeballed —
building unverified-on-unverified is the risk):

1. RFC amendment to **RFC-023** (in the marketplace `.forgeplan/`).
2. Orchestrator **multi-detect** in the TYPE stage (a repo can match several
   archetypes, not just one).
3. Emitter **compose** in EMIT + string layout.
4. Base **archetypes** shipped in batches.
5. **Overlays** on top.

The idea (per the user + `COMPOSITIONS-GUIDE.md` shipped in v0.6.0): a composition
= an archetype-by-TYPE, model = base + overlays, 7 accent tokens, shared
constants, depth-agnostic hints.

---

## 7. The map-pack pipeline — how it works + what was fixed

`forgeplan-map-pack` (marketplace plugin, **v0.6.0** on main) is the ONLY thing
that generates `map.json`. forgeplan-web's server structurally cannot (rule 22,
read-only — no "run analysis" button ever). You run `/map-build` locally; it
dispatches an 8-agent pipeline: `map-orchestrator` conducts
SCAN(code‖forgeplan‖docs) → TYPE → SELECT → EXTRACT(zone-extractor) →
VERIFY(edge-verifier) → EMIT(map-emitter, sole writer) → VALIDATE(map-guardian,
deterministic gate; its `exit 0` flips `proposed→confirmed`).

**Two dogfood rounds fixed 9 things** (all resolved upstream — kept here as the
audit trail):

- **Pipeline defects (v0.2.0 → v0.5.0), `docs/MAP-PACK-v0.2.0-FINDINGS.md`:**
  F1 guardian XC-1 compared content-hash-keyed emitted edges vs artifact-id-keyed
  scan edges (failed every typed-link edge); F2 GC-5 hard-assumed `map.json`
  gitignored but forgeplan-web commits it; F4 emitter-gate identity was exact
  `!= "map-emitter"` but dispatch id is `forgeplan-map-pack:map-emitter`; F5
  single-writer not enforced (a Bash `node` write bypasses the Write-hook); F6
  guardian grep `-rlF … .` unbounded → hung on `node_modules`.
- **Output-quality gaps (→ v0.6.0), `docs/MAP-PACK-OUTPUT-FINDINGS.md`:**
  O-1 long `meta`, O-2 zero flows, O-3 single-column layout.

---

## 8. All docs & memory (links)

**In-repo docs** (`~/Work/ForgePlanWeb/docs/`):

- `PROJECT-MAP-SPEC.md` — 749-line master spec (byte-identical to the
  marketplace's `MASTER-SPEC.md`). The authoritative vision/schema/architecture.
- `MAP-PACK-BUILD-BRIEF.md` — the P1 build brief for the marketplace pipeline.
- `MAP-PACK-v0.2.0-FINDINGS.md` — 6 pipeline defects (resolved).
- `MAP-PACK-OUTPUT-FINDINGS.md` — O-1/O-2/O-3 output gaps (resolved in v0.6.0).
- `SESSION-HANDOFF-composed-map-2026-07-05.md` — this file.

**Marketplace** (`~/Work/ForgePlanMarketplace/forgeplan-marketplace/plugins/forgeplan-map-pack/`):

- `README.md`, `ARCHITECTURE.md`, `COMPOSITIONS-GUIDE.md`, `compositions/*.yaml`,
  `scripts/map-guardian.mjs`, `hooks/`, `agents/`, `skills/`.
- Contract artifacts in the marketplace `.forgeplan/`: EPIC-004 → PRD-075 →
  SPEC-003 → RFC-023 → ADR-016 + ADR-017.

**Memory files** (`~/.claude/projects/-Users-explosovebit-Work-ForgePlanWeb/memory/`):

- `idef0-program-decision.md` — the whole IDEF0/composed-map program arc.
- `dispatch-reliability-lessons.md` — sub-agent dispatch gotchas (worktrees,
  mid-task cutoffs, lock contention, the gate-bypass lesson).
- `MEMORY.md` — index.
- Hindsight bank "ForgePlanWeb" — full session reports retained (recall
  "composed-map session handoff" or "map-pack dogfood").

---

## 9. How to work here (conventions that bit us)

- **Ground-truth verify — never trust an agent's self-report.** This session
  agents twice returned empty/false final reports while their real work sat on
  disk; one falsely claimed "committed" when nothing was. Always `git status` /
  `git diff` / re-run tests yourself.
- **Live-render UX testing catches what `svelte-check`/`vitest` can't** — the
  text overflow (706px), the z-order bug, the reactivity `derived_inert` — all
  invisible to static checks, obvious in a browser. Use Playwright on the
  `FORGEPLAN_CWD` instance.
- **`.forgeplan/.lock` contention is normal** (many concurrent `forgeplan serve`
  from other sessions) — retry, never delete the lock.
- **Red lines:** no push to `main`/`develop` (PR-only), no `--no-verify`, no
  `forgeplan init --force`. Map is derived + should be gitignored (but
  forgeplan-web currently commits it — the GC-5 tension).
