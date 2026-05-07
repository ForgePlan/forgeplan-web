<script lang="ts">
  import { kindLabel, kindColor, statusRing } from '@/entities/artifact';
  import { Toggle } from '@/shared/ui';

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

  function setKind(key: string, pressed: boolean) {
    const next = new Set(kindFilter);
    if (pressed) next.add(key);
    else next.delete(key);
    kindFilter = next;
  }

  function setStatus(key: string, pressed: boolean) {
    const next = new Set(statusFilter);
    if (pressed) next.add(key);
    else next.delete(key);
    statusFilter = next;
  }
</script>

<aside class="filters">
  <section>
    <h3 class="fp-eyebrow">Kind</h3>
    <div class="row">
      {#each kinds as k}
        <Toggle
          variant="outline"
          size="sm"
          pressed={kindFilter.has(k)}
          onPressedChange={(p) => setKind(k, p)}
          ariaLabel={`Filter kind ${kindLabel(k)}`}
          class="filter-chip"
        >
          <span class="dot" style:background={kindColor(k)}></span>
          {kindLabel(k)}
        </Toggle>
      {/each}
    </div>
  </section>
  <section>
    <h3 class="fp-eyebrow">Status</h3>
    <div class="row">
      {#each statuses as s}
        <Toggle
          variant="outline"
          size="sm"
          pressed={statusFilter.has(s)}
          onPressedChange={(p) => setStatus(s, p)}
          ariaLabel={`Filter status ${s}`}
          class="filter-chip"
        >
          <span class="ring" style:border-color={statusRing(s)}></span>
          {s}
        </Toggle>
      {/each}
    </div>
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
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .row :global(.filter-chip) {
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
