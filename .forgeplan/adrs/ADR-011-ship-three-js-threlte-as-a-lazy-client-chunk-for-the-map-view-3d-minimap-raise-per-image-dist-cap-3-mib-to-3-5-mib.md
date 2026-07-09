---
depth: standard
id: ADR-011
kind: adr
last_modified_at: 2026-07-08T01:40:00.424794+00:00
last_modified_by: claude-code/2.1.202
links:
- target: PRD-030
  relation: informs
- target: PRD-039
  relation: informs
- target: PRD-036
  relation: based_on
status: active
title: Ship three.js + Threlte as a lazy client chunk for the Map-view 3D minimap; raise per-image dist cap 3 MiB to 3.5 MiB
---

# ADR-011: Ship three.js + Threlte as a lazy client chunk for the Map-view 3D minimap; raise per-image dist cap 3 MiB → 3.5 MiB

| Field | Value |
|---|---|
| Status | Draft |
| Date | 2026-07-08 |
| Depth | Deep |
| Decision drivers | client runtime-dependency footprint, packaging size cap, on-demand load, reversibility, governance precedent |
| Decision-makers | autonomous orchestrator + named user (explosivebit) — user explicitly chose "raise the cap to 3.5M" |
| Supersedes | None |
| Superseded-by | (open) |

## Context

The composed-map arc (EPIC-001 T4 → PRD-036 render-proof → PRD-037/RFC-031 drill-down → PRD-038 onboarding) has landed a flat 2D "map" view. **PRD-039** adds a 3D isometric "exploded-pyramid" layered overview in that view's bottom-right corner (replacing the flat 2D navigation minimap **on the Map view only**), so a newcomer can see the whole stack of altitudes at once and jump between them. PRD-039 states the 3D-rendering capability in rule-11-compliant language (no library named in its FRs) and **explicitly defers the packaging-cost decision to a companion ADR** — this ADR is that companion. PRD-039 §Open-Questions Q1 and conflict C-1 name the exact tension: an added 3D render chunk raises packaged image size and presses against PRD-030's per-image dist-size cap.

Rendering a true-3D isometric stack requires a WebGL runtime; the arc chose **three.js + @threlte/\*** (proven earlier this session by the `/iso-spike`). Bundle work performed this session to make that affordable, measured verbatim: unused `@threlte/extras` draco/basis model-loaders (~1.5 MiB) were **stubbed out via a vite alias**; `three` was kept **out of the SSR server bundle** (`ssr=false` + browser-guarded dynamic import → **0 `three` markers in `dist/index.js`**); `three` + Threlte are a **separate lazy client chunk (~808 KiB)** fetched only when the Map view opens. Result: `dist/` went **6.0 MiB → ~3.4 MiB**. The remaining **~808 KiB is `three` itself — irreducible** for the 3D feature; it is already code-split and lazy, but because `init` is a `cp -r` of `dist/`, the whole chunk ships on disk in every image and therefore counts against the per-image cap **regardless of runtime laziness**.

The decision being recorded here is already applied in code: commit **`a6ef030`** ("build(idef0): raise dist cap 3M -> 3.5M for lazy 3D Map minimap") set `IMAGE_DIST_MAX_BYTES = 3.5 * 1024 * 1024` in `scripts/build.mjs`, carrying an explicit `// TODO(iso-adr): record the deliberate bump in an ADR ... before this ships`. This ADR is the record that code comment asked for. Note the drift the ADR must formalize: **PRD-030 NFR-001 / SC-4 and rule 21 still read "≤ 3 MB"**, and the `a6ef030` code comment mis-cites the governing NFR as "NFR-005" (the flag-lifecycle NFR) when the correct citation is **NFR-001 / SC-4 / rule 21** (the size NFR). Prior art strengthens the reversibility story: an earlier "Force 3D — experimental Threlte view mode" (#103/#104, which bumped the experimental cap to 6M) was **reverted** (`7f907dd` / `dffbe25` reverted); the present approach is deliberately narrower — a lazy corner minimap at 3.5 MiB, not a full view mode at 6 MiB.

**ADI note (HARD RULE 2).** `forgeplan_reason PRD-039` was invoked and returned *"LLM provider unavailable or not configured"* — the same workspace-MCP reasoning gap PRD-037/038/039 recorded. The Abduction → Deduction → Induction cycle was therefore run **manually** over the three genuinely contested options and is folded into the Considered-options / Decision-outcome sections below.

## Decision drivers

- **DD-1 (EMPIRICAL CONSTRAINT)**: `three` is ~808 KiB and irreducible for a real 3D isometric render; after stubbing draco/basis (~1.5 MiB) and excluding `three` from SSR, `dist/` still lands at ~3.4 MiB — over the old 3 MiB cap. Source: this session's measured bundle work.
- **DD-2 (PACKAGING CONSTRAINT)**: every published image ships all chunks on disk (`init` = `cp -r dist/`), so a *lazy* chunk still counts against the per-image cap. Source: PRD-030 NFR-001/SC-4, rule 21, ADR-005 (image = build artifact, not runtime config).
- **DD-3 (COLD-START / UX)**: the 3D cost must not tax any non-Map view's load (PRD-039 FR-005 / NFR-002). Source: PRD-039.
- **DD-4 (READ-ONLY / NO NEW SURFACE)**: the minimap is a pure client render of the existing read-only `/api/map` (SPEC-006) data — no new endpoint, no spawn, no network egress. Source: PRD-039 NFR-006, rule 22.
- **DD-5 (REVERSIBILITY / GOVERNANCE PRECEDENT)**: adopting a client runtime dep AND moving a size-discipline governance constant both set precedent; the choice must be cheap to back out. Source: the prior Force-3D revert (`7f907dd`).

## Considered options

### Option 1 — Ship three.js + @threlte/\* as a lazy client chunk in the default image, and raise the per-image dist cap 3 MiB → 3.5 MiB (CHOSEN)

Keep the bundle work done this session (draco/basis stub, `three` out of SSR, `three`+Threlte as a separate ~808 KiB lazy chunk loaded only on Map-view open). Bump `IMAGE_DIST_MAX_BYTES` from `3 * 1024 * 1024` to `3.5 * 1024 * 1024` so the ~3.4 MiB `dist/` clears the assertion.

**Pro**:
- The flagship 3D structural overview ships in the **default** `stable` image — every user gets it with no flag, no discovery cost.
- Download is deferred: the ~808 KiB chunk is fetched only when the Map view opens; non-Map views pay **zero** cold-start (DD-3, FR-005).
- No new server surface / no egress — client-only render of existing `/api/map` data (DD-4, rule 22 intact).
- Reuses this session's already-landed, already-measured bundle reductions (6.0 → ~3.4 MiB); nothing is thrown away.

**Con**:
- +~1.7 MiB install size vs the 2D-minimap baseline; `three`'s ~808 KiB is irreducible and still counts against the on-disk cap despite runtime laziness (DD-1/DD-2).
- Moving the governance cap +0.5 MiB weakens a size-discipline guardrail PRD-030 set deliberately: every future image now has slack it did not have to justify (DD-5).
- Adds a client runtime dependency (`three` + `@threlte/*` + transitive) with its own upgrade/security maintenance surface.

**Verdict**: SUPPORTED — the only option that ships the feature by default while keeping non-Map views cold-start-free; cost is bounded (+0.5 MiB cap, +~1.7 MiB install) and reversible.

### Option 2 — Do nothing: revert the 3D minimap, keep the flat 2D navigation minimap (baseline)

Back out the 3D overview and the cap bump; the Map view keeps the reused flat 2D `Minimap`.

**Pro**:
- Default image stays ≤ 3 MiB; the PRD-030 cap and rule 21 are untouched.
- No new client runtime dependency, no new maintenance/security surface.

**Con**:
- Loses the entire PRD-039 comprehension-at-altitude capability — the "see the whole layered stack at once" goal goes unmet.
- Discards this session's measured bundle work (draco/basis stub, SSR exclusion, code-split) that already made the feature affordable.
- Does not resolve the standing product need; the arc is abandoned rather than shipped.

**Verdict**: REFUTED — meets the size guardrail only by discarding the feature the guardrail exists to serve; no product value delivered.

### Option 3 — Keep 3D, but as an opt-in separate image (`dist-<name>/`) so the default `stable` image stays ≤ 3 MiB

Use the existing image framework (PRD-030 / RFC-026 / ADR-005): ship the 3D chunk only in an opt-in `dist-<name>/` image; `stable` stays lean and only opt-in installs pay the `three` cost.

**Pro**:
- Default `stable` stays ≤ 3 MiB — the guardrail is preserved for the majority who never open the Map view.
- The image framework already exists to carry exactly this kind of variant.

**Con**:
- Fragments the install UX that PRD-030 **just consolidated** — reintroduces a "which image do I pick" decision for a flagship feature that should be default-visible.
- Most users would never see the 3D overview (behind a flag) → large discovery loss for a headline capability.
- Build-pipeline + `init`/`update` flag plumbing + a doubled smoke matrix (build/verify both images) — real engineering cost for a benefit (0.5 MiB leaner default) that the raised cap makes marginal.
- Splits the map feature-set across images: the composed-map view would behave differently depending on which image was installed.

**Verdict**: REFUTED (for now) — defensible size-hygiene, but it buries a default-worthy feature and re-opens the install-UX fragmentation PRD-030 closed; the 0.5 MiB saved does not justify it. Revisit only if a genuine sub-3-MiB "lean" track is demanded (see Open questions).

## Decision outcome

**Chosen option**: **Option 1 — ship three.js + @threlte/\* as a lazy client chunk in the default image, and raise the per-image dist cap 3 MiB → 3.5 MiB.**

Rationale referencing DD-1..DD-5:

1. **DD-1 + measured ~808 KiB irreducible / ~3.4 MiB `dist/`** — after every affordable reduction (draco/basis stub −~1.5 MiB, `three` out of SSR), the artifact still clears 3 MiB by ~0.4 MiB; a 3.5 MiB cap is the smallest bump that admits it.
2. **DD-2 + `cp -r` packaging** — laziness defers the *download*, not the *on-disk* cost, so the cap must move for the default image to ship at all; Option 3's alternative (keep the cap, move the chunk) is what the middle path costs, and DD-5 rejects that overhead.
3. **DD-3 + FR-005 trace** — the lazy chunk keeps every non-Map view cold-start-free, so the +0.5 MiB is paid only by Map-view users, at Map-view-open time.
4. **DD-4 + rule 22** — the minimap is a client-only render of existing read-only `/api/map` data, so this decision adds **no** server/network/trust surface; the cost is purely packaging.
5. **DD-5 + the Force-3D revert precedent** — the change is a one-commit-ish backout (revert `a6ef030` + drop the lazy-chunk import + remove `three`/`@threlte/*` deps → back to the 2D minimap), which the earlier #103/#104 revert already demonstrated is clean.

The decision is **reversible by design** (see Rollback Plan below). This mirrors the already-executed Force-3D revert (`7f907dd`).

**Override note (HARD RULE 2).** The user pre-decided "raise the cap to 3.5M" over the do-nothing and opt-in-image alternatives. The manual ADI cycle above independently reaches the same recommendation (Option 1); the dismissed alternatives are documented in full rather than omitted.

**PRD-030 reconciliation — supersede vs. amend (explicit flag; orchestrator decides at activation).** **Recommendation: an ADR-recorded amendment SUFFICES; do NOT `/supersede` PRD-030.** Reasons: (a) PRD-030 is a broad, active (R_eff 1.0) artifact governing the whole feature-flag/image system — only a **single NFR threshold** moves (3 → 3.5 MiB); superseding it would terminally retire a still-valid, still-governing decision to change one number. (b) `supersede` is terminal and for wholesale replacement; the image system PRD-030 describes is entirely intact. (c) The link is therefore `informs` (this ADR informs/overrides one PRD-030 constraint); `refines` would also be defensible, but `informs` is the recorded relation. The residual editorial drift — PRD-030 NFR-001/SC-4 text, rule 21 text, and the `a6ef030` code comment's mis-cited "NFR-005" all still say/point wrong — is a **fix-forward documentation task**, not a supersede: update those three to read "≤ 3.5 MiB per ADR-011 / NFR-001". Tracked in Open questions.

## Consequences

### Positive

- The 3D isometric overview ships in the **default** image — no flag, no fragmented install UX, full discovery.
- Non-Map views stay cold-start-free: the ~808 KiB chunk is fetched only on Map-view open.
- This session's bundle discipline is preserved and recorded: draco/basis stub (−~1.5 MiB), `three` excluded from SSR (0 `three` markers in `dist/index.js`), code-split lazy chunk → `dist/` 6.0 → ~3.4 MiB.
- Zero new server/network/trust surface — rule 22 untouched (client render of existing `/api/map`).

### Negative

- +~1.7 MiB install size vs the 2D baseline; `three`'s ~808 KiB is irreducible and still counts against the on-disk cap even though lazy.
- The size-discipline guardrail is weakened by +0.5 MiB: every future image now carries slack it did not have to justify — future size regressions have more room to hide before the assertion fires.
- A client runtime dependency (`three` + `@threlte/*` + transitive) is now on the maintenance/security surface (upgrade cadence, advisories).
- The draco/basis stub is a load-bearing vite alias: if a future `@threlte/extras` feature needs the real loaders, the stub silently breaks it. A follow-up item tracks this before any such use.

### Neutral

- The cap constant already sits at 3.5 MiB in code (`a6ef030`) with a `TODO(iso-adr)` pointing at this ADR; this ADR closes it.
- The authoritative packaged-size delta is still to be captured at PRD-039 prove-phase (`du -sb dist*/` EVID); this ADR uses the session measurements verbatim.

## Rollback Plan

If the decision fails (e.g. the 3.5 MiB slack proves unacceptable, `three` becomes a maintenance/security burden, or the 3D minimap is dropped), back out in this order — the earlier Force-3D revert (`7f907dd`) proves this is clean:

1. **Revert the cap bump**: revert commit `a6ef030` so `IMAGE_DIST_MAX_BYTES` returns to `3 * 1024 * 1024` in `scripts/build.mjs`.
2. **Remove the lazy chunk**: delete the Map-view 3D-overview widget's dynamic `three`/`@threlte/*` import so nothing pulls the chunk; the Map view falls back to the flat 2D `Minimap` (PRD-039 FR-007 already specifies an honest 2D fallback).
3. **Drop the deps**: remove `three` + `@threlte/*` from `template/package.json#dependencies`; the vite draco/basis stub alias goes with them.
4. **Rebuild + verify**: `npm run build` must re-pass the (restored) 3 MiB assertion; `npm run smoke` green on the `stable` image.

Trigger for executing this rollback: either Revisit-Trigger metric or event below firing, or a superseding ADR.

## Compliance / Revisit Trigger — MUST

**This decision MUST be re-opened** when any parseable trigger below fires:

- [ ] **Type**: metric — any emitted `dist*/` image exceeds **3.5 MiB** (`IMAGE_DIST_MAX_BYTES`) again.
  - **Verification step**: `scripts/build.mjs` size assertion fails, or `du -sb dist*/` reports > 3,670,016 bytes for any image.
  - **Next-action**: new ADR (`supersedes` ADR-011) deciding split-image vs. a further bump — do NOT silently raise `IMAGE_DIST_MAX_BYTES` again.
- [ ] **Type**: event — `three` is dropped/replaced, or the 3D Map minimap is reverted (cf. the prior Force-3D revert `7f907dd`).
  - **Verification step**: `three` / `@threlte/*` no longer in `template/package.json#dependencies`.
  - **Next-action**: re-open to lower `IMAGE_DIST_MAX_BYTES` back toward 3 MiB (the cap rationale evaporates without the feature).
- [ ] **Type**: date — 2027-01-08 (+6 months from creation).
  - **Verification step**: calendar; a session on/after this date reads this trigger.
  - **Next-action**: reassess whether `three` is still the lightest viable 3D runtime and whether the 3.5 MiB slack is still warranted.

**Mark `[x]` to flag a trigger as fired.** Guardian will BLOCKER any artifact relying on an ADR with `[x]` triggers until the ADR is superseded or the trigger is unchecked with justification.

## Invariants — SHOULD

- **INV-1**: `three` MUST stay **out of the SSR server bundle** — 0 `three` markers in `dist/index.js`; SSR-guarded (`ssr=false` + browser-guarded) dynamic import only.
- **INV-2**: the 3D rendering MUST remain a **separate lazy client chunk** loaded only on Map-view open — never inlined into the base bundle.
- **INV-3**: the raised cap is **3.5 MiB, not a blank cheque** — no image may exceed it without a superseding ADR.
- **INV-4**: the 3D minimap MUST remain a **pure client render of existing read-only `/api/map` data** — no new server surface, no spawn, no network (rule 22).

## Open questions — SHOULD

- The authoritative measured `du -sb dist*/` delta and the ~808 KiB `three`-chunk figure land in **PRD-039's prove-phase EVID** (PRD-039 Q2 / AC-5); this ADR uses the session measurements and the EVID is linked `informs` before activation.
- Whether PRD-030 NFR-001/SC-4 text, rule 21 text, and the `a6ef030` code comment (mis-cited "NFR-005") should be **editorially updated** to "≤ 3.5 MiB per ADR-011 / NFR-001", or left with this ADR as the overriding record (recommend: editorial update, tracked separately — **not** a supersede).
- Whether a future third "lean/LTS" image should carve the 3D chunk out to keep a sub-3-MiB track (defers to ADR-005's image framework — the rejected Option 3 path; not decided here).

## Trust Calculus — chosen option (full-ADR bar: F+G+R ≥ 14)

Scored on the 0–9 rubric for **Option 1**:

- **F (Foundation / factual grounding) = 7** — the load-bearing numbers are concrete and first-party this session: `IMAGE_DIST_MAX_BYTES = 3.5*1024*1024` verified by grep; `a6ef030` verified by git blame; 6.0 → ~3.4 MiB, ~808 KiB, −~1.5 MiB draco/basis, 0 SSR `three` markers given verbatim. Not yet 9 because they are not yet captured in a linked EVID.
- **G (Generality / robustness of reasoning) = 7** — three genuine options incl. do-nothing and the opt-in-image middle path; the core reasoning ("laziness defers download not on-disk cost; `cp -r` ships all chunks") generalizes.
- **R (Reliability of sources) = 6** — sources are the working tree (grep), git history (blame/log), and the PRD bodies (read) — high reliability, but the packaging-delta EVID (`du -sb dist*/`) is still to be minted at PRD-039 prove-phase.

**Sum = 20 ≥ 14 → proceed; no `evidence-gatherer` dispatch required.** R is deliberately capped pending the prove-phase EVID; that gap is surfaced in Consequences/Neutral and Open questions rather than papered over.

## Affected Files

Informative scope (not requirements) — the actual code change is owned by PRD-039's build/RFC phase:

- `scripts/build.mjs` — `IMAGE_DIST_MAX_BYTES` 3 → 3.5 MiB (already applied in `a6ef030`); the `TODO(iso-adr)` comment closed by this ADR.
- `template/package.json` — new `dependencies`: `three` + `@threlte/*`.
- `template/vite.config.ts` (or equivalent) — the draco/basis stub alias + the `ssr=false` / code-split wiring keeping `three` out of `dist/index.js`.
- `template/src/widgets/…` — the on-demand-loaded 3D Map-view overview widget (dynamic import site).
- **Governance docs to reconcile (fix-forward, not part of this decision's activation)**: `.claude/rules/21-template-purity.md` (cap text 3 → 3.5 MiB), and PRD-030 NFR-001/SC-4 text — see Open questions.
- **Unchanged**: `bin/` (rule 23 untouched — still `node:*` + `citty`); the read-only `/api/map` server surface (rule 22 untouched).

## References

- **PRD-039** — parent product spec (3D isometric layered overview minimap); this ADR is the "companion ADR" PRD-039 Q1/C-1 defers the cap decision to.
- **PRD-030 (NFR-001 / SC-4)** — the per-image dist-size cap this ADR amends (3 → 3.5 MiB); rule 21 mirrors it.
- **PRD-036** — Phase-1 composed-map render parent (lineage); provides the minimap slot replaced on the Map view.
- **rule 21** (`.claude/rules/21-template-purity.md`) — `dist*/` size cap assertion; **rule 22** (`.claude/rules/22-readonly-proxy.md`) — read-only proxy boundary (untouched).
- **ADR-005** — "Image as build artifact, not runtime config" — the image framework the rejected Option 3 would have used.
- **RFC-026** — build-pipeline architecture for the image system (cap assertion lives in `scripts/build.mjs`).
- **commit `a6ef030`** — "build(idef0): raise dist cap 3M -> 3.5M for lazy 3D Map minimap" (the applied change + `TODO(iso-adr)`).
- **commit `7f907dd` / `dffbe25` (#103 / #104)** — the reverted "Force 3D" Threlte view mode + its reverted 6M cap bump (reversibility precedent).
- **EVID (PRD-039 prove-phase)** — measured `du -sb dist*/` delta + on-demand-load trace + no-regression smoke; linked `informs` before activation.






