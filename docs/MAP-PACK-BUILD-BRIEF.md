# forgeplan-map-pack — build brief for `ForgePlanMarketplace`

> **How to use this file.** This is a self-contained handoff brief — copy it into
> `~/Work/ForgePlanMarketplace` and open it there with Claude Code. It does NOT
> assume the reader remembers this conversation. It synthesizes:
> `docs/PROJECT-MAP-SPEC.md` (this repo, byte-identical to
> `~/Work/ForgePlan/dev/forgeplan-project-map.zip`'s `MASTER-SPEC.md`, and to
> `~/Work/ForgePlanMarketplace/forgeplan-map-pack/MASTER-SPEC.md`) — the full
> 23-section vision/schema/architecture document, already written — plus a
> gap analysis against what's actually been built (`forgeplan-web` PR #164),
> plus a concrete, execution-ready task breakdown for what's missing: **P1**,
> the agent pipeline that actually generates `map.json`.
>
> **Read `MASTER-SPEC.md` first for full context — this brief does not repeat
> its reasoning, only extracts what's actionable and adds what's missing**
> (a crisp status snapshot + a build checklist + the recommended Forgeplan
> artifact shape to create when picking this up).

---

## 1. Where things actually stand (verified against real code, 2026-07-03)

| Phase  | What                                                                                                                                                                                                               | Repo                                                                 | Status                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | Renderer: `entities/map` (schema, validator, pure layout engine, poller), `/api/map` (GET-only), `widgets/composed-map` (the 9th graph view — `ComposedMapView`, `ZoneSlab`, `NodeCard`, `EdgeLayer`, `FlowChips`) | `forgeplan-web`                                                      | ✅ **Shipped.** PR #164 (`feat/idef0-composed-map → develop`), backed by RFC-030/SPEC-006/PRD-036 (all `active`). Rendered against a **hand-authored checkpoint fixture** — no scanner exists, nobody has ever generated a real `map.json`. |
| **P1** | **The 8-agent orchestrated scanning pipeline** that actually produces `map.json` from a real project                                                                                                               | **`ForgePlanMarketplace`**, new plugin `plugins/forgeplan-map-pack/` | ❌ **Not started.** Only `MASTER-SPEC.md` + `README.md` exist as loose planning docs in `~/Work/ForgePlanMarketplace/forgeplan-map-pack/` (not even a git-tracked plugin skeleton yet). **This brief is about building this phase.**        |
| P2     | Onboarding: `/onboard` route + tour engine (data-driven state machine, no framework)                                                                                                                               | `forgeplan-web`                                                      | ❌ Not started. Out of scope for this brief — comes after P1 ships a real map.                                                                                                                                                              |
| P3     | Chat (`widgets/map-chat/`) — map-grounded, client-side, cites sources, can drive the camera                                                                                                                        | `forgeplan-web`                                                      | ❌ Not started. Out of scope for this brief.                                                                                                                                                                                                |
| P5     | Local refresh daemon (`forgeplan map serve`) bridging the web UI to a re-scan                                                                                                                                      | both repos                                                           | ❌ Not started. Out of scope for this brief.                                                                                                                                                                                                |

**Hard structural fact, verified against real code (not assumption):** `forgeplan-web`'s SvelteKit server **cannot spawn `claude`** — `template/src/shared/server/forgeplan.ts` only allows a `READ_ONLY_SUBCOMMANDS` allow-list (this is `forgeplan-web`'s own rule 22, a red line). `MASTER-SPEC.md` §23 confirms this independently ("Headless bridge — CUT from MVP (verified impossible as a web route)"). **There will never be a "run analysis" button inside forgeplan-web's UI.** Scanning always happens via a **local headless agent** the user invokes themselves (`claude -p '/map-build ...' --allowedTools Read Glob Grep Write`, proven by the spike's `run.mjs`), or eventually the P5 local daemon. This is why P1 lives entirely in the marketplace repo, not in forgeplan-web.

**Decision already made** (recorded in `MASTER-SPEC.md` §23, from a prior session — do not re-litigate): **build the FULL 8-agent pipeline from the start, not a thin 2-3-agent MVP** ("делаем сразу хорошо"). Five non-negotiable safety controls come with that decision (repeated in §4 below) — they are correctness requirements, not scope you're allowed to cut even under time pressure.

---

## 2. The contract this pipeline must emit — `forgeplan.map/v1`

Full schema is in `MASTER-SPEC.md` §4; the **three non-negotiable invariants** (§1, do not cut even in the thinnest slice):

1. **Layered JSON that is a strict superset of `forgeplan-web`'s `{edges}` model** — `MapEdge` minus its extra keys (`namespace`, `trust`, `verified_by`, `path`) must equal exactly `{from, to, relation}` (verified byte-exact against `forgeplan-web`'s `entities/graph/model/types.ts#GraphEdge` this wave).
2. **Content-hash node IDs**, stable across runs: `sha1(kind+":"+path_or_slug)[:12]` — never derived from a name or a counter.
3. **Nodes carry NO x/y.** Geometry is 100% the output of `forgeplan-web`'s pure `computeComposedLayout()` (already built, P0). If a node in your emitted JSON has x/y, that's a spec violation — the web-side validator (`entities/map/lib/validate.ts`, already shipped) will reject it.

Top-level shape (abbreviated — see `MASTER-SPEC.md` §4 for the full annotated JSON and `forgeplan-web`'s `template/src/entities/map/model/types.ts` for the TypeScript source of truth, already implemented and tested):

```
{
  schema: "forgeplan.map/v1",
  meta: { map_id, status: "proposed"|"confirmed", project_type, composition_id, source_fingerprint, version, agent_run? },
  canvas: { grid:{cols,rows}, gap:{x,y}, margin, cell:{card_w,card_h,card_gap,zpad:{top,side,bottom}} },
  composition: { template, arrangement, entry_zone, placements:[{zone,cell:{row,col,col_span?,row_span?}}], zone_connectors:[{from,to,label}] },
  zones: [{ id, label, sub?, kind, accent, treatment:"neutral-dashed", rule_edge:"off", layout_rule, cols /* PINNED, never derived from node count */, layers?, capacity?, overflow? }],
  layers?: [{ id, zone, label, order }],           // Phase 2+, carry but don't populate yet
  nodes: [{ id, label, kind, zone, layer?, meta?, status?, r_eff?, artifact_id?, provenance?:{source,ref,confidence}, found_at, is_new?, is_mega?, children?, collapsed? }],  // NO x, NO y — ever
  edges: [{ from, to, relation, namespace?:"typed-link"|"code-dep", trust?, verified_by? }],
  flows?: [{ id, name, node_ids, edge_ids?, steps? }],
  increments?: [...]   // Phase 2+, carry but don't populate yet
}
```

**Already built and waiting on the `forgeplan-web` side (P0), do not re-implement, just target it:**

- The full `MapDocument` TypeScript type (`forgeplan-web/template/src/entities/map/model/types.ts`).
- A **14-rule never-throwing validator** (`forgeplan-web/template/src/entities/map/lib/validate.ts`) — mirror its rule list when writing your own emitter-side/guardian-side validation so both sides agree; do not invent a divergent rule set.
- The pure layout engine (`computeComposedLayout`) — **pinned `zone.cols`** is load-bearing for it (append-stability); never emit a zone without an explicit `cols`.
- The checkpoint fixture actually used for the render-proof: `forgeplan-web/template/src/entities/map/lib/fixtures/checkpoint-map.json` — study its shape as a _real, validated, working example_ of everything above, produced by hand for exactly the project you'll eventually be able to point this pipeline at (`forgeplan-web` itself).

---

## 3. The 8-agent architecture to build (P1)

Full design in `MASTER-SPEC.md` §7 and §23 (§23 supersedes §7's earlier sketch — read §23 as authoritative). Summary:

### Roster (each in its OWN isolated Task context — generator≠verifier discipline)

| Agent               | Role                                                                                                                                                                                                                                                                                                  | Profile           | Writes                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| `map-orchestrator`  | Conductor. Dispatches every stage, enforces gates G1–G4, carries only scratch-file paths + content-hashes between stages (never a worker transcript)                                                                                                                                                  | B-orchestrator    | **Nothing.**                                                        |
| `code-scanner`      | Parallel scanner #1 — source tree, manifests, entry points                                                                                                                                                                                                                                            | EMITTER           | `.forgeplan/map/.work/.scan.code.json` (own file only)              |
| `forgeplan-scanner` | Parallel scanner #2 — `.forgeplan/` artifact graph via read-only MCP (`forgeplan_graph`/`list`/`get`)                                                                                                                                                                                                 | EMITTER           | `.forgeplan/map/.work/.scan.fpl.json` (own file only)               |
| `docs-scanner`      | Parallel scanner #3 — README/docs, extracts RU narration for zones/flows **from real prose, never invented**                                                                                                                                                                                          | EMITTER           | `.forgeplan/map/.work/.scan.docs.json` (own file only)              |
| `zone-extractor`    | THE HEART. Merges the 3 scratch files → zones/layers/nodes/mega-nodes via the chosen composition's `zone_hints`; mints content-hash IDs; **pins `cols`**; >8 nodes in a zone → collapse into a mega-node                                                                                              | EMITTER           | reads the 3 scratch files, writes its own extraction scratch        |
| `edge-verifier`     | Splits edges into `typed-link` (from `forgeplan_graph`, high trust) vs `code-dep` (requires a grep pass recording `verified_by`; **unverified code-dep is DROPPED**, never emitted as noise)                                                                                                          | EMITTER           | its own scratch                                                     |
| `map-emitter`       | **THE SOLE WRITER of `map.json`.** Assembles the final document, runs the 3 invariant guards (cell-overlap, every edge endpoint ∈ nodes, every `node.zone` ∈ zones), atomic tmp-rename write, emits `status:"proposed"` + a `<<NEEDS_CONFIRM: N zones, M nodes, K edges (J grep-verified)>>` sentinel | EMITTER           | `.forgeplan/map/map.json` — **exactly this one file, nothing else** |
| `map-guardian`      | Read-only. Runs the deterministic `scripts/map-guardian.mjs` (see §4 below) + an advisory LLM CONCERNS-only review on top. Only the deterministic script may flip `proposed → confirmed`                                                                                                              | B-gate, read-only | Nothing (advisory LLM layer only comments)                          |

### Type classification (which project gets which template)

Pure scoring function, **no LLM**: `score = Σ strong·0.40 + Σ weak·0.15 − Σ negative·0.50` (clamp 0..1). `≥0.70` + gap `≥0.20` → single high-confidence template. `[0.40,0.70)` → single low-confidence, marked `NEEDS_CONFIRM`. `<0.40` → `generic` fallback (one zone per top-level dir, cap 8 — **the floor that always renders something**, never a crash, never an empty map). `.forgeplan/` present → **always** append a `z.decisions` zone regardless of which template won.

**Ship 3 composition templates in the first build** (full library ≈16, but each new one must be _pulled by a real repo_, never pushed speculatively):

- `rust-cli-mcp` (`stack-ttb`) — detected by `.forgeplan/` + `crates/` + `rmcp`. **This is the dogfood + CI fixture**: running the pipeline on the `forgeplan` core repo should reproduce the spike's hand-tuned grid.
- `web-fullstack`/`sveltekit-fsd` (`stack-ttb`) — detected by `entities/`+`widgets/`+`pages/` dirs. **Second dogfood target: run it on `forgeplan-web` itself.**
- `generic` (weighted-grid fallback, score `<0.40`) — the correctness floor.

**Honest, already-known caveat:** `forgeplan-web` and `forgeplan` core are both hybrids that will likely trip the `[0.40,0.70)` ambiguous band on first pass — don't be surprised, don't treat it as a pipeline bug. `MASTER-SPEC.md` §6 already names this and defers the real fix (template blending) to Phase 2.

### Gates G1–G4 (mechanical, fail-closed, orchestrator-checked from scratch files — never silently pass)

1. **scan→extract**: facts actually parsed; ≥1 real module found, or the generic floor engaged.
2. **extract→verify**: every node has a valid 12-hex content-hash id + a `zone` + `provenance`; no duplicate ids; every zone's `cols` is pinned (present, non-null).
3. **verify→emit**: every `code-dep` edge carries a non-empty `verified_by`; every `relation` ∈ the 11 valid relations; every edge endpoint actually resolves to a node.
4. **emit→validate**: the file exists, is schema-valid, is `status:"proposed"`, and carries the `<<NEEDS_CONFIRM…>>` sentinel.

On any gate FAIL → loop back to the named stage. Max 3 rounds, then surface `<<NEED_USER_INPUT>>` — never spin silently.

### The three EMITTER-safe controls (§23 — denylist alone is NOT enough, this was explicitly corrected in a prior review round)

1. **Denylist**: every agent above (except the orchestrator, which writes nothing at all) is allowed `Read, Glob, Grep, Write` + read-only MCP (`forgeplan_graph/list/get`) — **denied**: `Edit` + every `forgeplan_*` mutator (`new/update/link/activate/delete`). This alone makes RED-LINE-class violations (desyncing LanceDB vs markdown) structurally impossible for these agents.
2. **PreToolUse hook** (`hooks/map-emitter-gate.sh`, fail-closed, same shape as the existing `bmad-gate.sh`/`canvas-gate.sh` pattern in this marketplace): denies any `Write` under `.forgeplan/` **except** exactly `map/map.json` and `map/.work/**`; additionally denies a write to `map.json` from any agent identity other than `map-emitter`. The denylist stops the tool category; this hook stops the _path_.
3. **Guardian single-write check** (after the fact): `git status --porcelain .forgeplan/` must show **only** `map/map.json` dirty — catches a stray write the other two controls structurally can't see.

### `map-guardian.mjs` — 6 deterministic checks (mirrors `adr_003_invariant.rs`'s shape; NOT an LLM call)

1. JSON validates against `plugins/forgeplan-map-pack/schemas/map.schema.json`.
2. The 3 §1 invariants **re-derived independently** (not trusting the emitter's own claim): no zone-cell overlap; every edge endpoint ∈ `nodes`; every `node.zone` ∈ `zones`.
3. Mega-node integrity: every `children` id ∈ `nodes`; no DFS cycle.
4. Every `typed-link` `relation` ∈ the 11 valid relations; every `code-dep` has non-empty `verified_by`.
5. **Single-write check** (the EMITTER-safe control #3 above).
6. **Determinism check**: re-derive a sample of node IDs from `(kind, path)`; if `source_fingerprint` is unchanged but an ID differs → **BLOCKER**, this is the core bet (§1) breaking.

Plus 2 cross-source checks a self-check structurally cannot do alone: every `typed-link` edge is independently confirmed to exist in `.scan.fpl.json`/`forgeplan_graph`; each `verified_by` grep pattern is re-run and dropped if now stale.

`exit 0` from this script (and ONLY this script) flips `proposed → confirmed`. The advisory LLM-guardian layer is CONCERNS-only commentary on top — it never gates.

### Headless invocation (already proven, don't redesign)

`claude -p <prompt> --add-dir <repo> --allowedTools Read Glob Grep Write` — this exact shape is what the spike's `run.mjs` already validated end-to-end (a full scan-to-HTML loop on the real `forgeplan` core repo). The playbook you write should shell out the same way, just targeting `map.json` instead of a throwaway HTML file.

---

## 4. Plugin layout to create (mirror the verified precedent exactly)

`~/Work/ForgePlanMarketplace/forgeplan-marketplace/plugins/forgeplan-brownfield-pack/` is the **real, working, already-shipped** plugin `MASTER-SPEC.md` §7 explicitly says to mirror. Its actual on-disk shape (verified this wave):

```
plugins/forgeplan-brownfield-pack/
├── .claude-plugin/plugin.json     # manifest — name, version, description, keywords, category,
│                                  #   requires.cli (forgeplan version constraint), components{agents,skills,commands,hooks}
├── ARCHITECTURE.md
├── GLOSSARY.md
├── METHODOLOGY.md
├── README.md / README-RU.md
├── SKILLS-INVENTORY.md
├── agents/                        # currently just `discover/`
├── artifact-kinds/
├── examples/
├── integration/
├── mappings/                      # e.g. c4-to-forge.yaml, ddd-to-forge.yaml
├── playbooks/                     # extract-business-logic.md, phase-transitions.md
├── skills/                        # 12 skills, one dir each
└── templates/
```

**Target shape for `forgeplan-map-pack`** (adapt the same convention, do not invent a new one):

```
plugins/forgeplan-map-pack/
├── .claude-plugin/plugin.json     # components.agents = [map-orchestrator, code-scanner, forgeplan-scanner,
│                                  #   docs-scanner, zone-extractor, edge-verifier, map-emitter, map-guardian]
├── ARCHITECTURE.md                 # the 8-agent pipeline diagram + data flow (§5 of MASTER-SPEC.md)
├── README.md / README-RU.md        # process overview — you already have a draft: forgeplan-map-pack/README.md
├── agents/
│   ├── map-orchestrator/
│   ├── code-scanner/
│   ├── forgeplan-scanner/
│   ├── docs-scanner/
│   ├── zone-extractor/
│   ├── edge-verifier/
│   ├── map-emitter/
│   └── map-guardian/
├── skills/                         # MVP: zone-extractor, edge-verifier, map-emitter as skills too
│                                   #   (project-typer + composition-selector stay INLINE ~40-line scorers,
│                                   #    not separate skills, per §11 decision #6 — do not split them out yet)
├── compositions/                  # rust-cli-mcp.yaml, web-fullstack.yaml, generic.yaml — DATA not code
├── schemas/
│   └── map.schema.json            # the ONE schema shared by emitter, guardian, AND forgeplan-web's client
│                                  #   validator — do not let these three drift; this file is the contract
├── scripts/
│   └── map-guardian.mjs           # the deterministic 6-check gate — see §3 above
├── hooks/
│   └── map-emitter-gate.sh        # PreToolUse fail-closed write-path gate — see §3 above
├── playbooks/
│   └── map-build.yaml             # the orchestrated flow: SCAN -> TYPE -> SELECT -> EXTRACT -> VERIFY -> EMIT -> VALIDATE
└── mappings/
    └── discover-to-map.yaml        # Phase-2 bridge to forgeplan-brownfield-pack's discover agent — stub only, do not build yet
```

---

## 5. Recommended Forgeplan artifact shape (create these THERE, in `ForgePlanMarketplace`'s own `.forgeplan/` workspace, following its existing conventions — 40+ ADRs/Epics already live there, verified this wave)

This is Critical/Deep-depth work by this whole ecosystem's own routing rules: cross-cutting (spans multiple new agents + a new plugin), needs independent review before it's trusted. Per the standard depth table: **Epic → PRD[] → Spec[] → RFC[] → ADR[]**, required + review. Do not start writing agent/skill code before these are shaped and validated.

1. **Epic** — "Composed-map generation: forgeplan-map-pack agent pipeline (T4 Phase P1)". Scope: the 8-agent pipeline + guardian + safety controls, targeting the 3 MVP composition templates. Explicitly OUT of scope: P2 onboarding, P3 chat, P5 refresh daemon (those are `forgeplan-web`-side, tracked separately — reference this brief's §1 table).
2. **PRD** — functional requirements. Suggested FRs, each traceable to a `MASTER-SPEC.md` section:
   - FR-1: Scan a target project's code + `.forgeplan/` + docs via 3 parallel, isolated scanners (§23).
   - FR-2: Classify project type via the pure scoring function, select a composition template (§6).
   - FR-3: Extract zones/layers/nodes/mega-nodes with content-hash IDs and pinned `cols` (§7, §19).
   - FR-4: Verify and namespace edges (`typed-link` vs grep-gated `code-dep`), dropping unverified code-dep (§7).
   - FR-5: Emit a schema-valid `map.json` as the sole writer, `status:"proposed"` (§7).
   - FR-6: Deterministically gate `proposed → confirmed` via `map-guardian.mjs`'s 6 checks (§23).
   - FR-7: Reproduce the spike's hand-tuned grid when run on the `forgeplan` core repo, and produce a sane `web-fullstack` map when run on `forgeplan-web` (§12 acceptance, adapted).
   - Acceptance criteria should literally reuse §12's "ACCEPTANCE" bullets and §23's "MVP acceptance" bullets (both already written, don't re-derive).
3. **Spec** — the technical contract: full `forgeplan.map/v1` JSON Schema (this brief's §2, `MASTER-SPEC.md` §4 verbatim), the 3 invariants, the 6 guardian checks as testable assertions, the gate G1–G4 pass/fail conditions (§3/§23 above), the EMITTER-safe 3-control requirement as a MUST section.
4. **RFC** — the architecture: the 8-agent roster + responsibilities + dispatch order (this brief's §3), the plugin file layout (this brief's §4), the composition-template scoring formula (§6), the headless invocation mechanics (`claude -p ...`), and explicit **Options Considered** — at minimum, weigh "8-agent full pipeline" (chosen, already decided in `MASTER-SPEC.md` §23) against a thinner "3-agent MVP" alternative (explicitly rejected in §23, but a real RFC should still show the comparison for the record, mirroring how `forgeplan-web`'s own RFC-030 documented its rejected Option 2/3).
5. **ADR(s)** — freeze at minimum these two decisions (both already made, both worth a permanent record so a future contributor doesn't re-litigate them):
   - "Build the full 8-agent pipeline from the start, not a thin MVP" — with the 5 non-negotiable safety controls as binding consequences (§23's "BUILD DECISION").
   - "The guardian gate is a deterministic script; LLM review is advisory-only, never gating" — mirrors this ecosystem's own `adr_003_invariant.rs` precedent pattern.

**Run `forgeplan reason` (ADI, ≥3 hypotheses) on the PRD before finalizing it** — this project's own rule 11 makes this mandatory at this depth, and it's genuinely useful here: the composition-template scoring thresholds (`0.70`/`0.40`/`0.20` gap) and the "3 templates at MVP" scope line are exactly the kind of parameter that benefits from an explicit alternatives-considered pass, even though `MASTER-SPEC.md` already leans hard toward specific numbers.

---

## 6. Open questions to resolve when picking this up (not yet decided anywhere)

- **OQ-1**: Which repo does the FIRST real (non-checkpoint) `map.json` get generated against — `forgeplan` core (the dogfood target named in §12) or `forgeplan-web` itself? Recommend `forgeplan` core first since it's the flagship demo target `MASTER-SPEC.md` explicitly anchors acceptance to, but confirm before starting.
- **OQ-2**: Where does `map-guardian.mjs` and `map-emitter-gate.sh` actually live at runtime — packaged inside the plugin (`plugins/forgeplan-map-pack/scripts/`, `hooks/`) as this brief's §4 lays out, or does the marketplace's plugin-loading convention need something different? Check `forgeplan-brownfield-pack`'s actual hook-wiring (`.claude-plugin/plugin.json#components.hooks`, currently empty `[]` there — brownfield-pack apparently doesn't use hooks yet, so there's no existing precedent to copy verbatim; this may need fresh design against however OTHER plugins in this marketplace wire hooks, e.g. check `agents-canvas`'s `canvas-gate.sh` wiring, referenced in this brief's §3 as the shape to mirror).
- **OQ-3**: Confirm `forgeplan` CLI version requirements — `forgeplan-brownfield-pack`'s manifest pins `>=0.25.0` for playbook-runtime + ingest-engine features; check what `map-build.yaml`'s playbook needs and pin accordingly.
- **OQ-4**: The full ≈16-composition library (§6) is explicitly Phase 2 ("each new one must be PULLED by a real repo, not pushed") — do not attempt to pre-build compositions beyond the 3 MVP ones (`rust-cli-mcp`, `web-fullstack`, `generic`) no matter how tempting it is to be thorough here; this is one of `MASTER-SPEC.md`'s own explicit scope-discipline calls.

---

## 7. Source documents (all already exist, none need to be rewritten, only executed against)

- `~/Work/ForgePlanMarketplace/forgeplan-map-pack/MASTER-SPEC.md` — the full 23-section vision/schema/architecture (byte-identical copy also at `forgeplan-web/docs/PROJECT-MAP-SPEC.md`).
- `~/Work/ForgePlanMarketplace/forgeplan-map-pack/README.md` — process-focused companion (agent roster, gates, `.forgeplan/map/map.json` ownership) — narrower scope than MASTER-SPEC.md, useful as a quick-reference once you've read the full spec once.
- `~/Work/ForgePlan/dev/forgeplan-project-map.zip` — also contains `spike/index.html` (the ground-truth interactive prototype `computeComposedLayout`/tokens/`curve()` were ported from — **already fully ported into `forgeplan-web`, P0 is done, do not re-port it**), `run.mjs` (the proven headless-invocation loop), and the `forge-diagram` skill (style reference, already superseded by the real `ComposedMapView.svelte` implementation).
- `forgeplan-web` PR #164 + its evidence chain (EVID-081 through EVID-088) — the actual, working P0 renderer this pipeline must target. Worth a skim before designing the emitter so the JSON you plan to produce is validated against the REAL, already-shipped `entities/map/lib/validate.ts`, not a re-derived guess.
