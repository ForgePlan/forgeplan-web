<script lang="ts">
  import {
    kindLabel,
    kindColor,
    statusRing,
    type ArtifactKind,
    type ArtifactStatus
  } from '@/entities/artifact';
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui';

  interface Props {
    kinds?: ArtifactKind[];
    statuses?: ArtifactStatus[];
    kindFilter?: Set<ArtifactKind>;
    statusFilter?: Set<ArtifactStatus>;
  }

  let {
    kinds = [],
    statuses = [],
    kindFilter = $bindable(new Set<ArtifactKind>()),
    statusFilter = $bindable(new Set<ArtifactStatus>())
  }: Props = $props();

  const kindValue = $derived([...kindFilter]);
  const statusValue = $derived([...statusFilter]);
</script>

<aside class="filters">
  <section>
    <h3 class="fp-eyebrow">Kind</h3>
    <ToggleGroup
      type="multiple"
      size="sm"
      variant="outline-mono"
      value={kindValue}
      onValueChange={(next) => (kindFilter = new Set(next as ArtifactKind[]))}
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
      variant="outline-mono"
      value={statusValue}
      onValueChange={(next) => (statusFilter = new Set(next as ArtifactStatus[]))}
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
  /* layout-only — composing primitives, not re-skinning them */
  :global(.filter-group) {
    flex-wrap: wrap;
    gap: 6px;
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
