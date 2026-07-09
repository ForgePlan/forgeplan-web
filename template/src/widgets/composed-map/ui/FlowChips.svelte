<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MapFlow } from "@/entities/map";
  import { Button } from "@/shared/ui";

  const CHIP_LABEL_MAX = 24;

  function truncateLabel(name: string): string {
    return name.length > CHIP_LABEL_MAX
      ? `${name.slice(0, CHIP_LABEL_MAX).trimEnd()}…`
      : name;
  }

  let {
    flows,
    activeFlowId = null,
    onToggle,
    leading,
  }: {
    flows: ReadonlyArray<MapFlow>;
    activeFlowId?: string | null;
    onToggle?: (id: string | null) => void;
    /** Optional leading slot rendered BEFORE the "All" chip (e.g. the
     * compact star chat launcher). Renders even when `flows.length === 0`
     * — see the guard below — so a caller's launcher is never hidden on a
     * flow-less map/level. */
    leading?: Snippet;
  } = $props();
</script>

{#if flows.length > 0 || leading}
  <div class="flow-chips">
    {@render leading?.()}
    {#if flows.length > 0}
      <Button
        variant={activeFlowId === null ? "primary" : "secondary"}
        size="sm"
        aria-pressed={activeFlowId === null}
        onclick={() => onToggle?.(null)}>All</Button
      >
      {#each flows as flow (flow.id)}
        <Button
          variant={flow.id === activeFlowId ? "primary" : "secondary"}
          size="sm"
          aria-pressed={flow.id === activeFlowId}
          title={flow.name}
          onclick={() => onToggle?.(flow.id === activeFlowId ? null : flow.id)}
        >
          {truncateLabel(flow.name)}
        </Button>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .flow-chips {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: 72%;
    z-index: 3;
  }
</style>
