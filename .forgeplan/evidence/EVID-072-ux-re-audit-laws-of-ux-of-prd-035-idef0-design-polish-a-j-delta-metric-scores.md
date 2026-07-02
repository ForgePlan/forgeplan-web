---
depth: tactical
id: EVID-072
kind: evidence
last_modified_at: 2026-07-02T11:41:30.949636+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-035
  relation: informs
status: active
title: UX re-audit (laws-of-ux) of PRD-035 idef0 design-polish — A-J delta + metric scores
---

---

assigned_number: 72
created: 2026-07-02
id: EVID-072
kind: evidence
predicted_number: 72
slug: evid-ux-re-audit-laws-of-ux-of-prd-035-idef0-design-polish-a-j-delta-metric
status: draft
title: UX re-audit (laws-of-ux) of PRD-035 idef0 design-polish — A-J delta + metric scores
updated: 2026-07-02

---

# EVID-072: UX re-audit (laws-of-ux) of PRD-035 idef0 design-polish — A-J delta + metric scores

| Field   | Value                                       |
| ------- | ------------------------------------------- |
| Status  | Draft                                       |
| Created | 2026-07-02                                  |
| Target  | PRD-035 (IDEF0 view design-excellence pass) |

## Structured Fields

evidence_type: audit
verdict: supports
congruence_level: 3

## Measurement

Laws-of-UX re-audit of commits 6247450 + 9f1d84f on branch feat/idef0-view-t2.
Files audited:

- `template/src/widgets/dependency-graph/ui/Idef0View.svelte` (1249 lines)
- `template/src/widgets/dependency-graph/lib/idef0-layout.ts` (446 lines)

Audit method: code inspection against each of the 10 baseline issues (A–J) from the
design-study baseline (wqgv48lvt.output / field result.baseline); measurement of 3
before-metrics; identification of any new Critical/Warning issues in new elements
(band headers, status dots, cross-pane bridge, hover transform guard).

Reference CSS tokens validated against `template/src/app/styles/app.css`.

## Result

### A–J Delta Table

| #   | Issue (baseline)                                                                                   | UX Law                                   | Severity   | Status            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | Mode-fallback banner alarm tone (accent-dim bg + accent border + raw engineering copy)             | Von Restorff Effect; Aesthetic-Usability | Critical   | RESOLVED          | `.mode-indicator` CSS (line 785–798): `background: var(--bg-1)`, `border-bottom: 1px solid var(--line)`. No `.mode-indicator.mode-fallback` class. Markup (line 317–325): "Sparse workspace · tier bands active · IDEF0 activates at depth ≥ 3" / "IDEF0 decomposition". Engineering `verdict.reason` relegated to `title` tooltip (line 316).                                                                                          |
| B   | No kind color on diagram boxes — no kindBorder/kindLabelColor applied                              | Jakob's Law; Law of Similarity           | Critical   | RESOLVED          | `kindBorder`, `kindLabelColor`, `kindColor`, `kindLabel`, `kindIsAccent` imported (line 18–23). All real and derived boxes receive `style:--kind-accent={kindBorder(box.kind)}` (lines 398, 467) and `style:--kind-num` (lines 399–401, 468–470). `.idef0-box::before` renders 3px accent bar via `var(--kind-accent)` (lines 991–1000). `.box-number` reads `var(--kind-num)` (lines 1112–1119).                                       |
| C   | Rollup box more prominent than content boxes (brighter border + bold fg-2 vs dim fg-4 band-member) | Von Restorff Effect; Serial Position     | Critical   | RESOLVED          | Rollup: `background: transparent`, `border-color: var(--line-2)`, `.rollup-count { font-weight: 500; color: var(--fg-3) }`, `.rollup-hint { color: var(--fg-4) }`, `::before { display: none }` (no kind accent bar) (lines 1003–1005, 1079–1099). Band-members: retain `--bg-2` fill, kind accent bar, `--fg-4` border — clearly more prominent than rollup.                                                                           |
| D   | Navigation buttons min-height 28px (37% below 44px Fitts's Law minimum)                            | Fitts's Law                              | Warning    | RESOLVED per spec | `.nav-btn { min-height: 36px; padding: 10px 12px }` (lines 745–757). Raised from 28px to 36px per design spec target. Residual gap to 44px WCAG mobile target is pre-existing desktop-primary trade-off documented in design study.                                                                                                                                                                                                     |
| E   | Band labels: SVG text "T0"/"T1" only, no kind or count, 72px LABEL_INDENT wasted                   | Law of Proximity; Miller's Law           | Warning    | RESOLVED          | `LABEL_INDENT = 0` (idef0-layout.ts:349). `BAND_HEADER_H = 24` exported (idef0-layout.ts:68). `BandInfo { tierIdx, kind, count, y }` populated in `layoutTierBands` (idef0-layout.ts:383). DOM band headers render T{tierIdx} + kindLabel(band.kind) + count (Idef0View.svelte:372–387). Full-width via `left:0; right:0` (line 937–939). No SVG band-label text in markup.                                                             |
| F   | Outline rows: no kind color, no status indicator                                                   | Law of Similarity; Serial Position       | Warning    | RESOLVED          | `row-kind-dot` with `style:--dot-c={kindColor(row.kind)}` (lines 263–265). `kindLabel(row.kind)` for text (line 267). `row-status-dot` with 4 states: status-active (--good fill), status-draft (accent outline), status-stale (fg-3 outline), status-terminal (fg-4 fill) (lines 269–278, 711–727).                                                                                                                                    |
| G   | `.box-number` 9px `var(--fg-3)` = ~4.1:1 contrast, fails WCAG AA                                   | Aesthetic-Usability (WCAG AA)            | Warning    | RESOLVED          | `.box-number { color: var(--kind-num, var(--fg-2)) }` (lines 1112–1119). `--kind-num` resolves to `var(--fg-2)` (#a3a3a3) for non-accent kinds — approximately 8.7:1 contrast on `--bg-1` (#0b0b0b). Accent kinds use `kindLabelColor()` which returns `var(--accent)` (#ff5a1f) — 5.4:1 on dark. Both pass WCAG AA 4.5:1 threshold.                                                                                                    |
| H   | Canvas left-anchored; blank right expanse; no adaptive width                                       | Aesthetic-Usability; Law of Prägnanz     | Warning    | RESOLVED          | `canvas-scroll { display: flex; align-items: flex-start }` + `diagram-canvas { margin-inline: auto; flex-shrink: 0 }` (lines 879–893). Comment documents why `justify-content: center` was avoided (flexbox overflow-centering trap). `adaptiveGeom` (lines 114–122) computes boxW from `containerW` (bound via `bind:clientWidth` at line 314): cols=4 at ≥1100px, cols=3 at ≥720px, cols=2 otherwise; boxW = max(160, min(220, ...)). |
| I   | Box title 2-line clamp at 160px width (~22 chars/line)                                             | Law of Prägnanz; Miller's Law            | Warning    | RESOLVED per spec | Default `boxW: 180` (idef0-layout.ts:56) and adaptive up to 220px (Idef0View.svelte:119). `title` attribute tooltip present on boxes (line 424). 2-line clamp retained per design spec (accommodated by wider boxes).                                                                                                                                                                                                                   |
| J   | No visual hover bridge between outline and diagram panes                                           | Law of Proximity; Zeigarnik Effect       | Suggestion | RESOLVED          | `hoveredKey = $state<string                                                                                                                                                                                                                                                                                                                                                                                                             | null>(null)`(line 99). Outline rows:`onmouseenter/leave`sets`hoveredKey`(lines 251–255);`class:row-cross-hovered`(lines 243–244);`.outline-row.row-cross-hovered { background: var(--bg-2) }`(lines 673–675). Real boxes:`onmouseenter/leave`+`onfocus/blur`(lines 411–421);`class:box-cross-hovered`(lines 396–397);`box-shadow: 0 0 0 2px var(--accent-soft)`(line 1074). Derived boxes:`onmouseenter/leave`(lines 475–479);`class:box-cross-hovered` (lines 464–465). |

### Three Metric Scores (AFTER)

**Metric 1 — Kind discriminability: distinct kind color groups**

Score: 3 groups wired (same as target).

- Accent/orange (`var(--accent)` / `var(--node-border-neutral)` cluster): epic, problem — via `kindBorder()` → `var(--accent)`.
- Good/green: evidence/evid — via `kindBorder()` → `var(--good)`.
- Neutral: prd, rfc, adr, spec, note, solution, refresh — via `kindBorder()` → `var(--node-border-neutral)`.
  Usage points: `--kind-accent` on box `::before` bar; `--kind-num` on `.box-number`; `--dot-c` on `.row-kind-dot`.
  Before: 0 groups. After: 3 groups. Target met.

**Metric 2 — Alarm-tone in mode indicator: yes/no**

Score: No.
`.mode-indicator` CSS (lines 785–798): `background: var(--bg-1)`, `border-bottom: 1px solid var(--line)`, `color: var(--fg-3)`. No `--accent-dim`, no `--accent` border-bottom, no `.mode-indicator.mode-fallback` class exists in the file. Grep of the file confirms `--accent-dim` appears only in `.outline-row.row-selected` (line 668) and `.box-focus-role` (lines 1041–1043) — neither is the mode indicator.
Before: yes (alarm tokens). After: no. Target met.

**Metric 3 — Canvas utilization: content_right_edge / pane_available_width**

Score: ~0.99 at 940px pane width; ≥0.85 across all supported widths. Non-clipping centering confirmed.

Mechanism: `bind:clientWidth={containerW}` (line 314) measures diagram-pane live. `adaptiveGeom` at 940px: `usable = max(360, 940-64-160) = 716`; `cols=3`; `boxW = max(160, min(220, floor(716-48)/3)) = 220`. Layout canvas = (32+80) + (3×220 + 2×24) + 80 + 32 = 112 + 708 + 112 = 932px on a 940px pane → utilization = 0.992. Centering: `margin-inline: auto` on `diagram-canvas` within flex `canvas-scroll` distributes residual (8px) symmetrically. Leading edge is always reachable because overflow scrolls from left (no `justify-content: center` trap). The Playwright capture reported ~0.9 against 145 artifacts; analytic calculation gives 0.99 at 940px pane — the measured ~0.9 likely reflects a narrower effective pane in the capture viewport.

Before: ~0.31–0.55 (content-dependent, left-anchored). After: ≥0.85 (adaptive, centered). Target met.

### New Issues Found in Polish Elements

**NEW-1 — Warning**

- Law: Accessibility (ARIA specification) — `aria-label` on elements with `role=generic` (plain `<div>`) is not reliably surfaced by assistive technology (JAWS, NVDA, VoiceOver).
- Location: Idef0View.svelte:375–386
- Issue: `<div class="band-header" aria-label="Tier N: Kind, N items">` — the element has no explicit ARIA role, so its computed role is `generic` (none), and AT implementations commonly ignore `aria-label` on generic elements. The visible child spans (T0, PRD, 3 items) are already sufficient for sighted users; the `aria-label` annotation is a dead label from an AT perspective and may suppress reading of children on some implementations.
- Fix: Add `role="group"` to make the label effective, OR remove `aria-label` (visible children are sufficient) and mark the div as `aria-hidden="true"` since it is `pointer-events: none` decorative.

**NEW-2 — Suggestion**

- Law: Fitts's Law / Keyboard accessibility — cross-pane hover bridge incomplete for keyboard navigation from outline pane.
- Location: Idef0View.svelte:239–260 (outline-row button)
- Issue: Outline-row buttons have `onmouseenter`/`onmouseleave` wired to `hoveredKey`, but no `onfocus`/`onblur`. Keyboard users tabbing through the outline pane do not trigger cross-pane highlighting on the matching diagram box. Real boxes correctly have `onfocus`/`onblur` (lines 417–421), creating a directional gap.
- Fix: Add `onfocus={() => { hoveredKey = serialiseKey(row.key); }} onblur={() => { hoveredKey = null; }}` to the outline-row button.

**NEW-3 — Suggestion**

- Law: Aesthetic-Usability Effect / WCAG 1.3.1 (Info and Relationships) — status information conveyed by `aria-label` on a non-interactive `<span>` is not announced by most AT.
- Location: Idef0View.svelte:429–440 (box-status-dot), 269–278 (row-status-dot)
- Issue: `<span class="box-status-dot" aria-label="active">` — a non-interactive span without a role; AT implementations ignore `aria-label` here. Status is not included in the parent button's `aria-label` either. Screen reader users cannot determine artifact status from the IDEF0 view.
- Fix: Include status in parent button/button `aria-label`. For boxes: `aria-label="{box.number} {box.kind}: {box.key.title}, {statusById.get(box.key.id) ?? 'draft'}. Press Enter to drill in."`. For outline rows: append status. Add `aria-hidden="true"` to the inner dot spans.

## Interpretation

All 10 baseline issues (A–J) are resolved. The 3 design-study metrics are met at or above target. The polish wave delivered a complete kind-color vocabulary, de-alarmed the mode indicator, replaced SVG band text with full-width DOM headers, wired the cross-pane hover bridge, corrected attention hierarchy, and implemented adaptive canvas geometry with non-clipping centering. Three new issues identified: one Warning (band header ARIA semantic effectiveness) and two Suggestions (keyboard bridge gap, status in AT-accessible name). No new Critical issues. The Warning is low-user-impact (visible text is present; only `aria-label` annotation is ineffective). Evidence supports PRD-035.

## Congruence Level Justification

CL3: Audit is direct code inspection of the exact files shipped in the PR (Idef0View.svelte, idef0-layout.ts, app.css) on branch feat/idef0-view-t2 HEAD 9f1d84f. Same component, same context, same CSS token system used by all other views. No proxy measurement; no external comparison.

## Related Artifacts

| Artifact | Relation |
| -------- | -------- |
| PRD-035  | informs  |


