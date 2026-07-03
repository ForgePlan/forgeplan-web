<script lang="ts">
  import type { MapFlow } from "@/entities/map";
  import { Button } from "@/shared/ui";

  let {
    flows,
    activeFlowId = null,
    onToggle,
  }: {
    flows: ReadonlyArray<MapFlow>;
    activeFlowId?: string | null;
    onToggle?: (id: string | null) => void;
  } = $props();
</script>

<div class="flow-chips">
  {#each flows as flow (flow.id)}
    <Button
      variant={flow.id === activeFlowId ? "primary" : "secondary"}
      size="sm"
      aria-pressed={flow.id === activeFlowId}
      onclick={() => onToggle?.(flow.id === activeFlowId ? null : flow.id)}
    >
      {flow.name}
    </Button>
  {/each}
</div>

<style>
  .flow-chips {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
</style>
