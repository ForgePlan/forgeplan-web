---
depth: standard
id: RFC-012
kind: rfc
last_modified_at: 2026-05-06T16:50:53.031656+00:00
last_modified_by: claude-code/2.1.131
links:
- target: PRD-013
  relation: based_on
status: draft
title: Shared UI primitives + ModalManager + update checker
---

---
id: RFC-012
title: "Shared UI primitives + ModalManager + update checker"
status: Draft
author: claude-code
created: 2026-05-06
updated: 2026-05-06
prd: PRD-013
depth: standard
---

# RFC-012: Shared UI primitives + ModalManager + update checker

## Summary

Introduce a `template/src/shared/ui/` segment with three primitives
(Button, Code-with-copy, Dialog) and a programmatic ModalManager. Add a
new read-only endpoint `/api/update-check` that polls the npm registry
and a poller that runs once at mount and every 30 minutes. Surface an
Update affordance above the version footer when a newer release exists.

## Motivation

See PRD-013. Two problems: (1) widgets reinvent UI primitives; (2) users
have no signal that a newer `@forgeplan/web` exists, so scaffolds drift
behind. Both are solved by a small shared-ui layer + one read-only HTTP
fetch.

## Non-Goals

- Auto-update from the browser (would require a write endpoint and
  self-replacing the running server's files; rejected for this RFC,
  see PRD-013 § Out of Scope).
- New runtime npm dependencies in `template/`.
- Theme tokens / global redesign — primitives reuse existing CSS vars
  in `template/src/app/styles/app.css`.

---

## Architecture

### File layout

```
template/src/shared/services/
  index.ts                          # barrel
  modal/
    modal-manager.svelte.ts         # singleton store + open/close API (the service)
    index.ts

template/src/shared/ui/
  index.ts                          # barrel: primitives + ModalRoot (no service re-export)
  README.md                         # how-to-use modalManager (FR-012)
  button/
    Button.svelte                   # variants: primary | secondary | ghost; sizes: sm | md
    index.ts
  code/
    Code.svelte                     # <pre><code> + copy button; clipboard with textarea fallback
    index.ts
  dialog/
    Dialog.svelte                   # <dialog>-based, ESC-close, scrim-click-close (toggleable)
    index.ts
  modal/
    ModalRoot.svelte                # iterates stack, mounted ONCE in +layout.svelte
    index.ts

template/src/widgets/version-footer/
  ui/
    VersionFooter.svelte            # existing; modified to render <UpdateButton/> on top
    UpdateButton.svelte             # new: visible when state.hasUpdate
    UpdateDialog.svelte             # new: opened via modalManager
  api/
    update-check.svelte.ts          # createPoller<UpdateData>('/api/update-check', 30 min)
  index.ts                          # re-exports VersionFooter only

template/src/routes/api/update-check/
  +server.ts                        # GET — fetch registry.npmjs.org, return envelope
```

Per FSD `shared/ui` and `shared/services` are the lowest layer;
`widgets/version-footer` may import from them freely. The split keeps
`shared/ui` purely visual: any caller wanting the modalManager API
imports from `@/shared/services`. `ModalRoot` stays in `shared/ui` since
it is a render component (consumes the service to render its stack).

### ModalManager API

```ts
// shared/services/modal/modal-manager.svelte.ts
import type { Component, ComponentProps } from 'svelte';

export interface ModalEntry<C extends Component = Component> {
  id: number;
  component: C;
  props: ComponentProps<C>;
  resolve: (value: unknown) => void;
}

export interface ModalManager {
  readonly stack: ModalEntry[];          // reactive ($state)
  open<C extends Component>(
    component: C,
    props?: Omit<ComponentProps<C>, 'modalId'>,
  ): Promise<unknown>;
  close(id: number, value?: unknown): void;
  closeTop(value?: unknown): void;
}

export const modalManager: ModalManager = createModalManager();
```

Children opened via `modalManager.open` receive a `modalId: number` prop
they can pass to `modalManager.close(modalId, value)` when dismissing
themselves. The returned Promise resolves with that value.

`ModalRoot.svelte` mounted once in `+layout.svelte`:

```svelte
<!-- shared/ui/modal/ModalRoot.svelte -->
<script lang="ts">
  import { modalManager } from '@/shared/services';
</script>

{#each modalManager.stack as entry (entry.id)}
  {@const { component: Component, props } = entry}
  <Component {...props} modalId={entry.id} />
{/each}
```

### `/api/update-check` endpoint

Read-only. Fetches `https://registry.npmjs.org/@forgeplan/web/latest`
with a 5 s timeout and a `User-Agent` header. Compares with the build-
time `__FORGEPLAN_WEB_VERSION__` Vite define already used in
`/api/version`.

```ts
// +server.ts
import { json } from '@sveltejs/kit';
import { compareSemver } from '@/shared/server/semver';

const REGISTRY_URL = 'https://registry.npmjs.org/@forgeplan/web/latest';
const TIMEOUT_MS = 5_000;
const CACHE_MS = 5 * 60_000;

let cache: { latest: string; ts: number } | null = null;

export const GET = async () => {
  const current = __FORGEPLAN_WEB_VERSION__;
  try {
    const latest = await getLatestCached();
    return json({
      ok: true,
      data: { current, latest, hasUpdate: latest ? compareSemver(latest, current) > 0 : false },
      cmd: 'GET registry.npmjs.org/@forgeplan/web/latest',
    });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message, cmd: 'GET registry.npmjs.org/@forgeplan/web/latest' });
  }
};
```

`compareSemver` is a tiny pure function in `template/src/shared/server/semver.ts`
that splits on `.` and `-`, compares numerically with prerelease less than
release. Zero deps. Already needed; no equivalent in standard library.

### Poller config

`createPoller<UpdateData>('/api/update-check', 30 * 60_000)`. The
existing `createPoller` already handles AbortController, `inflight`,
`browser` guard, and start/stop on mount.

### Footer composition

```svelte
<!-- VersionFooter.svelte (modified) -->
<script lang="ts">
  import { modalManager } from '@/shared/ui/modal';
  import UpdateButton from './UpdateButton.svelte';
  import UpdateDialog from './UpdateDialog.svelte';
  import { updatePoller } from '../api/update-check.svelte';
  // existing version state ...
  updatePoller.start();
</script>

{#if updatePoller.state.data?.hasUpdate}
  <UpdateButton
    current={updatePoller.state.data.current}
    latest={updatePoller.state.data.latest}
    onclick={() => modalManager.open(UpdateDialog, {
      current: updatePoller.state.data!.current,
      latest: updatePoller.state.data!.latest,
    })}
  />
{/if}
<!-- ... existing version chip ... -->
```

### Rule 22 amendment

Append a new section "Allow-list extension: `/api/update-check`" that
permits exactly one URL (`https://registry.npmjs.org/@forgeplan/web/latest`),
GET-only, no host filesystem mutation. The runtime backstop is a string
literal in the route — no user input touches the URL.

---

## Implementation Plan

| Phase | Task                                                                                                | File(s)                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1     | Build Button primitive                                                                              | `template/src/shared/ui/button/**`                                                      |
| 1     | Build Code-with-copy primitive                                                                      | `template/src/shared/ui/code/**`                                                        |
| 1     | Build Dialog primitive                                                                              | `template/src/shared/ui/dialog/**`                                                      |
| 1     | Build modalManager + ModalRoot                                                                      | `template/src/shared/ui/modal/**`                                                       |
| 1     | Mount ModalRoot in root layout                                                                      | `template/src/routes/+layout.svelte`                                                    |
| 1     | Write modalManager README                                                                           | `template/src/shared/ui/README.md`                                                      |
| 2     | Add `compareSemver` helper                                                                          | `template/src/shared/server/semver.ts`                                                  |
| 2     | Add `/api/update-check` endpoint                                                                    | `template/src/routes/api/update-check/+server.ts`                                       |
| 2     | Add updatePoller (30-min interval)                                                                  | `template/src/widgets/version-footer/api/update-check.svelte.ts`                        |
| 2     | Add UpdateButton + UpdateDialog                                                                     | `template/src/widgets/version-footer/ui/Update*.svelte`                                 |
| 2     | Wire poller into VersionFooter                                                                      | `template/src/widgets/version-footer/ui/VersionFooter.svelte`                           |
| 3     | Amend rule 22                                                                                       | `.claude/rules/22-readonly-proxy.md`                                                    |
| 3     | Validate: `npm run check` in template, `npm run smoke` at root                                      | n/a                                                                                     |
| 4     | Forgeplan: evidence, score, activate                                                                | `.forgeplan/`                                                                           |

## Testing Strategy

- Manual smoke in browser: open the SvelteKit dev server, force-bump the
  local `__FORGEPLAN_WEB_VERSION__` define to a stale value via
  `vite.config.ts`, confirm the button appears and the dialog opens.
- `template`'s `npm run check` (svelte-check) — must stay clean.
- Root `npm run smoke` — must pass; no regression in init/start path.
- `compareSemver` unit test in `template` (`vitest`).

## Rollout

Single PR `feat/shared-ui-update-checker` → `develop`. No feature flag
needed: behaviour is additive (extra endpoint + extra widget); existing
endpoints unchanged.

## Backwards Compatibility

- Existing widgets do not consume the new primitives — no breakage.
- `/api/version` and `/api/health` shapes unchanged.
- The new `/api/update-check` is a brand-new path; no version migration
  needed.
- Footer layout: the chip itself is unchanged; the Update button only
  appears when `hasUpdate`.

## Security

- Update endpoint uses a hard-coded URL string literal — no user input.
- 5-second timeout via `AbortController`.
- 5-minute server-process cache to avoid registry hammering.
- No spawn from the new endpoint — pure `fetch`.
- `navigator.clipboard` requires a secure context; the textarea fallback
  uses `document.execCommand('copy')` which is widely available.

## Performance

- Poll interval 30 min × 1 fetch ≈ 48 req/day per open tab. Negligible.
- Server-process cache returns within ms after the first hit.

## Alternatives considered

| Option                                             | Why rejected                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| Use a 3rd-party modal lib (svelte-headlessui)      | Adds runtime dep → bloats `dist/node_modules/`, breaks zero-dep ethos   |
| Spawn `npm view @forgeplan/web version` server-side | Requires npm CLI on PATH at runtime; rule 22 spirit favours pure HTTP   |
| Auto-update via POST endpoint                      | Mutates host fs; would `rmSync` files of the running server. Out-of-scope |
| Client-side fetch to registry.npmjs.org            | CORS — npm registry does not allow browser CORS for `/<pkg>/latest`     |
| 5-minute polling                                   | Wastes registry quota; updates are rare. 30 min meets PRD SC-3.         |

## Open Questions

None — all resolved in PRD-013.

## Affected Files

- `template/src/shared/ui/**` (new)
- `template/src/shared/server/semver.ts` (new)
- `template/src/widgets/version-footer/**` (modified)
- `template/src/routes/api/update-check/+server.ts` (new)
- `template/src/routes/+layout.svelte` (modified — mount ModalRoot)
- `.claude/rules/22-readonly-proxy.md` (amended)
- `.forgeplan/prds/PRD-013-*.md` (this RFC's parent)

## Related Artifacts

| Artifact | Relation     | Status |
| -------- | ------------ | ------ |
| PRD-013  | Parent PRD   | Draft  |
| EVID-017 | Smoke + check | This PR |

