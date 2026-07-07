<script lang="ts">
  import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    Alert,
    Badge,
    Button,
    ButtonGroup,
    Card,
    Checkbox,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxTrigger,
    type ComboboxSize,
    type ComboboxVariant,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandList,
    CommandSeparator,
    Field,
    FloatingWindow,
    Input,
    InputGroup,
    Item,
    Label,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Progress,
    Radio,
    RadioGroup,
    ScrollArea,
    Separator,
    Skeleton,
    Slider,
    Spinner,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Toaster,
    Toggle,
    ToggleGroup,
    ToggleGroupItem,
    Tooltip,
    toast,
  } from '@/shared/ui';

  let switchOn = $state(false);
  let cbOn = $state(false);
  let cbInd = $state(true);
  let togglePressed = $state(false);
  let tgValue = $state('left');
  let tgMulti = $state<string[]>(['bold']);
  let radioValue = $state('one');
  let tabValue = $state('overview');
  let accValue = $state<string[]>(['a']);
  let collapsibleOpen = $state(true);
  let popoverOpen = $state(false);
  let sliderValue = $state([45]);
  let progressValue = $state(35);
  let inputValue = $state('');
  let invalidValue = $state('not-an-email');
  let cmdValue = $state('');
  let floatingDemoOpen = $state(false);

  const comboboxOptions: { value: string; label: string }[] = [
    { value: 'project-a', label: 'Project A' },
    { value: 'project-b', label: 'Project B' },
    { value: 'repo-x', label: 'Repo X' },
    { value: 'repo-y', label: 'Repo Y' },
    { value: 'workspace-z', label: 'Workspace Z' },
    { value: 'forgeplan-web', label: 'forgeplan-web' },
    { value: 'forgeplan-cli', label: 'forgeplan-cli' },
  ];
  const comboboxMatrix: { variant: ComboboxVariant; size: ComboboxSize }[] = [
    { variant: 'default', size: 'sm' },
    { variant: 'default', size: 'md' },
    { variant: 'mono', size: 'sm' },
    { variant: 'mono', size: 'md' },
    { variant: 'ghost', size: 'sm' },
    { variant: 'ghost', size: 'md' },
  ];
  let comboboxValues = $state<Record<string, string>>({
    'default-sm': '',
    'default-md': '',
    'mono-sm': '',
    'mono-md': '',
    'ghost-sm': '',
    'ghost-md': '',
  });
</script>

<div class="playground">
  <header class="page-header">
    <h1>shared/ui playground</h1>
    <p class="muted">
      All primitives from <code>@/shared/ui</code>. Toggle theme via the system
      data-theme attribute.
    </p>
  </header>

  <section>
    <h2>Visual atoms</h2>
    <Card>
      <div class="row">
        <Badge>secondary</Badge>
        <Badge variant="primary">primary</Badge>
        <Badge variant="success">success</Badge>
        <Badge variant="danger">danger</Badge>
        <Badge variant="ghost">ghost</Badge>
        <Badge variant="mono">mono</Badge>
        <Badge variant="mono" size="md">PRD</Badge>
      </div>
      <Separator />
      <div class="row gap-md">
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" />
        <div class="vsep"><Separator orientation="vertical" /></div>
        <Skeleton width={120} height={12} />
        <Skeleton width={80} height={24} radius={6} />
      </div>
      <Separator />
      <Alert variant="info" title="Info">Plain informational message.</Alert>
      <Alert variant="success" title="Success">Looking good.</Alert>
      <Alert variant="warning" title="Warning">Watch this.</Alert>
      <Alert variant="danger" title="Danger">Something went wrong.</Alert>
      <Alert variant="danger" tone="banner" title="Banner">Edge-to-edge banner — no rounded corners, no left/right border.</Alert>
      <Separator />
      <div class="stack">
        <Progress value={progressValue} />
        <Progress value={progressValue} variant="success" />
        <Progress value={null} variant="warning" />
        <ButtonGroup>
          <Button onclick={() => (progressValue = Math.max(0, progressValue - 10))}>
            -10
          </Button>
          <Button onclick={() => (progressValue = Math.min(100, progressValue + 10))}>
            +10
          </Button>
        </ButtonGroup>
      </div>
      <Separator />
      <div class="row gap-md">
        <Button variant="ghost-mono" size="sm">Show downstream</Button>
        <Button variant="ghost-mono" size="sm" aria-expanded="true">Toggled on</Button>
        <Button variant="ghost-mono">Update available</Button>
        <Button variant="secondary" size="icon" aria-label="Close">×</Button>
        <Button variant="ghost" size="icon" aria-label="Settings">⚙</Button>
      </div>
      <Separator />
      <div class="row gap-md">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="ghost-mono">Ghost mono</Button>
        <Button variant="magic">✨ Magic</Button>
        <Button variant="magic" size="sm">Ask</Button>
        <Button variant="magic" disabled>Magic (disabled)</Button>
      </div>
    </Card>
  </section>

  <section>
    <h2>Form basics</h2>
    <Card>
      <div class="grid">
        <Field label="Email" required helper="We never share your email.">
          {#snippet children({ id })}
            <Input {id} type="email" placeholder="you@example.com" bind:value={inputValue} />
          {/snippet}
        </Field>
        <Field label="Username" optional error="Username must not contain spaces.">
          {#snippet children({ id, invalid })}
            <Input {id} placeholder="jane.doe" bind:value={invalidValue} {invalid} />
          {/snippet}
        </Field>
        <div class="stack">
          <Label>Search</Label>
          <InputGroup>
            {#snippet prefix()}<span>?</span>{/snippet}
            <Input placeholder="search…" />
            {#snippet suffix()}<span>↵</span>{/snippet}
          </InputGroup>
        </div>
      </div>
    </Card>
  </section>

  <section>
    <h2>Toggles</h2>
    <Card>
      <div class="row gap-md">
        <Toggle bind:pressed={togglePressed} ariaLabel="Bold">B</Toggle>
        <Toggle variant="outline" ariaLabel="Italic">I</Toggle>
        <Toggle variant="outline-mono" size="sm" ariaLabel="Notify">🔔 Notify</Toggle>
        <ButtonGroup>
          <Button>Cancel</Button>
          <Button variant="primary">Save</Button>
        </ButtonGroup>
      </div>
      <Separator />
      <div class="stack">
        <Label>Align (single)</Label>
        <ToggleGroup type="single" bind:value={tgValue} ariaLabel="Align">
          <ToggleGroupItem value="left">Left</ToggleGroupItem>
          <ToggleGroupItem value="center">Center</ToggleGroupItem>
          <ToggleGroupItem value="right">Right</ToggleGroupItem>
        </ToggleGroup>
        <p class="muted">Selected: {tgValue}</p>
      </div>
      <div class="stack">
        <Label>Theme (radiogroup, outline-mono)</Label>
        <div role="radiogroup" aria-label="Theme demo">
          <ToggleGroup type="single" size="sm" variant="outline-mono" bind:value={tgValue} ariaLabel="Theme">
            <ToggleGroupItem value="left" role="radio" aria-checked={tgValue === 'left'}>Auto</ToggleGroupItem>
            <ToggleGroupItem value="center" role="radio" aria-checked={tgValue === 'center'}>Light</ToggleGroupItem>
            <ToggleGroupItem value="right" role="radio" aria-checked={tgValue === 'right'}>Dark</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div class="stack">
        <Label>Style (multiple)</Label>
        <ToggleGroup type="multiple" bind:value={tgMulti} ariaLabel="Style">
          <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
          <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
          <ToggleGroupItem value="under">Underline</ToggleGroupItem>
        </ToggleGroup>
        <p class="muted">Selected: {tgMulti.join(', ') || '—'}</p>
      </div>
      <div class="stack">
        <Label>Outline variant (multiple, no spacing)</Label>
        <ToggleGroup type="multiple" size="sm" variant="outline" bind:value={tgMulti} ariaLabel="Outline style">
          <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
          <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
          <ToggleGroupItem value="under">Underline</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="stack">
        <Label>Outline variant + spacing (multiple)</Label>
        <ToggleGroup type="multiple" size="sm" variant="outline" spacing={true} bind:value={tgMulti} ariaLabel="Outline + spacing">
          <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
          <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
          <ToggleGroupItem value="under">Underline</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Separator />
      <div class="row gap-md">
        <label class="inline">
          <Switch bind:checked={switchOn} ariaLabel="Toggle setting" />
          <span>Switch ({switchOn ? 'on' : 'off'})</span>
        </label>
        <label class="inline">
          <Checkbox bind:checked={cbOn} ariaLabel="Confirm" />
          <span>Confirm</span>
        </label>
        <label class="inline">
          <Checkbox bind:indeterminate={cbInd} ariaLabel="Tri-state" />
          <span>Tri-state ({cbInd ? 'indeterminate' : cbOn ? 'on' : 'off'})</span>
        </label>
      </div>
      <Separator />
      <div class="stack">
        <Label>Slider</Label>
        <Slider bind:value={sliderValue} min={0} max={100} step={1} />
        <p class="muted">Value: {sliderValue[0]}</p>
      </div>
    </Card>
  </section>

  <section>
    <h2>Radio</h2>
    <Card>
      <RadioGroup bind:value={radioValue} ariaLabel="Choices" name="example">
        <label class="inline"><Radio value="one" /> Option one</label>
        <label class="inline"><Radio value="two" /> Option two</label>
        <label class="inline"><Radio value="three" disabled /> Option three (disabled)</label>
      </RadioGroup>
      <p class="muted">Selected: {radioValue}</p>
    </Card>
  </section>

  <section>
    <h2>Disclosure</h2>
    <Card>
      <Tabs bind:value={tabValue}>
        <TabsList ariaLabel="Sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p>Tab #1 content. Tabs persist focus + keyboard nav via bits-ui.</p>
        </TabsContent>
        <TabsContent value="details">
          <p>Tab #2 — details panel.</p>
        </TabsContent>
        <TabsContent value="logs">
          <p>Tab #3 — logs panel.</p>
        </TabsContent>
      </Tabs>
      <Separator />
      <Collapsible bind:open={collapsibleOpen}>
        <CollapsibleTrigger>
          {collapsibleOpen ? '▾' : '▸'} Toggle details
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p class="muted">Collapsible content with slide animation.</p>
        </CollapsibleContent>
      </Collapsible>
      <Separator />
      <Accordion type="multiple" bind:value={accValue}>
        <AccordionItem value="a">
          <AccordionTrigger>What is shared/ui?</AccordionTrigger>
          <AccordionContent>
            A primitive catalogue used across widgets and pages.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Does it use Tailwind?</AccordionTrigger>
          <AccordionContent>
            No — primitives consume CSS variables from app.css.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="c">
          <AccordionTrigger>What about accessibility?</AccordionTrigger>
          <AccordionContent>
            bits-ui handles focus, keyboard nav, and ARIA wiring under the hood.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  </section>

  <section>
    <h2>Overlays</h2>
    <Card>
      <div class="row gap-md">
        <Tooltip label="Tooltip text — positioned above the trigger">
          <Button>Hover me</Button>
        </Tooltip>
        <Popover bind:open={popoverOpen}>
          <PopoverTrigger>
            <Button variant="primary">Open popover</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p>Hello from a popover. Click outside or press Esc to close.</p>
          </PopoverContent>
        </Popover>
        <Button onclick={() => toast.info('Info toast')}>Info toast</Button>
        <Button variant="primary" onclick={() => toast.success('Saved!')}>
          Success toast
        </Button>
        <Button onclick={() => toast.warning('Heads up')}>Warning toast</Button>
        <Button onclick={() => toast.danger('Something exploded')}>Danger toast</Button>
      </div>
    </Card>
  </section>

  <section>
    <h2>Command palette</h2>
    <Card>
      <Command bind:value={cmdValue}>
        <CommandInput placeholder="Search components, actions…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <Item onSelect={() => toast.info('Calendar')}>Calendar</Item>
            <Item onSelect={() => toast.info('Search emoji')}>Search emoji</Item>
            <Item onSelect={() => toast.info('Calculator')}>Calculator</Item>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <Item onSelect={() => toast.info('Profile')}>Profile</Item>
            <Item onSelect={() => toast.info('Billing')}>Billing</Item>
            <Item onSelect={() => toast.info('Settings')}>Settings</Item>
          </CommandGroup>
        </CommandList>
      </Command>
      <p class="muted">Selected value: {cmdValue || '—'}</p>
    </Card>
  </section>

  <section>
    <h2>Combobox</h2>
    <Card>
      <p class="muted">
        Searchable single-select dropdown built on bits-ui's Combobox.
        Type to filter; Arrow keys navigate; Enter selects; Escape closes.
      </p>
      <div class="cb-grid">
        {#each comboboxMatrix as combo (`${combo.variant}-${combo.size}`)}
          {@const key = `${combo.variant}-${combo.size}`}
          {@const current = comboboxValues[key] ?? ''}
          {@const active = comboboxOptions.find((o) => o.value === current)}
          <div class="cb-tile">
            <span class="cb-tile-label">
              variant=<code>{combo.variant}</code> · size=<code>{combo.size}</code>
            </span>
            <Combobox
              variant={combo.variant}
              size={combo.size}
              value={current}
              onValueChange={(v) => (comboboxValues[key] = v)}
              ariaLabel={`Combobox ${combo.variant} ${combo.size}`}
            >
              <ComboboxTrigger fullWidth ariaLabel="Pick an item">
                {active?.label ?? 'Pick…'}
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Search…" />
                {#each comboboxOptions as opt (opt.value)}
                  <ComboboxItem value={opt.value} label={opt.label} />
                {/each}
              </ComboboxContent>
            </Combobox>
          </div>
        {/each}
      </div>
    </Card>
  </section>

  <section>
    <h2>ScrollArea</h2>
    <Card>
      <p class="muted">
        Wraps bits-ui's ScrollArea — native scrollbar hidden, custom
        token-styled thumb. Used by the map-chat message list.
      </p>
      <div class="scroll-demo">
        <ScrollArea class="scroll-demo-area">
          <div class="scroll-demo-content">
            {#each Array.from({ length: 24 }, (_, i) => i) as i (i)}
              <p>Scrollable row {i + 1}</p>
            {/each}
          </div>
        </ScrollArea>
      </div>
    </Card>
  </section>

  <section>
    <h2>FloatingWindow</h2>
    <Card>
      <p class="muted">
        A dockable, floatable, resizable window shell (RFC-035) — hand-rolled per
        rule 24 (no upstream draggable+resizable window primitive exists; see the
        rule-24-bits-ui note in the component). Drag the header to float it; drag
        it back near the right edge to re-dock, or use the pin icon. While
        floating, grab any of the 4 edges (top/right/bottom/left, one axis each)
        or any of the 4 corners (two axes at once, e.g. dragging the bottom-right
        corner resizes width and height together) to resize, standard-window
        style; while docked only the left edge is wired (width only — docked
        height is full-height by design). Geometry persists in localStorage
        across reloads.
      </p>
      <div class="row gap-md">
        <Button
          variant="primary"
          onclick={() => (floatingDemoOpen = true)}
          disabled={floatingDemoOpen}
        >
          Open demo window
        </Button>
      </div>
      {#if floatingDemoOpen}
        <FloatingWindow
          storageKey="playground-demo"
          ariaLabel="Playground demo window"
          onClose={() => (floatingDemoOpen = false)}
        >
          {#snippet header()}
            <span class="fw-demo-title">Demo window</span>
          {/snippet}
          <div class="fw-demo-body">
            <p>Drag me by the header. Resize from any edge or corner. Dock/undock via the pin icon.</p>
            <p class="muted">Geometry persists in localStorage across reloads.</p>
          </div>
        </FloatingWindow>
      {/if}
    </Card>
  </section>
</div>

<Toaster position="bottom-right" />

<style>
  .playground {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 16px 80px;
    font-family: var(--font-sans);
    color: var(--fg-1);
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .page-header h1 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 600;
  }

  .muted {
    color: var(--fg-3);
    margin: 4px 0 0;
    font-size: 12px;
  }

  section h2 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-1);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .row.gap-md {
    gap: 16px;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
  }

  .vsep {
    height: 24px;
    display: flex;
  }

  .inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    color: var(--fg-1);
    font-size: 12px;
  }

  code {
    font-family: var(--font-mono);
    background: var(--bg-2);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 11px;
  }

  .cb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin-top: 12px;
  }

  .cb-tile {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px dashed var(--line);
    border-radius: 4px;
  }

  .cb-tile-label {
    color: var(--fg-3);
    font-size: 11px;
  }

  .fw-demo-title {
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 12.5px;
    color: var(--fg-1);
  }

  .fw-demo-body {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12.5px;
    color: var(--fg-2);
  }
</style>
