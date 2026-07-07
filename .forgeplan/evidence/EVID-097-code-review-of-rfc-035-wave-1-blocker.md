---
depth: standard
id: EVID-097
kind: evidence
last_modified_at: 2026-07-07T11:58:34.941143+00:00
last_modified_by: claude-code/2.1.202
links:
- target: RFC-035
  relation: informs
status: draft
title: 'Code review of RFC-035 Wave 1: BLOCKER'
---

## Verdict

BLOCKER

One-line justification: the only two visible-behaviour requirements of RFC-035 Wave 1 (FR-1 float/dock/resize window, FR-2 status header, FR-3 Chat|Info tabs, FR-4 Info tab) were never wired into `MapChat.svelte` — the new `FloatingWindow` primitive and the new `chat-store` tab state are built but orphaned; `MapChat.svelte` has a **zero-line diff** and still renders the old fixed-position panel with the old verbose Badge string.

## Scope

- Parent: RFC-035
- Diff range: ad-hoc — uncommitted working-tree changes on `feat/idef0-onboard-agent-phase1` vs `HEAD` (`e42040e`)
- Files reviewed: 6 files touched (2 new, 2 modified, 2 lockfile/manifest), plus full read of `MapChat.svelte` (644 lines) and `chat-store.svelte.ts` diff
- Files: `template/package.json`, `template/package-lock.json`, `template/src/shared/ui/index.ts`, `template/src/shared/ui/floating-window/FloatingWindow.svelte` (new, 655 lines), `template/src/shared/ui/floating-window/index.ts` (new), `template/src/widgets/map-chat/model/chat-store.svelte.ts` (+22 lines)

## Tools run

| Tool | Exit | Notes |
|---|---|---|
| `npx vitest run src/widgets/map-chat src/shared/ui` | 0 | 3 test files, 59 tests, all passed — no regressions, but zero new tests added for `FloatingWindow` |
| `npx svelte-check --threshold error` | 0 | 1280 files, 0 errors, 8 warnings, 2 files with problems |
| rule-24 grep (`.claude/rules/24-shared-ui-ownership.md` Verification block) | non-zero (FAIL) | sole match is pre-existing (`MapChat.svelte:516`, file has 0 diff lines this change) — not a new violation, see Findings #5 note |

## Ground-truth verification

- Base..head: `e42040e..<worktree>` (source: current branch HEAD; no PR base/head SHA supplied — ad-hoc uncommitted-diff review)
- Diff probe: `git diff --stat HEAD -- template/` and `git status --short`
- Diff state: **DELTA=PRESENT** (package.json/package-lock.json/shared/ui/index.ts/chat-store.svelte.ts modified; `shared/ui/floating-window/` untracked-new)
- Expected delta token: `FloatingWindow` used as a consumer import inside `template/src/widgets/map-chat/ui/MapChat.svelte` (the token that would prove Wave 1's stated goal — "MapChat becomes floatable/dockable/resizable" — actually landed)
- Token probe: `grep -rn "FloatingWindow" template/src --include="*.svelte" | grep -v shared/ui/floating-window` → **ABSENT**
- Verdict floor from ground-truth gate: PRESENT diff + ABSENT expected token → **CONCERNS** floor at minimum; escalated to **BLOCKER** below because the missing token is not an edge case but the entire stated deliverable (see Finding #1)

```
$ git diff --stat HEAD -- template/
 template/package-lock.json                      | 18 ++++++++++++++++++
 template/package.json                            |  1 +
 template/src/shared/ui/index.ts                  |  1 +
 .../widgets/map-chat/model/chat-store.svelte.ts  | 22 ++++++++++++++++++++++
 4 files changed, 42 insertions(+)

$ git diff HEAD -- template/src/widgets/map-chat/ui/MapChat.svelte
(empty — zero output, file unchanged)

$ grep -rn "FloatingWindow" template/src --include="*.svelte" --include="*.ts" | grep -v node_modules
template/src/shared/ui/index.ts:39:export { FloatingWindow, type FloatingWindowMode } from "./floating-window";
template/src/shared/ui/floating-window/FloatingWindow.svelte:3,50,106,120 (own definition)
template/src/widgets/map-chat/model/chat-store.svelte.ts:35 (a doc-comment reference only, not an import)
→ zero import/usage sites in MapChat.svelte, ComposedMapView.svelte, or /playground

$ grep -rn "MapChat" template/src/widgets/composed-map/ui/ComposedMapView.svelte
87:  import MapChat from "@/widgets/map-chat/ui/MapChat.svelte";
1137:          <MapChat doc={okDoc} onClose={() => (chatOpen = false)} />
→ MapChat is mounted exactly as before RFC-035; no FloatingWindow wrapper introduced at the call site either
```

## Findings

| # | Severity | Category | Location | Description | Recommended fix |
|---|---|---|---|---|---|
| 1 | CRITICAL | 🏗 Architecture | `template/src/widgets/map-chat/ui/MapChat.svelte` (0 diff lines) | RFC-035 Wave 1's entire visible scope (FR-1 float/dock/resize, FR-2 simplified 🟢/🔴 status header, FR-3 Chat\|Info `Tabs`, FR-4 Info tab scaffold) is unimplemented in the actual chat widget. The new `FloatingWindow` primitive is exported from `shared/ui/index.ts` but has zero import sites anywhere outside its own folder; `MapChat.svelte` still renders the old `position:fixed` panel with the old verbose `Badge` (`"● live — {model}"`), no `Tabs`, no Info content. This is not a partial landing of a large feature — it is the primitive built in isolation with the integration step skipped entirely. | Wrap `MapChat`'s root in `<FloatingWindow>` (or compose it at the `ComposedMapView.svelte:1137` mount site), replace the header's verbose Badge with a 🟢/🔴 dot, add a `shared/ui` `Tabs` split driven by the already-built (but unused) `getActiveTab()/setActiveTab()`, and build the Info tab body per FR-4. |
| 2 | HIGH | 🧪 Test gap | `template/src/shared/ui/floating-window/` (no test file exists) | RFC-035's own Test Strategy section requires vitest coverage of "window-state persistence (save/restore/clamp-off-screen), dock↔float transitions, min-size clamp" — none of `loadPersisted`/`persist`/`clampFloating`/`handleDrag`/`handleDragEnd`/`toggleDock` has a single unit test. | Add `FloatingWindow.test.ts` (or a headless logic-extraction test) covering: restore-clamps-off-screen-position, dock→float on header drag, float→dock on edge-snap release, min-size enforcement on resize. |
| 3 | MEDIUM | 🐛 Bug | `template/src/shared/ui/floating-window/FloatingWindow.svelte:427` | `<div class="fw-header" tabindex="0" role="presentation">` combines a nonnegative `tabindex` with `role="presentation"`. `role="presentation"` strips the element from the accessibility tree entirely, so a screen-reader user tabbing to it lands on a focus stop with no accessible name or role (WCAG 4.1.2 Name/Role/Value) — svelte-check flags this directly (`a11y_no_noninteractive_tabindex`). Contradicts RFC-035's own a11y requirement ("header is focusable") by making it *focusable but semantically invisible*. | Drop `role="presentation"` (or replace with a role that carries a name, e.g. `role="toolbar"`/plain `<div>` with `aria-label`) so the focus stop is announced coherently. |
| 4 | MEDIUM | 🏗 Architecture | `template/src/routes/playground/` (no reference) | RFC-035's Wave 1 scope and rule 24 both require the new primitive to be "showcased on /playground" before any caller uses it. `grep -rln "FloatingWindow\|floating-window" template/src/routes/playground/` returns nothing — the catalogue does not yet reflect this primitive at all. | Add a `/playground` section demonstrating docked + floating modes, resize, and dock/undock toggle, per rule 24's required-for-new-primitives checklist. |
| 5 | LOW | 🎨 Style (dead code) | `template/src/widgets/map-chat/model/chat-store.svelte.ts:174-186` (`getActiveTab`/`setActiveTab`) and `:32-38` (`ChatTab` type) | Added but consumed by nothing — `grep -rn "getActiveTab\|setActiveTab\|ChatTab" src` outside this file returns zero hits, and `chat-store.test.ts` has no `activeTab` coverage. Direct symptom of Finding #1: the store-side half of the tab feature landed without its view-side consumer. | Either wire it into `MapChat.svelte`'s Tabs (Finding #1's fix covers this) in the same change, or defer adding it until the consumer lands, to avoid shipping dead exported API surface. |

**Note (not counted as a finding):** the rule-24 verification grep from `.claude/rules/24-shared-ui-ownership.md` exits non-zero (`MapChat.svelte:516 .mc-jump-wrap :global(.btn) { ... }`), but `MapChat.svelte` has a 0-line diff in this change — the match pre-dates RFC-035 Wave 1 and is out of scope for this review (pre-existing condition, not a new regression).

## Positive observations

- `FloatingWindow.svelte` itself (the parts that exist) is well-built: `@neodrag/svelte`'s `Compartment`/`controls`/`bounds`/`position`/`events` API is used correctly and idiomatically (per RFC-035's reuse-first directive) rather than hand-rolled pointer math for the drag/move path; the resize-handle pointer-capture code explicitly reuses `Splitter.svelte`'s reviewed pattern with a proper `rule-24-bits-ui`-style justification comment for why no upstream resizable-window primitive exists.
- Invariant I4 ("never restore off-screen") is honestly implemented — `clampFloating()` runs on both `loadPersisted()` and the window `resize` listener, and `isPersistedGeometry()` type-guards + version-checks the localStorage payload before trusting it, degrading to defaults on any corruption without throwing.
- `@neodrag/svelte` was correctly added to `template/package.json#dependencies` (not `devDependencies`), satisfying rule 21; no hardcoded hex colors were found in the new file (token-only styling preserved); all 59 pre-existing `map-chat`/`shared/ui` tests stay green — the (incomplete) change introduces no regressions to what already worked.

## Test coverage delta

- Before: `map-chat` + `shared/ui` — 3 test files / 59 tests (baseline, all passing)
- After: unchanged — 3 test files / 59 tests (no new test files added for `FloatingWindow` or for the new `chat-store` tab state)
- Branches gained: none
- Branches still uncovered: all of `FloatingWindow`'s persistence/clamp/dock-float/resize logic; `chat-store`'s `activeTab` get/set

## Next steps

- {BLOCKER} Halt activation. Dispatch a coder to: (a) integrate `FloatingWindow` into `MapChat.svelte` per Finding #1, (b) add the `/playground` showcase per Finding #4, (c) fix the a11y header per Finding #3, (d) add unit tests per Finding #2, then re-review the patched diff before Wave 1 is considered landed.

## References

- Parent: RFC-035
- Related EVID: none prior for this RFC
- Related ADR: none directly; rule 24 (`shared-ui-ownership`) and rule 21 (`template-purity`) both apply

## Structured Fields

verdict: weakens
congruence_level: 3
evidence_type: audit


