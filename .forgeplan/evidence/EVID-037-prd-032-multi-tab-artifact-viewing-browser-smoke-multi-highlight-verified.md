---
depth: tactical
id: EVID-037
kind: evidence
links:
- target: PRD-032
  relation: informs
status: active
title: PRD-032 multi-tab artifact viewing — browser smoke + multi-highlight verified
---

# EVID-037: PRD-032 multi-tab artifact viewing — browser smoke + multi-highlight verified

| Field        | Value                                       |
|--------------|---------------------------------------------|
| Status       | Draft                                       |
| Created      | 2026-05-09                                  |
| Valid Until  | 2026-08-09                                  |
| Target       | PRD-032                                     |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test

## Measurement

Drove the running dev server (`npm run dev`, http://127.0.0.1:5174) via
`mcp__claude-in-chrome` JavaScript execution. Each acceptance scenario
from PRD-032 was exercised by synthesising a `MouseEvent` /
`KeyboardEvent` (with `shiftKey` set as needed) on real DOM elements
rendered by the production build of `template/`, then reading the
resulting tab-strip / graph state directly from `document.querySelector`.

Surfaces driven (each is a real call site — no mocks):

- `g.node` click in `widgets/dependency-graph/ui/ForceView.svelte`.
- `aside.rail .noderef` click in `widgets/insights-rail/ui/InsightsRail.svelte`.
- `.panel .noderef` click in `widgets/artifact-panel/ui/ArtifactPanel.svelte`.
- Keyboard `Enter` (with `shiftKey`) on `g.node` in ForceView.
- `.tabbar .tab .close` click and `.tabbar .tab` click in the new
  `widgets/artifact-tabs/ui/TabBar.svelte`.
- Page reload via `navigate(http://127.0.0.1:5174)` to verify
  `beforeunload` clearing.

`npm run check` (`svelte-kit sync && svelte-check`): 0 errors, 0 warnings.
`npm run build` produced the `dist/` and `dist-nightly/` images.

## Result

| AC    | Scenario                                       | Result | Observed                                                                                  |
|-------|------------------------------------------------|--------|-------------------------------------------------------------------------------------------|
| AC-1  | Shift+click adds tab                           | PASS   | `tabbar = [PRD-008, PRD-009*]` after Shift+click; both nodes carry `.selection-ring`.     |
| AC-2  | Plain click replaces                           | PASS   | After `[ADR-001, ADR-002, ADR-003*]` plain-click ADR-004 → `[ADR-001, ADR-002, ADR-004*]`.|
| AC-3  | Close active falls back to first remaining     | PASS   | `[ADR-001*, ADR-002, ADR-004]` close ADR-001 → `[ADR-002*, ADR-004]`.                     |
| AC-4  | Close last hides panel                         | PASS   | `tabbar=[]`, `hasPanel=false`, `selected=0`, `opened=0` after closing the last tab.       |
| AC-5  | Reload clears store                            | PASS   | Reloaded with two tabs → `tabbar=[]`, `hasPanel=false` after reload.                       |
| FR-004| Every opened artifact highlighted in graph     | PASS   | With 4 tabs in Force view: 4 `rect.selection-ring` rendered (1 `.active`, 3 dashed).      |
| FR-006| Edges incident to any opened node are active   | PASS   | With 4 tabs in Force view: 7 `.edge-active` and 97 `.edge-dim` (only opened-incident lit).|
| FR-006| Rail Shift+click adds tab                      | PASS   | `tabbar=[PRD-008, PRD-009*]` after rail plain-click then rail Shift+click.                |
| FR-006| In-panel link Shift+click adds tab             | PASS   | `[PRD-008, PRD-009, NOTE-001*]` after Shift+click NOTE-001 in ArtifactPanel body.         |
| FR-006| Keyboard Shift+Enter adds tab                  | PASS   | `[PRD-008, PRD-009, NOTE-001, PRD-001]` after Shift+Enter on g.node[data-id=PRD-001].     |

Console errors during the entire smoke walk (`read_console_messages` with
`onlyErrors: true`): **0**.

## Interpretation

Every PRD-032 acceptance criterion (AC-1…AC-5) and the secondary
"all entry points honour Shift" goal (FR-006) is observable in the
running app. Both Bun-style assertions (DOM class membership, tab strip
contents) and the visual contract (selection-rings on all opened nodes,
edge lighting on incident edges) match the spec. `R_eff > 0` is supported.

## Congruence Level Justification

CL3 — measurement is taken against the exact surface that PRD-032 claims
to ship: `template/src/widgets/dependency-graph/`,
`template/src/widgets/artifact-tabs/`, `template/src/entities/artifact-tabs/`,
plus the wired call sites in HomePage, InsightsRail, ArtifactPanel and
NodeRef. No simulated environment, no mocks of the store; real Svelte 5
runes mounted under the dev server.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-032  | informs  |


