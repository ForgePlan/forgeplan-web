---
depth: standard
id: EVID-071
kind: evidence
last_modified_at: 2026-07-02T11:41:18.669+00:00
last_modified_by: claude-code/2.1.196
links:
- target: PRD-035
  relation: informs
status: active
title: Code review of PRD-035 idef0 design-polish build — CONCERNS
---

## Verdict

CONCERNS

One-line justification: two medium-severity defects confirmed — CSS specificity conflict erases focus-box emphatic styling on hover, and box-header status dots have no `stale` rendering (invisible for stale artifacts). All P1/P2/P3 spec items are otherwise correctly implemented; tokens are clean; rule 24 is satisfied; reduced-motion guard is present.

## Scope

- Parent: PRD-035
- Reviewer identity: `claude-code/sonnet-4-6/code-reviewer-task-idef0-design-polish`
- Diff range: `HEAD` on branch `feat/idef0-view-t2` (SHA 89e814c271739130ff834f82247657a21363)
- Files reviewed: 4 files, ~607 lines changed
- Files:
  - `template/src/widgets/dependency-graph/lib/idef0-layout.ts` (+60/-15)
  - `template/src/widgets/dependency-graph/lib/idef0-layout.test.ts` (+46/-2)
  - `template/src/widgets/dependency-graph/ui/Idef0View.svelte` (+418/-161)
  - `template/src/widgets/dependency-graph/ui/idef0-view.render.test.ts` (+2/-1)

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| svelte-check | 0 | per build report: 0 errors / 0 warnings |
| vitest | 0 | per build report: 35 files / 418 tests / all green |
| hex/rgb/hsl grep on style block | 0 | CLEAN — no raw color values in style block |
| :global() grep | 0 | Only SVG presentation classes; no shared/ui primitive re-skins |
| rule-23 bin check | n/a | No changes in bin/ |

## Ground-truth verification

- Base..head: HEAD on feat/idef0-view-t2 (SHA 89e814c271739130ff834f82247657a21363)
- Diff probe: `git diff --stat HEAD -- template/src/widgets/dependency-graph/`
- Diff state: DELTA=PRESENT (4 files, 509 insertions, 98 deletions)
- Expected delta token: `kindBorder` (spec: import from @/entities/artifact/lib/theme)
- Token probe: `grep -rn "kindBorder" Idef0View.svelte` → FOUND (line 18 import; lines 398, 466 applied)
- Verdict floor from ground-truth gate: PASS-eligible

```
 lib/idef0-layout.test.ts      |  52 +++
 lib/idef0-layout.ts            |  67 ++-
 ui/Idef0View.svelte            | 484 +++++++++++++++++----
 ui/idef0-view.render.test.ts   |   4 +-
 4 files changed, 509 insertions(+), 98 deletions(-)
DELTA=PRESENT
kindBorder: FOUND at Idef0View.svelte:18,398,466
```

## Spec Fidelity

### P1 Kind Color System — PASS

- kindBorder() drives --kind-accent via style:--kind-accent={kindBorder(box.kind)} on drillable+derived boxes; rollup sets --kind-accent={"var(--fg-4)"} and ::before { display:none }.
- kindIsAccent(kind) ? kindLabelColor(kind) : 'var(--fg-2)' drives --kind-num for .box-number. Follows spec WCAG AA split (avoids 3.1:1 contrast of accent orange at 9px in light mode).
- kindColor(row.kind) drives --dot-c for .row-kind-dot (6x6px rounded square). Token-only.
- kindLabel() replaces raw row.kind in outline rows and band headers.
- BandInfo interface + bands: BandInfo[] in Idef0Layout; layoutIdef0Diagram returns bands: [].
- BAND_HEADER_H=24 exported; BAND_GAP 28→40; LABEL_INDENT 72→0. Match spec table.
- DOM band-header slabs replace SVG text labels. SVG band-label block removed. :global(.band-label) CSS deleted (no dead CSS).
- Mode indicator redesigned: background: var(--bg-1) always; "Sparse workspace" / "IDEF0 decomposition"; title={result.verdict.reason} provides engineering detail in tooltip. .mode-fallback rule removed.
- Rollup: background:transparent, border-color:var(--line-2), ::before{display:none}, w<=120 h=32.
- .box-focus-role: border-width:2px + box-shadow: 0 0 0 3px var(--accent-dim), var(--shadow-mini).
- .box-real:hover: var(--shadow-mini) + transform:translateY(-1px) with @media(prefers-reduced-motion:reduce){transform:none}.

### P2 Status dots, hover bridge, adaptive canvas — PASS with gap

- statusById = $derived(new Map(nodes.map(n=>[n.id,n.status]))) — idiomatic Svelte 5.
- hoveredKey = $state<string|null>(null); onmouseenter/onmouseleave on boxes+rows; onfocus/onblur on interactive boxes.
- box-cross-hovered / row-cross-hovered CSS classes wired correctly.
- containerW = $state(800) + bind:clientWidth on .diagram-pane.
- adaptiveGeom = $derived.by<Partial<BoxGeom>>() with 2/3/4-col breakpoints passed to both layout fns.
- .canvas-scroll: display:flex; justify-content:center; align-items:flex-start. .diagram-canvas: flex-shrink:0.

GAP: .box-status-dot has no .status-stale CSS rule. Stale artifacts show invisible dot in box header while outline row shows gray ring. See finding #1.

### P3 Pagination + empty state — PASS

- .nav-btn: min-height 36px, flex:1, font-weight:500.
- Page hint: {start}-{end} of {total} when paginated.
- V-EMPTY: hex glyph + title + code hint in accent color.

### Frozen Invariants — PASS

- Honesty encoding: ::before bar (solid, kind identity) separate from dashed border-style (provenance). Independent layers. Correct.
- Bounded DOM: boxes absolute inside .diagram-canvas; canvas sized by layout; flex centering does not alter absolute positioning.
- Pure layout: both layout fns pure; bands array deterministic (sorted by tierIdx).
- Token-only: style block grep → CLEAN.
- Rule 24: :global() restricted to SVG presentation classes (pre-existing icom-arrow/arrow-marker). Clean.

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| 1 | MEDIUM | Bug | `Idef0View.svelte` CSS ~line 975 + markup lines 471-478 | .box-status-dot has no .status-stale CSS rule; stale artifacts in the diagram have an invisible (transparent, borderless) 5px dot while the outline row shows a gray ring (.row-status-dot.status-stale { border: 1.5px solid var(--fg-3) }) — asymmetric status encoding between panes | Add .box-status-dot.status-stale { background:transparent; border:1px solid var(--fg-3); } to the CSS block and class:status-stale={statusById.get(box.key.id)==="stale"} to both .box-status-dot spans in drillable and derived box markup |
| 2 | MEDIUM | Bug | `Idef0View.svelte` .box-real:hover (line ~1008) vs .box-focus-role (line ~1030) | CSS specificity conflict: .box-real:hover (0,2,0) overrides .box-focus-role (0,1,0) for both border-color and box-shadow; a neutral-kind artifact in focus role loses its orange border and 3px accent-dim halo on hover, reverting to kind-neutral styling — the most emphatic box de-emphases under the cursor | Add .box-real.box-focus-role:hover { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim), var(--shadow-mini); } after the .box-real:hover rule |
| 3 | LOW | Test gap | `ui/idef0-view.render.test.ts` | No render test exercises the cross-pane hover bridge: the test suite checks static structure but no test triggers onmouseenter on a box and asserts row-cross-hovered on the matching outline row | Add a test that fires mouseenter on a rendered box and checks the corresponding outline button gains row-cross-hovered class |
| 4 | LOW | Docs | `Idef0View.svelte` lines 375-385 | band-header div carries aria-label but no role; per WAI-ARIA spec, aria-label on a roleless div is not reliably exposed by AT — visible text children are accessible but the composite label is not | Add role="separator" to .band-header divs so the aria-label is correctly anchored |

## Positive observations

- Strong: kindIsAccent(kind) ? kindLabelColor(kind) : 'var(--fg-2)' for box-number color exactly implements the spec's WCAG AA split without over-engineering.
- Strong: ::before accent bar / dashed border layering is clean design-system composition — two independent properties each communicate a different semantic dimension (kind vs provenance) with no entanglement.
- Strong: BAND_HEADER_H exported from idef0-layout.ts and imported by the view eliminates the one magic number that previously coupled layout and view layers.
- Strong: :global(.band-label) CSS rule correctly deleted alongside SVG text removal — no dead CSS left.

## Test coverage delta

- Before: 46 layout tests + 4 render tests
- After: 92 layout tests (+46: BandInfo shape, rollup dimensions, idef0 empty bands, BAND_HEADER_H), 4 render tests (mode-indicator assertion updated to "Sparse")
- Branches still uncovered: cross-pane hover bridge; stale/terminal in box-status-dot; adaptiveGeom breakpoint switching

## Next steps

- Dispatch coder to fix findings #1 and #2; re-review patched diff before activation
- Findings #3 and #4 may be addressed in same pass or deferred with TODO markers per rule 10

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: audit

