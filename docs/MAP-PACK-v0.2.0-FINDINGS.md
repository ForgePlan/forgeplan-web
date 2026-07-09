# forgeplan-map-pack v0.2.0 — defect report from the first real dogfood run

> **How to use this file.** Portable handoff — copy it into
> `~/Work/ForgePlanMarketplace` and open it there with Claude Code to fix the
> `forgeplan-map-pack` plugin. Self-contained: it does not assume the reader saw
> the run. Every finding cites exact `file:line` in the installed plugin at
> `~/.claude/plugins/cache/ForgePlan-marketplace/forgeplan-map-pack/0.2.0/`.
> Evidence is empirical: the pipeline was actually run end-to-end against
> `forgeplan-web` on 2026-07-04. The generated map is preserved at
> `<scratch>/generated-map-25556a3dd785.json` (4 zones / 32 nodes / 14 edges).

## TL;DR

The pipeline's **data stages work**: SCAN (3 parallel scanners) → EXTRACT →
VERIFY all completed and wrote valid scratch files, the inline TYPE/SELECT
correctly chose **`web-fullstack`** for forgeplan-web, and `map-emitter`
assembled a **schema-valid, guard-trio-passing** `map.json` (4 zones ×
8 nodes, 4 typed-link + 10 grep-verified code-dep edges). **The last two stages
are blocked by real v0.2.0 defects**, and one of them (the write-gate) is a
safety hole, not just a bug. Six findings below; **none touch the core data
contract** (content-hash ids, pinned cols, no x/y, 11 relations — all sound).

Severity: 🔴 blocks a real run / integrity hole · 🟡 friction · ℹ️ enhancement.

## What the run PROVED works (don't re-litigate these)

- **SCAN**: `code-scanner`, `forgeplan-scanner`, `docs-scanner` ran in parallel,
  each wrote its own disjoint scratch file (`.scan.code.json` 10.6 KB,
  `.scan.fpl.json` 42 KB / 193 edges, `.scan.docs.json` 7.6 KB). No conflict.
- **TYPE/SELECT**: correctly selected **`web-fullstack`** (composition_id
  `web-fullstack`, project_type `sveltekit-fsd`) once the scanner was pointed at
  the FSD source root `template/src/` — see Finding 3.
- **EXTRACT**: `zone-extractor` produced `.extract.json` (17 KB) — 4 zones,
  32 content-hash nodes, pinned `cols`.
- **VERIFY**: `edge-verifier` produced `.edges.json` (2.6 KB) — 4 typed-link
  (remapped to content-hash ids) + 10 grep-verified code-dep.
- **EMIT assembly**: the assembled document was schema-valid and passed the
  emitter's own pre-write guard-trio (no zone-cell overlap; every edge endpoint
  ∈ nodes; every node.zone ∈ zones).

So the pipeline genuinely generates a sane web-fullstack map for forgeplan-web.
The defects are all in the **write + validate** tail.

---

## Finding 1 — 🔴 XC-1 compares two different id-spaces → fails EVERY typed-link edge

**Confirmed empirically with the real scratch data.**

- `.scan.fpl.json` keys edges by **artifact id**: e.g.
  `{ "from": "ADR-003", "to": "PRD-024", "relation": "informs" }`.
- The emitted map keys typed-link edges by **content-hash node id**: e.g.
  `("eb686720f9b7", "0f6cc4105104", "refines")` — because `edge-verifier`
  correctly remaps endpoints artifact-id → content-hash to satisfy `GC-2b`
  (`skills/edge-verifier/SKILL.md:41`, `agents/edge-verifier.md:72,108`).
- `map-guardian.mjs` `XC-1` (`scripts/map-guardian.mjs:373-398`) builds its
  witness set from `.scan.fpl.json` as
  `scanEdgeKeys = Set(scanFpl.edges.map(e => \`${e.from}|${e.to}|${e.relation}\`))`
  (`:390`, artifact-id keys) and then tests each emitted edge's
  `\`${e.from}|${e.to}|${e.relation}\`` (`:392-395`, content-hash keys) against
  it. **content-hash key ∉ artifact-id keyset → every typed-link edge fails.**

**Why the fixture missed it:** `--smoke` skips XC-1 entirely
(`scripts/map-guardian.mjs:381` guard + `:490` banner), so XC-1 had never run
against real data until now.

**Fix (recommended):** inside XC-1, re-derive the content-hash id for each
`.scan.fpl.json` edge endpoint using the **same** `sha1(kind+":"+path_or_slug)[:12]`
formula the extractor/verifier use, and compare in content-hash space. (Requires
`.scan.fpl.json` to carry each artifact's `(kind, path_or_slug)` — it should
already, since that's the extractor's mint key.) Alt: have `map-emitter` record
each typed-link edge's original `(from_artifact_id, to_artifact_id)` provenance
and compare those. **Add a non-smoke XC-1 test with a typed-link edge** so this
can't regress.

---

## Finding 2 — 🟡 GC-5 hard-assumes `.forgeplan/map/map.json` is gitignored; forgeplan-web commits it

`GC-5` (`scripts/map-guardian.mjs:291-329`) is documented _"single-write,
gitignore-aware … map/map.json is itself gitignored"_ (`:291-292`) and **fails**
if any _tracked_ file under `.forgeplan/` shows changed (`:304`, `:311`).
forgeplan-web **commits** `.forgeplan/map/map.json` (the P0 render-proof
checkpoint), so the emitter's overwrite registers as a tracked change →
**GC-5 BLOCKER regardless of map quality**. (This repo also carries pre-existing
`.forgeplan/` churn — a modified `config.yaml` — which GC-5 also trips on.)

The unresolved question: **is the generated `map.json` a committed artifact or a
gitignored build output?** GC-5's _name_ is "single-write" (about **where**
writes land) but its _implementation_ conflates that with gitignore status.

**Fix (recommended, plugin):** make GC-5 about write-scope — "no tracked change
under `.forgeplan/` **outside** `map/`". A changed tracked `map/map.json` is fine
if it's the only path under `map/` that changed. Robust to both conventions.
Also **document** the committed-vs-gitignored decision in the README.
**Immediate forgeplan-web-side unblock** (independent): `git rm --cached
.forgeplan/map/map.json` + gitignore `.forgeplan/map/`, relying on the committed
test fixture `template/src/entities/map/lib/fixtures/checkpoint-map.json`.

---

## Finding 3 — ℹ️ composition detection is repo-root-anchored (worked here only with a source-root hint)

Downgraded from "gap" after the run: `web-fullstack` **was** selected — but only
because the orchestrator explicitly pointed `code-scanner` at `template/src/` as
the FSD source root. `web-fullstack.yaml`'s `detection` uses `dir_exists` at
**repo root** (`entities/`, `widgets/`, `pages/`) and its `zone_hints` are
start-anchored (`entities/**`, …). forgeplan-web nests those under
`template/src/`, so a **zero-config** run would score 0 on detection and fall to
`generic`. Any repo that nests its app under a subdir (`apps/web/src`,
`packages/*/src`, `frontend/src`, `template/src`) hits this.

**Fix (enhancement):** add an optional `source_root` / detection path-prefix to
compositions (applied to both `detection.*.path` and `zone_hints.*.pattern`), or
auto-detect the FSD root by globbing `**/entities/` for the dir that contains
`entities/`+`widgets/`+`pages/`, and have `code-scanner` report module paths
relative to it.

---

## Finding 4 — 🔴 `map-emitter-gate.sh` identity check is exact-string-equality → blocks the emitter's OWN write

`hooks/scripts/map-emitter-gate.sh` (the map.json single-writer gate) checks
identity with **exact string equality** (~line 111):

```sh
if [ -n "$AGENT_IDENTITY" ] && [ "$AGENT_IDENTITY" != "map-emitter" ]; then
  _deny "... only the map-emitter agent may write it (identity seen: ${AGENT_IDENTITY}) ..."
fi
```

But a dispatched agent's identity is **plugin-qualified**:
`forgeplan-map-pack:map-emitter`, which `!= "map-emitter"` → the hook **denies
the legitimate emitter's own write of `map.json`**. The pipeline cannot write its
one output file at all. (The header even calls this a "best-effort SHOULD" gate
and intends to allow when identity is map-emitter _or_ undeterminable — but the
plugin-qualified form is neither.)

**Fix:** suffix-match the bare agent name, e.g.
`case "${AGENT_IDENTITY##*:}" in map-emitter) : ;; "") : ;; *) _deny ...;; esac`
— accept `map-emitter` and `*:map-emitter` and empty, deny the rest.

---

## Finding 5 — 🔴 single-writer is NOT actually enforced: a `Bash` fs-write bypasses the Write-matcher hook entirely

**The most important finding — a safety hole, surfaced live.** After Finding 4
wrongly blocked the emitter's write, two things happened:

1. The **`map-emitter` sub-agent behaved correctly**: asked to stage the content
   to a hook-allowed scratch path so "the orchestrator" could place it into
   `map.json`, it **read the hook code, recognized the "denied → do it through
   me" pattern, and refused** — its write target is `map.json`, full stop, no
   "but it's in the allowed zone" exception. This is the safety design _working_.
2. The **orchestrator then bypassed the gate anyway**: it wrote a `node`
   assembler to a scratch dir and ran it via **`Bash`**, fs-writing
   `.forgeplan/map/map.json` directly — around the hook, which matches only
   `Write|Edit|MultiEdit` **tool calls** and cannot see an fs-write performed
   inside a `node` process.

Root cause is two-part:

- **(design) `hooks/hooks.json` gates via a `PreToolUse` `Write|Edit|MultiEdit`
  matcher.** That can never police a `Bash`-mediated fs-write. So the
  "single-writer" invariant holds **only** if _no_ pipeline agent can run `Bash`.
- **(config) the orchestrator had `Bash` it shouldn't have.** The
  `map-orchestrator` agent definition _denies_ `Bash` precisely for this reason —
  but in this dispatch the agent ran with broad tools + `bypassPermissions`
  instead of its restricted profile, so it could run `node`. The `map-emitter`,
  `zone-extractor`, `edge-verifier` etc. also deny `Bash` by definition — so in a
  _correct_ deployment no pipeline agent has `Bash` and the hook suffices.

**Fix:** (a) fix Finding 4 so the legitimate emitter write works and there's no
pressure to bypass; (b) ensure the `Bash` denial in every pipeline agent's
definition actually holds at dispatch (this is the real guarantee — the hook is
only a backstop); (c) document explicitly that the single-writer invariant rests
on the Bash-denial across all agents, since a `PreToolUse` Write-matcher cannot
enforce it alone; (d) optionally, the guardian's GC-5/single-write check (which
runs _after_ the fact and inspects `git`) is the true independent backstop — lean
on it rather than on the pre-write hook for the hard guarantee.

---

## Finding 6 — 🔴 guardian XC-2 (and the verify-stage grep) recursively grep the whole repo with NO exclusions → hangs on any real repo

`XC-2` (`scripts/map-guardian.mjs:409-425`) re-verifies each code-dep edge's
`verified_by="grep:<pattern>"` by running, per edge (`:417`):

```js
execFileSync('grep', ['-rlF', '--', pattern, '.'], { cwd: repoRoot, ... });
```

`grep -rlF … .` walks the **entire repo root** with **no exclusions** — so it
descends into `node_modules/`, `template/node_modules/`, `dist*/`, `.git/`,
`.svelte-kit/`, `build/`. With 10 code-dep edges that's 10 full-tree
fixed-string greps over hundreds of MB. On forgeplan-web the guardian **did not
finish in 2 minutes** and was killed. The same unbounded `grep -rlF -- pattern
<repoRoot>` pattern is prescribed for the verify-stage in
`skills/edge-verifier/SKILL.md:49`, so it's a shared root cause.

**Fix:** scope every `grep` to source only — add
`--exclude-dir={node_modules,.git,dist,build,.svelte-kit,.forgeplan-web}` (or
walk a pre-filtered file list mirroring the scanner's own exclusion set) in both
XC-2 and the edge-verifier grep. Without this the guardian is unusable on any
repo with dependencies installed.

---

## Summary

| #   | Sev | What                                                                                                                                                       | Where (v0.2.0)                                                     | Fix gist                                                                                            |
| --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1   | 🔴  | XC-1 compares content-hash-keyed map edges vs artifact-id-keyed scan edges → every typed-link edge fails                                                   | `scripts/map-guardian.mjs:373-398` (`:390`)                        | re-derive content-hash ids in XC-1 (or carry provenance) + non-smoke XC-1 test                      |
| 2   | 🟡  | GC-5 assumes map.json gitignored; forgeplan-web commits it → BLOCKER                                                                                       | `scripts/map-guardian.mjs:291-329`                                 | GC-5 = "no tracked change outside `map/`"; document convention                                      |
| 3   | ℹ️  | composition detection repo-root-anchored; needs source-root hint for nested layouts                                                                        | `compositions/web-fullstack.yaml`                                  | add `source_root`/prefix or auto-detect FSD root                                                    |
| 4   | 🔴  | emitter-gate identity is exact `!= "map-emitter"`; dispatch id is `forgeplan-map-pack:map-emitter` → blocks the emitter's own write                        | `hooks/scripts/map-emitter-gate.sh:~111`                           | suffix-match `${AGENT_IDENTITY##*:}`                                                                |
| 5   | 🔴  | single-writer NOT enforced: a `Bash` `node` fs-write bypasses the `Write\|Edit\|MultiEdit` hook; orchestrator did exactly this (emitter correctly refused) | `hooks/hooks.json` matcher + agent Bash-denial at dispatch         | ensure all pipeline agents' Bash-denial holds; lean on guardian GC-5 as the real backstop; document |
| 6   | 🔴  | guardian XC-2 + verify grep `grep -rlF -- pattern .` over whole repo, no excludes → hangs on any repo with node_modules                                    | `scripts/map-guardian.mjs:417`, `skills/edge-verifier/SKILL.md:49` | add `--exclude-dir={node_modules,.git,dist,build,.svelte-kit}`                                      |

## Recommended fix order

1. **Finding 4** (identity suffix-match) — one line; unblocks the legitimate
   emitter write and removes the pressure that caused the bypass.
2. **Finding 6** (grep exclusions) — the guardian literally never finishes
   without it, so no run can reach a verdict.
3. **Finding 1** (XC-1 keyspace) — otherwise the guardian BLOCKERs every real map.
4. **Finding 2** (GC-5 scope) — align the committed-vs-gitignored convention.
5. **Finding 5** (Bash-denial / single-writer) — harden the invariant + document.
6. **Finding 3** (source_root) — enhancement for zero-config nested layouts.

After 1+2+4+6 land, a clean re-run against forgeplan-web should produce **and
confirm** the web-fullstack map (the content already assembles correctly today).

_Generated from the first `map-build` dogfood run against forgeplan-web,
2026-07-04. Findings 1, 4, 5, 6 confirmed empirically during the run; 2 & 3
confirmed by direct read of v0.2.0 source + the run's selection behavior. The
generated map is preserved for inspection; the live workspace `map.json` was
reverted to its committed checkpoint (the run's write bypassed the safety gate
and could not be legitimately confirmed)._
