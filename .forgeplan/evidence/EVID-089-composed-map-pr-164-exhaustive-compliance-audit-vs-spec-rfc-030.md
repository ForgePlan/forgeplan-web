---
depth: standard
id: EVID-089
kind: evidence
last_modified_at: 2026-07-03T13:54:15.571725+00:00
last_modified_by: claude-code/2.1.198
links:
- target: RFC-030
  relation: informs
status: active
title: 'Composed-map (PR #164) exhaustive compliance audit vs spec + RFC-030'
---

## Summary

Ultracode Workflow (`composed-map-compliance-audit`, run `wf_300d9a64-eed`, 9 agents,
0 errors) exhaustively audited the shipped `composed-map` (PR #164, `feat/idef0-composed-map
→ develop`, unmerged) against every UX/behavior requirement in `docs/PROJECT-MAP-SPEC.md`
(§9, §15, §16, §19, §22, §23) and against the actual authorizing design doc, RFC-030 — with
a second adversarial-verification pass per finding before synthesis. Full raw output:
`/private/tmp/claude-501/-Users-explosovebit-Work-ForgePlanWeb/4c1105bc-cac2-467c-8ce7-072e82a882c8/tasks/wekawoci3.output`.

Net effect: of the negative (❌/⚠) findings the four original per-dimension reports surfaced,
**7 flip from "gap" to "documented, deliberately-staged scope"** once the binding artifact
chain (PRD-036/SPEC-006/RFC-030) and the spec's own phasing language are read in full.
**4 stand as real, actionable gaps** — two of which (1.A, 1.B below) are elevated to
CONFIRMED because they contradict **RFC-030's own acceptance bullets**, not just top-level
spec prose. This is why the verdict below is `weakens`, not `supports`: RFC-030 itself is
sound as a scoping document, but the shipped code does not yet meet two things RFC-030
explicitly promised.

## Confirmed real gaps (actionable now)

- **1.A — Esc / empty-click reset never clears `selectedId`.** `handleCanvasClick`
  (`ComposedMapView.svelte:242-246`) and the Escape handler (`:263-268`) call
  `clearHighlight()` + `resetZoom()` but never `onSelect(null)`. RFC-030:121-125 pins
  "Esc → full reset: clear selection, zoom→1, pan home" as a **Phase-1 checkpoint
  acceptance bullet**, not fast-follow polish, and RFC-030:151 commits to a nav-contract
  test suite that was never written (`find … -iname '*.test.ts'` under composed-map turns
  up only `map.test.ts`/`validate.test.ts`/`composed-layout.test.ts` — zero render/interaction
  test for `ComposedMapView.svelte`). Fix: thread `onSelect(null)` into both reset paths +
  add the promised interaction test.
- **1.B — Flow highlight dims/lights edges only; nodes are never dimmed or lit.**
  `activeHighlight` (`ComposedMapView.svelte:150-154`) is passed only to
  `<EdgeLayer highlightedIds={activeHighlight}>` (`:395`) — never to `NodeCard`
  (confirmed absent at the mount site, `:392-412`). RFC-030:109 explicitly names both
  `NodeCard`/`EdgeLayer` as consumers of `highlightedIds`. Fix: add a `dimmed`/`highlighted`
  prop to `NodeCard.svelte` mirroring `EdgeLayer.svelte:19-24,85-87`'s existing pattern —
  wiring only, the highlight set is already computed.
- **1.C — Zone-accent fixture bug.** `checkpoint-map.json:70` sets zone `z.core`'s
  `"accent": "--map-accent-olive"`, which is not among the 7 tokens actually defined in
  `app.css` (cyan/emerald/violet/amber/rose/orange/slate). `ZoneSlab.svelte`'s CSS fallback
  chain silently degrades to the neutral zone-line color, so the Build Pipeline zone's
  hover/selected hint never shows a distinct hue. Fix: correct the fixture to a valid token,
  or promote `--map-accent-olive` to an 8th token (there's already a `--map-olive` stroke
  used for `truth`-kind nodes) — and add a cheap `validate.ts` guard rejecting/warning on an
  undefined `zone.accent` token name.
- **1.D — Minimap position: spec says bottom-left, shipped is bottom-right** (internal
  spec self-contradiction, §8 "reuse Minimap.svelte unchanged" vs §15 "bottom-left" — neither
  PRD-036/SPEC-006/RFC-030 resolves it). Decision needed, not a default code fix. Recommend:
  amend `PROJECT-MAP-SPEC.md §15` to strike "bottom-left" (zero code change, matches shipped
  behavior) unless a concrete on-screen complaint surfaces.
- **1.E — Doc nit.** "✅ Shipped. PR #164 (→ develop)" language (in this repo's status docs
  and `docs/MAP-PACK-BUILD-BRIEF.md`) should read "PR #164 open, not yet merged to develop"
  (`gh pr view 164` → `state: OPEN, mergedAt: null`, confirmed twice independently).
- **1.F — `docs/MAP-PACK-BUILD-BRIEF.md` needs 2 concrete amendments** before P1 kickoff —
  see the amended brief itself (this workflow's fix already applied): the target hook-file
  layout (flat `hooks/map-emitter-gate.sh` → real plugin-loader shape `hooks/hooks.json` +
  `hooks/scripts/map-emitter-gate.sh`, verbatim precedent confirmed in
  `agents-canvas/hooks/hooks.json`) and the CLI version floor recommendation (`>=0.25.0`,
  installed CLI is 0.33.0, matches `forgeplan-brownfield-pack`'s own floor).

## Correctly-scoped-out (deliberate, already recorded — do not re-flag)

Click-to-detail cluster (zone/node panels, RU description rendering, numbered flowcap step
captions — all four converge on the still-unbuilt `ComposedPanel.svelte`, staged as FR-008
fast-follow per RFC-030:126); animated lit edges (§12:353 literal MVP line "EdgeLayer static,
no animation", §13:379 Phase-2); drift badge (§13:380 Phase-2); node-kind treatment table
(re-scored ✅ COMPLIANT — SPEC-006:48/PRD-036:180 AC-1 narrow §22's aspirational fill table to
border-only differentiation for a named kind subset, and shipped code matches that narrowed,
frozen contract exactly — NOT a partial-implementation gap); extra accent colors (`--gold`/
`--blue`, correctly absent, no kind demands them yet); fit-to-screen vs scroll render mode
(RFC-030:121 resolves PRD-036's own Q1, deliberate single-shell choice); `col_weights`/
`row_weights` fractional tracks (§19, spec itself defers to Phase 2/3); `capacity`/`overflow`
zone strategies (schema-only by design, RFC-030:167 "Phase-2 lever"); mega-node rollup
rendering (schema-carried **and structurally validated** — `validate.ts` Rule 11 — zero
render UI, Phase 2+ by design); organic re-layout / FLIP animation (re-scored from "undisclosed
gap" to EXPECTED ABSENCE — §9/§10/§11/§12 explicitly and repeatedly scope animation out of
MVP, same category as every other Phase-2-carried field); P1 marketplace generation pipeline +
P2 onboarding + P3 map-chat + P5 refresh daemon (confirmed zero code/route/widget anywhere in
`forgeplan-web`, read-only-proxy invariant reconfirmed unbroken — already tracked, no new
artifact needed to "discover" this); the renderer-readiness concern for future mega-node
emission (re-scored from "new OQ-5 needed" to already-documented in `types.ts`'s own
`/** carried, Phase 2+ */` comments — no new coordination artifact needed); `elk.bundled.js`
vestigial reference in the external spike (confirmed abandoned, informational only).

## Refuted findings (do not re-flag; corrected during adversarial pass)

Zone-click→panel, node-click→Connections, step-caption, and RU-description-render findings
were originally scored ❌/⚠ by the first pass but are all the same already-staged
`ComposedPanel.svelte` fast-follow (RFC-030:126, SPEC-006:53/39). The node-kind treatment
table finding (originally ❌ GAP) was refuted — SPEC-006:48 narrows the contract and shipped
code matches it exactly. The organic-re-layout finding (originally "undisclosed gap broader
than RFC-030's deferral") was refuted — it's the same documented Phase-2 category as every
other carried field. The renderer-gap-needs-new-OQ finding was refuted — already documented
in `types.ts` schema comments.

## Open question reopened (separate from this audit, same session)

User explicitly asked to reconsider the dropped lens/heatmap overlay (§15's "Dropped (do NOT
build)" directive) as a conscious open question rather than a silent rejection — recorded in
Hindsight and to be added to `docs/MAP-PACK-BUILD-BRIEF.md` as an open item for the P2/P3
polish wave, not acted on in this audit.

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit


