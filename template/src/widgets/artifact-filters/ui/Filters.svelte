<script lang="ts">
  import { kindLabel, kindColor, statusRing } from '@/entities/artifact';
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui';

  let {
    kinds = [],
    statuses = [],
    kindFilter = $bindable(new Set<string>()),
    statusFilter = $bindable(new Set<string>())
  }: {
    kinds?: string[];
    statuses?: string[];
    kindFilter?: Set<string>;
    statusFilter?: Set<string>;
  } = $props();

  const kindValue = $derived([...kindFilter]);
  const statusValue = $derived([...statusFilter]);
</script>

<aside class="filters">
  <section>
    <h3 class="fp-eyebrow">Kind</h3>
    <ToggleGroup
      type="multiple"
      size="sm"
      value={kindValue}
      onValueChange={(next) => (kindFilter = new Set(next))}
      ariaLabel="Filter by kind"
      class="filter-group"
    >
      {#each kinds as k}
        <ToggleGroupItem value={k} ariaLabel={`Filter kind ${kindLabel(k)}`}>
          <span class="dot" style:background={kindColor(k)}></span>
          {kindLabel(k)}
        </ToggleGroupItem>
      {/each}
    </ToggleGroup>
  </section>
  <section>
    <h3 class="fp-eyebrow">Status</h3>
    <ToggleGroup
      type="multiple"
      size="sm"
      value={statusValue}
      onValueChange={(next) => (statusFilter = new Set(next))}
      ariaLabel="Filter by status"
      class="filter-group"
    >
      {#each statuses as s}
        <ToggleGroupItem value={s} ariaLabel={`Filter status ${s}`}>
          <span class="ring" style:border-color={statusRing(s)}></span>
          {s}
        </ToggleGroupItem>
      {/each}
    </ToggleGroup>
  </section>
  <section class="hint">
    Click chips to <em>show only</em> selected. Empty selection = show all.
  </section>
</aside>

<style>
  .filters {
    padding: 14px 14px 18px;
    border-right: 1px solid var(--line);
    background: var(--bg);
    color: var(--fg-1);
    font: 12px/1.45 var(--font-sans);
    overflow-y: auto;
  }
  section + section {
    margin-top: 18px;
  }
  h3 {
    margin: 0 0 8px;
  }
  :global(.filter-group) {
    flex-wrap: wrap;
  }
  :global(.filter-group .toggle-group-item) {
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .ring {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--line-3);
  }
  .hint {
    color: var(--fg-3);
    font-size: 11px;
    line-height: 1.45;
    font-family: var(--font-sans);
  }
  .hint em {
    color: var(--accent);
    font-style: normal;
  }
</style>
