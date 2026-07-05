---
depth: standard
id: ADR-009
kind: adr
last_modified_at: 2026-07-05T16:35:22.941032+00:00
last_modified_by: claude-code/2.1.201
links:
- target: PRD-037
  relation: based_on
- target: RFC-030
  relation: refines
status: draft
title: Zoom-to-descend thresholds reconcile drill-down with §15 magnify
---

# ADR-009: Zoom-to-descend thresholds reconcile drill-down with §15 magnify

- **Status**: draft (proposed)
- **Date**: 2026-07-05
- **Deciders**: user (product) + SPARC Architecture (this record)
- **Drives**: PRD-037 (D2/Q2/Q8), RFC-031 (interaction design)

> **ADI note.** `forgeplan_reason` was attempted and returned *"LLM provider unavailable"* (stale
> workspace server). The Abduction → Deduction → Induction cycle over the threshold/hysteresis model
> was run manually; it is recorded in full in **RFC-031 → Options Considered → ADI cycle B**. This ADR
> records the *decision* and its consequences; RFC-031 holds the option analysis.

## Context

Phase-1 of the composed-map (RFC-030, encoding `docs/PROJECT-MAP-SPEC.md` **§15**) made two deliberate,
user-explicit navigation decisions:

1. **Ctrl/⌘ + wheel = MAGNIFY at the cursor**; plain wheel/trackpad = pan. §15 states verbatim: *"NOT
   click-to-zoom-into-a-zone — the user explicitly rejected that."*
2. **Click a zone (empty area or title) = SELECT it** (the right panel shows the zone's detail); a click
   that did not move must still select, suppressed only after a drag > ~3px.

PRD-037 (T4 Phase-2, recursive drill-down) needs a way to **descend** into a zone/mega and read its
contents as a sub-map. The user's fixed interaction decision (PRD-037 **D2**) is that descent is
triggered **both** by clicking an empty zone area **and** by *zooming in* over a zone. That directly
**reverses** §15 decision (1) — zoom now *can* dive into a zone — and **collides** with §15 decision (2)
— "click a zone" now has two candidate meanings (select vs descend). This is the one genuinely contested
call in the Phase-2 arc and the reason it warrants a permanent record.

**The problem to solve without regressing §15:** reintroduce *zoom-to-descend* and *click-to-descend*
while (a) keeping the §15 *magnify* gesture usable where the user is merely inspecting, not drilling, and
(b) keeping "a click that did not move still selects a card" intact. If descent simply hijacks every
Ctrl/⌘-wheel, the §15 magnify affordance is destroyed; if it hijacks every zone click, §15 zone-select
is destroyed.

### Decision drivers

- **Preserve the §15 magnify/pan band** wherever the user is not drilling (do not destroy a
  user-explicit Phase-1 gesture).
- **Discoverable dual entry** (PRD-037 Goal 4): the descend affordance should be "whatever the hand
  reaches for" — a visible click and the natural "zoom in to see more detail" motion — not a hidden
  modifier.
- **One physical gesture = one altitude transition** (no bounce): a descend immediately followed by the
  new level's fit-reset must not tip straight back out.
- **Scale-invariance across altitudes**: sub-maps fit at wildly different absolute zoom scales (a
  170-card level fits at a small `k`, a 4-card level at a large `k`), so the trigger cannot be an
  absolute zoom value.
- **No collision with §15 zone-select / card-select**: assign each gesture a single meaning so neither
  behaviour is silently lost.

## Decision

Adopt **threshold-based zoom-to-descend using two fit-relative scale thresholds**, plus an explicit
click-target split, and qualify §15 **for the composed-map drill feature only**.

**Zoom mechanic (resolves Q2).** Each altitude records its fit scale `kFit`. Define
`zoomRatio = transform.k / kFit`. Two thresholds bound a neutral band:

- `R_DESCEND = 2.5` — Ctrl/⌘-wheel **in** over a zone until `zoomRatio` **crosses up** through 2.5×
  fit → **descend** into that zone; the new level resets to its own fit (`zoomRatio = 1.0`).
- `R_ASCEND = 0.55` — Ctrl/⌘-wheel **out** until `zoomRatio` **crosses down** through 0.55× fit (and
  depth > 0) → **ascend** one level.
- **Neutral band** `zoomRatio ∈ (0.55, 2.5)` = **ordinary §15 magnify/pan, unchanged** — this is
  d3-zoom's own continuous zoom. §15's magnify gesture is therefore preserved verbatim inside the band;
  drill only triggers at the two **crossings**.

**Hysteresis (so one physical gesture = one transition).**
1. **Reset-to-fit lands mid-band.** After descend/climb, the target altitude resets to its own fit
   (`zoomRatio = 1.0`), which is inside `(0.55, 2.5)` by construction ⇒ cannot re-trigger.
2. **Cooldown.** `COOLDOWN_MS = 350` after any transition passes wheel events straight to magnify/pan,
   absorbing the trackpad inertial-delta tail (a flick emits a decaying stream of wheel events).
3. **Cross-once.** A transition fires only on the threshold **crossing** (ratio was inside the band on
   the previous event, is outside now), never while merely sitting past it; and `clampBelowDescend` caps
   a restored parent transform to `zoomRatio ≤ R_DESCEND − ε` so an ascend cannot immediately re-descend.

**d3 `scaleExtent` per level** is relativised to `[kFit·R_ASCEND·0.9, kFit·R_DESCEND·1.1]` so both
thresholds are always reachable (a fixed `[0.2, 3]` would clip the crossing on small/large sub-maps and
silently disable zoom-drill).

**Click-target split (resolves Q8).** A **drag-free click on a node card = SELECT** (opens/updates the
right artifact tab). A **drag-free click on empty zone area = DESCEND** into that zone. A **drag-free
click on truly empty canvas = RESET** (the Phase-1 clear-selection + fit). A drag > ~3px suppresses both
select and descend — **§15's drag-suppression rule is preserved exactly**.

**Hit-testing (Q3, shared by both entry paths)** is performed in the **transformed (post-pan/zoom)
coordinate space**: invert the current `translate/scale`, then point-in-zone-rect.

**§15 qualification (scope-bounded).** This ADR **qualifies / supersedes §15's rejection of
"click/zoom-to-zone" for the composed-map DRILL feature only.** §15's rejection still stands for (a) the
flat Phase-1 map that has no drillable structure, and (b) the other 8 views. The two-threshold band means
§15's *magnify* gesture is not removed — it remains the behaviour throughout the neutral zoom range. This
ADR does **not** supersede RFC-030 wholesale (RFC-030 stays active for Phase-1); it **refines** RFC-030's
nav contract for the drill case.

## Considered options

- **Option 1 — Threshold-based zoom-drill (CHOSEN).** Two fit-relative thresholds bound a magnify band;
  crossings trigger descend/ascend; hysteresis via reset-mid-band + cooldown + cross-once.
- **Option 2 — Distinct modifier gesture** (e.g. Shift+wheel descends; Ctrl/⌘+wheel still only
  magnifies).
- **Option 3 — Double-click-only descend** (no zoom-to-descend at all; zoom stays pure §15 magnify).
- **Option 4 — Dedicated drill MODE** (a toggle: in drill-mode the wheel descends, otherwise it
  magnifies).

### Option 1 — Threshold-based zoom-drill (CHOSEN)
- **Pros**: preserves the §15 magnify gesture literally inside the neutral band; matches the natural
  "zoom in to see more detail" mental model (discoverable, PRD-037 Goal 4); scale-invariant via
  fit-relative ratios; inherent anti-bounce because the reset lands mid-band; the whole tuning surface is
  two constants + a cooldown.
- **Cons**: adds a "how deep am I zoomed" mental load (mitigated by the breadcrumb + the always-centering
  fit-reset); thresholds need calibration on real hardware (trackpad vs mouse-wheel deltas differ);
  requires per-level `kFit` tracking and a relativised `scaleExtent`.

### Option 2 — Distinct modifier gesture
- **Pros**: zero collision with the §15 magnify band; no thresholds, no hysteresis needed.
- **Cons**: **hidden / undiscoverable** — fails Goal 4 ("whatever the hand reaches for"); an extra
  modifier to teach; does not match the "zoom in = go deeper" metaphor the IDEF0 altitude ladder wants;
  risks colliding with OS/browser modifier-wheel gestures.

### Option 3 — Double-click-only descend
- **Pros**: trivial; leaves §15 magnify completely untouched.
- **Cons**: **violates PRD-037 D2/FR-002**, which mandates a zoom-in entry path; loses the "zoom into
  detail" affordance that makes the altitude metaphor feel physical; double-click is itself ambiguous
  against §15 single-click-select.

### Option 4 — Dedicated drill MODE
- **Pros**: unambiguous — one meaning per wheel event depending on mode.
- **Cons**: **modal** — breaks flow, adds chrome, forces the user to remember which mode they are in;
  §15 magnify becomes unreachable while in drill-mode; contradicts the "discoverable, hand-reaches-for-it"
  driver.

## Consequences

**Positive.**
- §15's magnify/pan gesture is preserved verbatim in the neutral band `(0.55×, 2.5×)` of fit — no
  Phase-1 regression for non-drilling inspection.
- The two-crossing model plus the mid-band reset makes "one gesture = one transition" hold by
  construction — no bounce.
- Fit-relative ratios make the trigger identical in feel at every altitude regardless of sub-map size.
- Q8 is resolved cleanly: card=select, empty-zone=descend, empty-canvas=reset; §15's >3px
  drag-suppression is untouched.

**Negative / costs.**
- The threshold constants (`R_DESCEND`, `R_ASCEND`, `COOLDOWN_MS`) are **calibration-pending**: mouse
  wheels and trackpads deliver very different `deltaY` magnitudes; the chosen values are a starting
  point, to be tuned on the real 214-node map and recorded in the Phase-2 EvidencePack (**latency /
  feel numbers are TBD — not invented here**).
- Implementation must track `kFit` per level and relativise d3's `scaleExtent` per level; a fixed extent
  would silently disable zoom-drill on small/large sub-maps.
- Users gain a new "depth via zoom" concept; mitigated by the always-present breadcrumb (RFC-031
  `LevelBreadcrumb`) and the fit-reset that re-centers every altitude.

**Scope of the §15 reversal.** Bounded to the composed-map drill feature. §15's "reject
click/zoom-to-zone" still governs the flat Phase-1 map and the other 8 views. Any future change to the
neutral-band bounds or the click-target split updates this ADR (supersede, do not silently drift).

## Confirmation

- RFC-031 Test Strategy Hooks include a **threshold descend/ascend + hysteresis** unit test
  (`drill-state.test.ts`): a `zoomRatio` crossing `R_DESCEND` fires descend exactly once; the mid-band
  reset does not re-fire; a wheel event within `COOLDOWN_MS` does not transition; `clampBelowDescend`
  keeps a restored transform below `R_DESCEND`.
- The §15 magnify band is confirmed intact by the **no-regression** hook: within `(0.55×, 2.5×)` fit,
  wheel behaviour is byte-identical to the Phase-1 baseline.
- Feel/latency calibration is confirmed manually on the real map at the Phase-2 checkpoint and recorded
  in the linked **EvidencePack** (structured fields) before any activation (rule 11).

## Related Artifacts

- **PRD-037** (`based_on`) — the parent whose D2/Q2/Q8 this ADR resolves.
- **RFC-031** (`informs` from the RFC side) — the interaction design that applies this decision; holds
  the full ADI option analysis (cycle B).
- **RFC-030 / §15** (`refines`) — the Phase-1 nav contract this ADR qualifies for the drill feature.
- **docs/PROJECT-MAP-SPEC.md §15** — the magnify + click-select decisions being reconciled.




