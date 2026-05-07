# `shared/ui` — primitive catalogue

Driven by PRD-018 / RFC-016. Thin, dependency-free building blocks shared
across `widgets/`, `pages/`, and `entities/`. All primitives consume CSS
variables from [`app/styles/app.css`](../../app/styles/app.css) — there is
**no Tailwind**.

`bits-ui` (already in `template/package.json#dependencies`) provides the
behaviour layer (focus management, keyboard nav, ARIA) for accessibility-
sensitive primitives. Pure visual atoms (Badge, Separator, Skeleton,
Spinner, Card, Alert, Progress, Label, Input, Field, InputGroup,
ButtonGroup, Toaster) carry no `bits-ui` import.

The `modalManager` *service* itself lives under
[`shared/services/modal`](../services/modal) — `shared/ui` only owns the
`ModalRoot` mount component and the visual primitives below.

## Primitive catalogue (26 + extras)

### Visual atoms

| Primitive   | Import                                         | Notes                                                      |
|-------------|------------------------------------------------|------------------------------------------------------------|
| `Badge`     | `import { Badge } from '@/shared/ui'`          | `variant` (primary/secondary/success/danger/ghost/**mono**), `size` |
| `Separator` | `import { Separator } from '@/shared/ui'`      | `orientation` (horizontal/vertical), `decorative`          |
| `Skeleton`  | `import { Skeleton } from '@/shared/ui'`       | `width`/`height`/`radius`, shimmer + reduced-motion fallback |
| `Spinner`   | `import { Spinner } from '@/shared/ui'`        | `size` (sm/md/lg), `aria-label`                            |
| `Card`      | `import { Card } from '@/shared/ui'`           | `padding`, `variant` (flat/outlined/elevated), header/footer snippets |
| `Alert`     | `import { Alert } from '@/shared/ui'`          | `variant` (info/success/warning/danger), `tone` (default/**banner**), Lucide icon defaults |
| `Progress`  | `import { Progress } from '@/shared/ui'`       | 0..max value or indeterminate, `variant`                    |

### Form basics

| Primitive    | Import                                          | Notes                                              |
|--------------|-------------------------------------------------|----------------------------------------------------|
| `Label`      | `import { Label } from '@/shared/ui'`           | `required`/`optional` indicators                   |
| `Input`      | `import { Input } from '@/shared/ui'`           | `inputSize` (sm/md), `invalid`, native `<input>`    |
| `Field`      | `import { Field } from '@/shared/ui'`           | Pairs Label + control + helper/error; render snippet props |
| `InputGroup` | `import { InputGroup } from '@/shared/ui'`      | `prefix`/`suffix` snippets around an Input          |

### Toggles

| Primitive       | Import                                                      | Notes                                                    |
|-----------------|-------------------------------------------------------------|----------------------------------------------------------|
| `Toggle`        | `import { Toggle } from '@/shared/ui'`                      | `pressed`/`onPressedChange`, `variant` (default/outline/**outline-mono**) |
| `ToggleGroup`   | `import { ToggleGroup, ToggleGroupItem } from '@/shared/ui'`| `single`/`multiple` modes, horizontal/vertical, `variant` (default/**outline-mono**/**outline**), `spacing` (boolean — gap + flex-wrap, drops shared chrome); `ToggleGroupItem` accepts `role` + `aria-checked` for radiogroup composition |
| `ButtonGroup`   | `import { ButtonGroup } from '@/shared/ui'`                  | Pure CSS composition — collapses inner radii (attached) |
| `Switch`        | `import { Switch } from '@/shared/ui'`                       | `bind:checked`, accent track when on                     |
| `Checkbox`      | `import { Checkbox } from '@/shared/ui'`                     | `bind:checked`, `bind:indeterminate`                     |
| `Slider`        | `import { Slider } from '@/shared/ui'`                       | Multi-thumb, horizontal/vertical                          |

### Radio

| Primitive     | Import                                                   | Notes                                       |
|---------------|----------------------------------------------------------|---------------------------------------------|
| `RadioGroup`  | `import { RadioGroup, Radio } from '@/shared/ui'`        | `value` + `onValueChange`, `name` for forms |
| `Radio`       | `import { Radio } from '@/shared/ui'`                    | Item with accent dot when checked            |

### Disclosure

| Primitive       | Import                                                          | Notes                                  |
|-----------------|-----------------------------------------------------------------|----------------------------------------|
| `Tabs`          | `Tabs, TabsList, TabsTrigger, TabsContent`                      | `orientation`, `activationMode`         |
| `Collapsible`   | `Collapsible, CollapsibleTrigger, CollapsibleContent`           | Slide animation                         |
| `Accordion`     | `Accordion, AccordionItem, AccordionTrigger, AccordionContent` | `single`/`multiple` modes               |

### Overlays

| Primitive       | Import                                                  | Notes                                       |
|-----------------|---------------------------------------------------------|---------------------------------------------|
| `Tooltip`       | `Tooltip, TooltipProvider`                              | Provider mounted in `+layout.svelte` once   |
| `Popover`       | `Popover, PopoverTrigger, PopoverContent`               | Portal-based, optional Arrow                |
| `Toaster`       | `Toaster`, `toast()`                                    | Wraps `svelte-sonner`; 6 corner positions; `toast.info/success/warning/danger` (danger → sonner `error`) |

### Command palette

| Primitive       | Import                                                                                  | Notes                       |
|-----------------|-----------------------------------------------------------------------------------------|-----------------------------|
| `Command`       | `Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandSeparator, Item`| Filtered list with keyboard nav |

### Existing primitives (pre-PRD-018)

| Primitive   | Import                                | Purpose                                                          |
|-------------|----------------------------------------|------------------------------------------------------------------|
| `Button`    | `import { Button } from '@/shared/ui'` | `variant` (primary/secondary/ghost/**ghost-mono**), `size` (sm/md/**icon**) |
| `Code`      | `import { Code } from '@/shared/ui'`   | Monospaced block (or inline) with copy-to-clipboard               |
| `Dialog`    | `import { Dialog } from '@/shared/ui'` | `<dialog>` wrapper                                                |
| `ModalRoot` | `import { ModalRoot } from '@/shared/ui'` | Iterates the modalManager stack — mount in `+layout.svelte`    |
| `Select`    | `import { Select } from '@/shared/ui'` | Wraps bits-ui Select with token-driven chrome                     |

```svelte
<script lang="ts">
  import { Button, Badge, Tooltip } from '@/shared/ui';
</script>

<Tooltip label="Save your work">
  <Button variant="primary">Save</Button>
</Tooltip>
<Badge variant="success">Up to date</Badge>
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
- No third-party runtime deps beyond `bits-ui` + `@lucide/svelte`. Primitives
  reuse CSS vars from `template/src/app/styles/app.css`.
- Each primitive is self-contained: no cross-imports between siblings
  except via `shared/ui` itself (e.g. `UpdateDialog` imports `{ Code,
  Button, Dialog }` from `@/shared/ui`).
- Variant / size vocabulary is shared across primitives:
  - `variant`: subset of `primary | secondary | ghost | success | danger`
  - `size`: `sm | md` (some primitives extend with `lg`)
- A `/playground` route showcases every primitive in both themes — useful
  for visual smoke testing during PRs.
