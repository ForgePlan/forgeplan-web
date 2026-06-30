---
depth: standard
id: PRD-013
kind: prd
last_modified_at: 2026-05-06T16:49:09.687333+00:00
last_modified_by: claude-code/2.1.131
status: active
title: Shared UI primitives + npm update notification
---

---
id: PRD-013
title: "Shared UI primitives + npm update notification"
status: Draft
author: claude-code
created: 2026-05-06
updated: 2026-05-06
priority: P1
depth: standard
domain: general
projectType: web_app
stepsCompleted: []
---

# PRD-013: Shared UI primitives + npm update notification

## Executive Summary

### Vision

Establish a minimal but reusable shared UI layer (Button, Code-with-copy,
Dialog) and a programmatic ModalManager so widgets can open dialogs without
manually mounting a component each time, then leverage that layer to surface
an "Update available" affordance in the version footer when a newer
`@forgeplan/web` is published on npm.

### Problem

Two coupled gaps in the current `template/`:

1. There are no shared UI primitives. Every widget that needs a button, code
   block, or dialog has to roll its own markup and CSS. There is no
   programmatic way to open a modal — components must be instantiated and
   mounted by every caller, which discourages reuse and bloats widget code.
2. Users have no way to learn that a newer `@forgeplan/web` is available.
   The footer shows the running version but the user must check npm
   manually. As a result, scaffolds drift behind the latest release for
   weeks; bug fixes shipped in newer versions never reach users.

**Impact**: New widgets needing a dialog (this PRD's update notice, plus
future settings/help modals) duplicate boilerplate. Stale `.forgeplan-web/`
installs miss CLI-CLI compatibility fixes and feature additions.

### Target Users

| Persona            | Description                                        | Key pain                                                                 |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Forgeplan author   | Engineer running `npx @forgeplan/web start` daily | Doesn't know an update is available; widget code reinvents UI primitives |
| Template developer | Maintainer adding new widgets to `template/`       | No shared Button/Dialog → reinvents markup, no consistent styling        |

### Differentiators

- ModalManager is a programmatic, single-mount-point API (`modalManager.open(Component, props)`),
  not a per-widget mount.
- Update check is read-only (HEAD/GET against npm registry), bounded
  in frequency, and never auto-mutates the host. Manual update remains the
  only path that touches `.forgeplan-web/`.

---

## Success Criteria

| ID   | Criterion                                                                                                    | Metric                                                | Current      | Target       | Timeframe       | How to Measure                                  |
| ---- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------ | ------------ | --------------- | ----------------------------------------------- |
| SC-1 | Shared UI primitives Button/Code/Dialog exist under `template/src/shared/ui/` and are imported by ≥1 widget  | Files exist + 1 widget imports                        | 0 primitives | 3 primitives | This PR         | `ls template/src/shared/ui/` + grep for imports |
| SC-2 | Modal can be opened without mounting in caller — single `ModalRoot` mounted in root layout                   | Caller line count to open a dialog                    | N/A          | ≤ 3 lines    | This PR         | Code review                                     |
| SC-3 | When a newer `@forgeplan/web` is published, the user sees an Update affordance within ≤ 30 minutes           | Time-to-notice from npm publish                       | ∞ (never)    | ≤ 30 min     | First polled tick post-publish | Manual: bump local pkg version, wait, observe footer |
| SC-4 | Update dialog shows current → latest and a copyable command; clicking copy writes the command to clipboard   | Functional behaviour                                  | N/A          | Pass         | This PR         | Manual smoke in browser                         |
| SC-5 | npm-registry endpoint stays read-only and respects in-process concurrency cap                                | Endpoint method + spawn count                         | N/A          | GET-only     | This PR         | Code review + `grep -RIn POST template/src/routes/api/update-check` returns 0 hits |

---

## Product Scope

### MVP (In-Scope)

- `template/src/shared/ui/button/Button.svelte` — variants `primary`,
  `secondary`, `ghost`; sizes `sm`, `md`; disabled state.
- `template/src/shared/ui/code/Code.svelte` — monospaced block with a copy
  button; uses `navigator.clipboard.writeText` (with a textarea fallback for
  insecure contexts that block the Clipboard API).
- `template/src/shared/ui/dialog/Dialog.svelte` — wraps `<dialog>`
  (HTMLDialogElement) with title, body slot, footer slot, close button,
  ESC-to-close, scrim click to dismiss (toggleable per call).
- `template/src/shared/ui/modal/modalManager.svelte.ts` — exposes
  `modalManager.open(component, props?)` returning a Promise that resolves
  on close with optional return value; `modalManager.close(id?)`.
- `template/src/shared/ui/modal/ModalRoot.svelte` — single mount point
  rendered once in `+layout.svelte`; iterates over `modalManager.stack`.
- `template/src/routes/api/update-check/+server.ts` — fetches
  `https://registry.npmjs.org/@forgeplan/web/latest` via Node `fetch`,
  returns `{ ok, data: { current, latest, hasUpdate } }`.
- Update poller — runs once at app mount, then every 30 min; shared
  `createPoller` reused with `intervalMs: 1_800_000`.
- `UpdateButton` displayed above the version footer when `hasUpdate`;
  click opens an `UpdateDialog` via modalManager.
- Documentation file describing modalManager usage (
  `template/src/shared/ui/modal/README.md`).
- Rule 22 amended to allow flag-only `--version` AND a single
  non-forgeplan read-only endpoint (`/api/update-check`) hitting
  `registry.npmjs.org`.

### Out of Scope

- Auto-update from the browser (clicking → `spawn npx @forgeplan/web update`).
  Reason: rule 22 requires endpoints be read-only proxies; running `update`
  mutates the host's `.forgeplan-web/` and would `rmSync` the very files
  serving the request, crashing the running process. Out of scope for this
  PR; revisit in a follow-up RFC if demand justifies the rule change.
- Dependency on third-party libraries for clipboard, modal, or button
  (would inflate `dist/node_modules/` and break rule 21 purity goals).
- Toast / snackbar primitives (separate concern, not needed here).
- Theme tokens beyond what already exists in `template/src/app/styles/app.css`.

### Growth Vision

- Confirm/Alert convenience wrappers around modalManager (`modalManager.confirm("...")`).
- Settings dialog using the same modalManager.
- A future RFC may revisit auto-update via a detached spawn that exits the
  running server gracefully.

---

## User Journeys

### Journey 1: Forgeplan author notices an update

**Goal**: Discover that a newer `@forgeplan/web` is available and learn how to apply it.

| Step | User action                                  | System response                                                                        | Notes |
| ---- | -------------------------------------------- | -------------------------------------------------------------------------------------- | ----- |
| 1    | Opens `http://127.0.0.1:5174` in a browser   | App polls `/api/update-check` once at mount                                            |       |
| 2    | Server fetches npm registry, finds newer ver | Returns `{current: '0.1.11', latest: '0.1.12', hasUpdate: true}`                       |       |
| 3    | UI shows a small "Update v0.1.12 →" button   | Button rendered above the version footer (same corner)                                 |       |
| 4    | Clicks the button                            | modalManager opens UpdateDialog with current → latest + copyable `npx @forgeplan/web update` command |       |
| 5    | Clicks "Copy" on the code block              | Command copied to clipboard; visual confirmation                                       |       |
| 6    | Pastes in terminal, runs                     | Local `.forgeplan-web/` updated; user refreshes browser                                |       |

**Outcome**: User upgrades within minutes of becoming aware.

### Journey 2: Template developer opens a dialog

**Goal**: Open a settings dialog without mounting a component in their widget.

| Step | User action                                                                  | System response                                                |
| ---- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1    | In a widget script: `import { modalManager } from '@/shared/ui/modal'`       | Type-checked import                                            |
| 2    | Calls `await modalManager.open(SettingsDialog, { initialTab: 'theme' })`     | `ModalRoot` (mounted in `+layout.svelte`) renders the dialog   |
| 3    | User dismisses; promise resolves                                             | Caller receives optional return value                          |

**Outcome**: Caller adds 3 lines, no per-widget `<SettingsDialog>` markup.

---

## Functional Requirements

| ID     | Category     | Priority | Requirement                                                                                                                                | Journey   |
| ------ | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-001 | UI           | Must     | Template developer can render a button via a single shared component supporting at least 3 visual variants and disabled state              | Journey 2 |
| FR-002 | UI           | Must     | Template developer can render a copyable code block via a single shared component; the copy button writes the rendered text to clipboard   | Journey 1 |
| FR-003 | UI           | Must     | Template developer can render a dialog with title, body, footer, ESC-close, and scrim-click-to-close (toggleable) via one shared component | Journey 2 |
| FR-004 | UI           | Must     | Template developer can open a modal programmatically by calling a single API method that takes a component and optional props              | Journey 2 |
| FR-005 | UI           | Must     | Forgeplan author can see at most one Update affordance when a newer package version is published; affordance is hidden otherwise           | Journey 1 |
| FR-006 | Integration  | Must     | Forgeplan author can read current and latest version side-by-side in the update dialog                                                     | Journey 1 |
| FR-007 | Integration  | Must     | Forgeplan author can copy the manual update command to clipboard with one click                                                            | Journey 1 |
| FR-008 | Polling      | Must     | System polls the registry once at app mount and at most once every 30 minutes thereafter while the tab is open                             | Journey 1 |
| FR-009 | Security     | Must     | System shall not mutate the host filesystem from any /api/update-check endpoint                                                            | Journey 1 |
| FR-010 | UX           | Should   | Template developer can stack modals (open from inside a modal) without losing the underlying one                                           | Journey 2 |
| FR-011 | UX           | Should   | Forgeplan author can dismiss the update affordance for the session without losing the dialog content                                       | Journey 1 |
| FR-012 | Docs         | Should   | Template developer can find a one-page how-to for modalManager in the repo                                                                 | Journey 2 |

---

## Non-Functional Requirements

| ID      | Category      | Requirement                                                                                                  | Metric                  | Condition                                | Measurement                                                                  |
| ------- | ------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| NFR-001 | Performance   | System shall respond to /api/update-check                                                                    | < 500ms p95             | Cold cache, single client                | Manual timing during smoke test                                              |
| NFR-002 | Resilience    | System shall return `{ok: false, error}` when the registry is unreachable, never throw an unhandled rejection | No 500s                 | Network error, DNS error, non-2xx status | curl -s /api/update-check after disabling network                            |
| NFR-003 | Security      | System shall not pass user input to spawn or fetch URL construction                                          | Static URL, no spawn    | All requests                             | Code review: URL is a string literal, no `spawn` in update-check route       |
| NFR-004 | Bundle        | System shall add zero new runtime npm dependencies to `template/package.json`                                | Diff in `dependencies`  | Post-merge                               | `git diff main -- template/package.json`                                     |
| NFR-005 | Compatibility | System shall continue to work when registry returns no `latest` dist-tag (returns hasUpdate: false)          | Graceful degradation    | npm metadata edge case                   | Stub fetch with empty `dist-tags`                                            |

---

## Acceptance Criteria

### AC-1: Update available — sticker shown

```gherkin
Given the npm registry has @forgeplan/web@0.1.12 as latest dist-tag
And   the running scaffold reports __FORGEPLAN_WEB_VERSION__ === "0.1.11"
When  the SvelteKit app polls /api/update-check
Then  the response contains hasUpdate: true and latest: "0.1.12"
And   the UpdateButton renders above the version footer
```

### AC-2: No update — sticker hidden

```gherkin
Given the npm registry latest dist-tag matches __FORGEPLAN_WEB_VERSION__
When  the app polls /api/update-check
Then  the response contains hasUpdate: false
And   no UpdateButton is rendered
```

### AC-3: Update dialog flow

```gherkin
Given hasUpdate is true
When  the user clicks the UpdateButton
Then  modalManager opens an UpdateDialog containing:
  - the current version (0.1.11) and latest version (0.1.12)
  - a Code component with the literal text "npx @forgeplan/web update"
  - a Copy action that writes that command to clipboard
```

### AC-4: Registry unreachable

```gherkin
Given the npm registry is unreachable (DNS fail or non-2xx)
When  the app polls /api/update-check
Then  the endpoint returns { ok: false, error: "<message>" } with HTTP 200
And   no UpdateButton is rendered
And   the Svelte console logs no unhandled error
```

### AC-5: ModalManager API

```gherkin
Given a Svelte component MyDialog
When  a caller invokes modalManager.open(MyDialog, { foo: "bar" })
Then  the dialog appears in ModalRoot
And   the call returns a Promise that resolves when the dialog closes
```

---

## Dependencies

| Dependency                              | Type     | Status | Owner       |
| --------------------------------------- | -------- | ------ | ----------- |
| Existing `runForgeplan` server module   | Internal | Ready  | this repo   |
| `__FORGEPLAN_WEB_VERSION__` Vite define | Internal | Ready  | this repo   |
| `registry.npmjs.org` HTTPS              | External | Ready  | npm Inc.    |
| Rule 22 amendment                       | Internal | This PR | this repo   |

---

## Risks & Mitigations

| ID  | Risk                                                                                                              | Probability | Impact | Mitigation                                                                                                | Owner     |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ------ | --------------------------------------------------------------------------------------------------------- | --------- |
| R-1 | npm registry rate-limits or returns 429                                                                           | Low         | Low    | 30-minute polling interval + graceful `hasUpdate: false` on non-2xx; cache result per server process      | this repo |
| R-2 | navigator.clipboard fails on insecure context (older Safari)                                                      | Medium      | Low    | Fallback to a hidden `<textarea>` + `document.execCommand('copy')`; show a hint if fallback also fails    | this repo |
| R-3 | ModalManager memory leak — components added but never released                                                    | Medium      | Medium | Close removes from store; component instances destroyed when stack item removed (Svelte handles unmount)  | this repo |
| R-4 | Rule 22 amendment opens the door to future mutation endpoints                                                     | Medium      | Medium | Amendment names exactly one URL (`/api/update-check`) and one host (`registry.npmjs.org`), GET-only       | this repo |
| R-5 | Auto-update follow-up implementation tries to `spawn` from the running process and crashes mid-request            | Low         | Medium | Out of scope for this PR; explicit Out-of-Scope clause + dialog wording sets expectation for manual run   | this repo |

---

## Affected Files

- `template/src/shared/ui/**` (new)
- `template/src/widgets/version-footer/**` (modified)
- `template/src/routes/api/update-check/+server.ts` (new)
- `template/src/routes/+layout.svelte` (mount ModalRoot)
- `.claude/rules/22-readonly-proxy.md` (amend allow-list)
- `.forgeplan/rfcs/RFC-012-*.md` (new)

## Related Artifacts

| Artifact | Relation             | Status |
| -------- | -------------------- | ------ |
| RFC-012  | Architecture proposal | Draft (this PR) |
| EVID-017 | Smoke + svelte-check | This PR |

---

> **Next step**: validate PRD-013 → create RFC-012.

