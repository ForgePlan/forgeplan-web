# `shared/ui` — UI primitives (paired with `shared/services` for ModalManager)

Tiny, dependency-free building blocks shared across `widgets/` and
`pages/`. Driven by PRD-013 / RFC-012.

The `modalManager` *service* itself lives under
[`shared/services/modal`](../services/modal) — `shared/ui` only owns the
`ModalRoot` mount component and the visual primitives below.

## Primitives

| Primitive   | Import path                                | Purpose                                                          |
| ----------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `Button`    | `import { Button } from '@/shared/ui'`     | Button with `variant` (primary / secondary / ghost) and `size` (sm / md). |
| `Code`      | `import { Code } from '@/shared/ui'`       | Monospaced block (or `inline`) with a copy-to-clipboard button.  |
| `Dialog`    | `import { Dialog } from '@/shared/ui'`     | `<dialog>` wrapper — title, body / footer slots, ESC-close, scrim-close, close button. Pair with `ModalRoot` if you want programmatic open. |
| `ModalRoot` | `import { ModalRoot } from '@/shared/ui'`  | Iterates the modalManager stack. Mount once in `+layout.svelte`. |

```svelte
<script lang="ts">
  import { Button, Code } from '@/shared/ui';
</script>

<Button variant="primary" onclick={save}>Save</Button>
<Code code="npx @forgeplan/web update" />
```

## ModalManager

A programmatic modal API. Instead of mounting `<MyDialog open={...}/>`
inside every caller, register the dialog component once and open it
imperatively from anywhere.

### One-time setup

`ModalRoot` is mounted once in the root layout (`+layout.svelte`):

```svelte
<script lang="ts">
  import { ModalRoot } from '@/shared/ui';
</script>

{@render children?.()}
<ModalRoot />
```

This is already done in `template/src/routes/+layout.svelte`. New
SvelteKit apps copying the template inherit it automatically.

### Opening a modal

```svelte
<script lang="ts">
  import { modalManager } from '@/shared/services';
  import SettingsDialog from './SettingsDialog.svelte';

  async function openSettings() {
    const result = await modalManager.open(SettingsDialog, { tab: 'theme' });
    // `result` is whatever the dialog passes to modalManager.close(modalId, value)
  }
</script>

<button onclick={openSettings}>Settings…</button>
```

### Inside a dialog component

The component receives `modalId: number` as an injected prop. Use it
to close itself and optionally return a value:

```svelte
<script lang="ts">
  import { Button, Dialog } from '@/shared/ui';
  import { modalManager } from '@/shared/services';

  interface Props {
    modalId: number;
    initialTab?: string;
  }

  let { modalId, initialTab = 'general' }: Props = $props();
  let open = $state(true);
  let tab = $state(initialTab);

  function close(returnValue?: unknown) {
    open = false;
    modalManager.close(modalId, returnValue);
  }
</script>

<Dialog {open} title="Settings" onclose={() => close()}>
  <!-- ... body / footer using `{#snippet body()}` / `{#snippet footer()}` ... -->
</Dialog>
```

### API

```ts
modalManager.open(Component, props?)  // → Promise resolved on close
modalManager.close(modalId, value?)   // close a specific dialog
modalManager.closeTop(value?)         // close the topmost dialog
modalManager.stack                    // reactive stack — read-only
```

Stacked modals are supported: `modalManager.open` from inside a dialog
just pushes another entry onto the stack.

## Conventions

- Primitives live one-folder-per-component (`button/`, `code/`, …) with a
  barrel `index.ts` re-exporting the default. The top-level
  `shared/ui/index.ts` is the public surface.
- No third-party runtime deps — primitives reuse CSS vars from
  `template/src/app/styles/app.css`.
- Each primitive is self-contained: no cross-imports between siblings
  except via `shared/ui` itself (e.g. `UpdateDialog` imports `{ Code,
  Button, Dialog }` from `@/shared/ui`).
