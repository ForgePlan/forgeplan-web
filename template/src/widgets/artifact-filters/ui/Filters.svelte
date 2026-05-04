<script lang="ts">
  import { kindLabel, kindColor, statusRing } from '@/entities/artifact';

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

  function toggle(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }
</script>

<aside class="filters">
  <section>
    <h3 class="fp-eyebrow">Kind</h3>
    <div class="row">
      {#each kinds as k}
        <button
          type="button"
          class="chip"
          class:on={kindFilter.has(k)}
          onclick={() => (kindFilter = toggle(kindFilter, k))}
        >
          <span class="dot" style:background={kindColor(k)}></span>
          {kindLabel(k)}
        </button>
      {/each}
    </div>
  </section>
  <section>
    <h3 class="fp-eyebrow">Status</h3>
    <div class="row">
      {#each statuses as s}
        <button
          type="button"
          class="chip"
          class:on={statusFilter.has(s)}
          onclick={() => (statusFilter = toggle(statusFilter, s))}
        >
          <span class="ring" style:border-color={statusRing(s)}></span>
          {s}
        </button>
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
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    color: var(--fg-2);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: border-color 120ms, color 120ms;
  }
  .chip:hover {
    border-color: var(--line-3);
    color: var(--fg);
  }
  .chip.on {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--bg);
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
