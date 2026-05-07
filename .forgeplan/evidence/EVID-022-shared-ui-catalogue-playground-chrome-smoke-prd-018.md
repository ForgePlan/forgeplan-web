---
depth: standard
id: EVID-022
kind: evidence
last_modified_at: 2026-05-07T17:10:39.402485+00:00
last_modified_by: claude-code/2.1.132
links:
- target: PRD-018
  relation: informs
- target: RFC-016
  relation: informs
status: active
title: shared/ui catalogue + /playground Chrome smoke (PRD-018)
---

# EVID-022: shared/ui catalogue + /playground Chrome smoke (PRD-018)

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-07 |
| Valid Until | 2026-09-30 |
| Target | PRD-018 + RFC-016 |

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: measurement

## Measurement

What was measured, how, and under which conditions:

1. **Catalogue completeness** — counted named exports from
   `template/src/shared/ui/index.ts` after Group 7 merged. Method:
   `grep -c "^export" template/src/shared/ui/index.ts`. Target per
   PRD-018 SC-1: ≥ 26.

2. **Type safety** — ran `node_modules/.bin/svelte-check --tsconfig
   ./tsconfig.json --output human` after every group commit (8 runs total)
   plus a final pass after `/playground` was added. Target per PRD-018
   NFR-003: 0 errors.

3. **Visual smoke** — booted dev server with `npm run dev` (port 5174),
   navigated Chrome via the MCP browser harness to:
   - `http://127.0.0.1:5174/playground` (data-theme=light)
   - `http://127.0.0.1:5174/playground` (data-theme=dark)
   - `http://127.0.0.1:5174/` (home, force-directed graph)

   Captured console messages with `read_console_messages` (regex
   `error|Error|warn|Warning|Uncaught|TypeError|ReferenceError`). Triggered
   interactive primitives:
   - clicked "Open popover" → bubble visible
   - clicked "Success toast" → "Saved!" toast appears bottom-right

   Method: Chrome MCP tool calls; environment macOS Darwin 25.4.0,
   Chromium-based Chrome; viewport 1524×806; reduced-motion off.

## Result

1. **Catalogue completeness**: 28 `export ...` lines in
   `template/src/shared/ui/index.ts` covering 45+ named primitives
   (some lines re-export 4–7 sub-parts each — e.g.
   `export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'`).
   Counts per group:
   - Visual atoms: 7 (Badge, Separator, Skeleton, Spinner, Card, Alert, Progress)
   - Form basics: 4 (Label, Input, Field, InputGroup)
   - Toggles: 6 (Toggle, ToggleGroup + Item, ButtonGroup, Switch, Checkbox, Slider)
   - Radio: 2 (RadioGroup, Radio)
   - Disclosure: 3 trees (Tabs ×4, Collapsible ×3, Accordion ×4)
   - Overlays: 3 (Tooltip + Provider, Popover ×3, Toaster + toast helper)
   - Command: 7 sub-parts (Command, Input, List, Empty, Group, Separator, Item)

   PRD-018 SC-1 target was ≥ 26 individual primitives — actual: 26 from
   the issue list, all shipped. **Pass**.

2. **Type safety**: every group's final svelte-check run reported
   `svelte-check found 0 errors and 0 warnings` (exit 0). Snapshot of the
   /playground pass:
   ```
   $ node_modules/.bin/svelte-check --tsconfig ./tsconfig.json --output human
   svelte-check found 0 errors and 0 warnings
   EXIT=0
   ```
   PRD-018 NFR-003 target: 0 errors. **Pass**.

3. **Visual smoke**:
   - `/playground` (light): `getComputedStyle(document.body).backgroundColor`
     = `rgb(245, 242, 234)` (cream from `--bg` in light theme tokens). DOM
     contains 5 `.badge`, 4 `.alert`, 1 `.switch`, 38 elements with
     `[data-state]` (Tabs/Toggles/Accordion/Switch/Checkbox/Radio).
     **0 console errors / warnings** (only 2 vite HMR DEBUG lines).
   - `/playground` (dark): screenshot confirmed all 7 sections render
     (Visual atoms with badges + alerts + progress; Form basics with
     required marker + invalid border + helper text + InputGroup
     prefix/suffix; Toggles with ToggleGroup state, Switch off, Checkbox
     indeterminate orange fill, Slider thumb at 45%; Disclosure shows
     active Overview tab + accordion expansion; Overlays bubble + Saved!
     toast; Command palette with Suggestions group selected). Same — **0
     console errors**.
   - `/` (home, force-directed graph): 354 SVG nodes rendered, page works
     after the +layout.svelte change to wrap in `TooltipProvider` and
     mount `Toaster`. **0 console errors**.

   PRD-018 SC-3 target: 0 errors during Chrome smoke. **Pass**.
   PRD-018 NFR-005 target: dual-theme parity. **Pass** (token
   substitution shows correct light/dark values in body bg + screenshots).

## Interpretation

All four PRD-018 success criteria measurable at this stage are green:
- SC-1 (catalogue completeness): 26/26 primitives shipped.
- SC-3 (visual smoke): 0 errors.
- SC-4 (`npm run check`): 0 errors.
- NFR-003 (type safety): 0 errors.
- NFR-005 (theming): dual-theme parity verified.

SC-2 (no ad-hoc copies in `widgets/*`) is **deferred** — this PR
intentionally lands the catalogue + showcase only; widget integration is
a follow-up (logged in commits and the /playground commit body).

NFR-001 (dev cold start < +500 ms) and NFR-002 (prod bundle < +30 KB gz)
were not directly measured — `npm run dev` started successfully and
served `/playground` without delay; bundle measurement deferred until
production build run. These should be confirmed before activation in a
follow-up if regression is suspected.

The evidence supports activating PRD-018 + RFC-016 with the caveat that
SC-2 is tracked as future work (widget integration) and NFR-001/002 are
"green by absence of regression" rather than measured.

## Congruence Level Justification

CL3 (penalty 0.0) — same-context measurement.

The measurements were taken directly against the surface this PRD/RFC
proposes to change: `template/src/shared/ui/`, the
`template/src/shared/ui/index.ts` barrel, and the
`template/src/routes/playground/+page.svelte` showcase. svelte-check ran
against the actual `tsconfig.json` of the project under test. The Chrome
smoke ran against the actual dev server (`vite dev --port 5174`)
launched from `template/`. No proxies, no synthetic environments, no
indirect benchmarks.

`evidence_type: measurement` is appropriate because each result is a
direct observation (export count, exit code, computed style, DOM count,
console message stream) — not a hypothetical test scenario.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-018  | informs  |
| RFC-016  | informs  |




