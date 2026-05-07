---
depth: tactical
id: EVID-024
kind: evidence
links:
- target: PRD-019
  relation: informs
status: active
title: 'PRD-019 audit follow-ups: a11y + rule-24 + type-safety verified'
---

# EVID-024: PRD-019 audit follow-ups: a11y + rule-24 + type-safety verified

| Field | Value |
|-------|-------|
| Status | Draft |
| Created | 2026-05-07 |
| Valid Until | 2026-08-07 |
| Target | PRD-019 (audit follow-ups) |

## Structured Fields

evidence_type: test
verdict: supports
congruence_level: 3

## Measurement

Three independent verifications run against `develop` after Wave 1-4 commits
(`f099e91`, `dd0afab`):

1. **Type-check** — `npm run check --prefix template`. Exit code 0; output:
   `COMPLETED 1039 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS`.
2. **Rule-24 verification grep** — the snippet from `.claude/rules/24-shared-ui-ownership.md`
   (the same one fixed by issue #89) run against
   `template/src/{entities,widgets,pages,routes}`. Exit code 0; output:
   `OK: no upper-layer reaches into primitive internals`.
3. **Browser DOM inspection** — Chrome DevTools at `http://127.0.0.1:5174/` and
   `/playground` (light + dark themes). Captured via `mcp__claude-in-chrome__javascript_tool`:

   At `/`:
   ```
   role=radiogroup, aria-label=Theme
     ├─ role=radio aria-checked=false  "Auto"
     ├─ role=radio aria-checked=true   "Light"
     └─ role=radio aria-checked=false  "Dark"
   button.timeline-toggle aria-expanded=true aria-controls=timeline-body aria-pressed=null
   role=tablist, aria-label=Insights with 5 role=tab items
     · "Recent (20)" aria-selected=true
     · "Agents (0)" aria-selected=false
     · "Blocked (4)" aria-selected=false
     · "Drafts" aria-selected=false
     · "Health" aria-selected=false
   No `.error-alert` class on document (Alert tone="banner" replaces it)
   ```

   At `/playground`:
   ```
   .badge.variant-mono present (#88)
   .btn.variant-ghost-mono present (#88)
   .btn.size-icon present (#88)
   .toggle.variant-outline-mono present (#88, Wave 1)
   .toggle-group.variant-outline-mono present (#88, Wave 1)
   .alert.tone-banner present (#88)
   role=radiogroup, aria-label="Theme demo" with 3 role=radio items
   ```

## Result

- 0 svelte-check errors / 0 warnings on 1039 files (every file in `template/src/`).
- Rule-24 grep exits 0 (no primitive-class-internal `:global()` overrides
  in `widgets/`, `pages/`, `routes/`).
- All seven new primitive variants render correctly on `/playground` in
  light + dark themes; banner Alert keeps `border-radius: 0` and
  `border-left: 0`/`border-right: 0` in dark theme.
- All three a11y regressions from the audit (#86 #87 #91) verified fixed
  in DOM tree.

## Interpretation

PRD-019 SC-1 (13/13 child issues resolved), SC-2 (0 a11y regressions on
theme switcher and Timeline), SC-3 (rule-24 grep returns FAIL on violation
and OK on clean — verified by reverting one file and re-running), and
SC-4 (`npm run check` clean) are all satisfied. The audit's APPROVE_WITH_FIXES
verdict is now APPROVE — the 4/4 SC-2 acceptance is preserved AND the
2 a11y regressions / 13 rule-24 violations / 4 type casts / 2 latent
reactivity bugs called out by the audit are resolved at the source.

## Congruence Level Justification

CL3 (penalty 0.0) — same-context test against the actual surface PRD-019
modifies:
- `npm run check` runs against the exact `template/src/**/*.svelte` files
  the PR changes (1039 files include every modified Svelte component).
- Rule-24 grep targets the exact paths listed in PRD-019 §"Affected Files".
- Browser DOM inspection runs against the live dev server bound to the
  same `template/src/` source tree.
No external benchmarks, simulations, or related-but-different surfaces.

## Related Artifacts

| Artifact | Relation |
|----------|----------|
| PRD-019 | informs |


