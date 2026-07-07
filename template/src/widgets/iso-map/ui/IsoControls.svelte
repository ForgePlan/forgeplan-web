<script lang="ts">
  // TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
  // entities on graduation (see .claude/rules/10-comments-policy.md).
  //
  // Bottom-right control cluster: the depthWindow accordion (1/2/3) +
  // ascend. All state lives in model/iso-view-state.svelte.ts (SRP) — this
  // component only renders shared/ui <Button> instances and forwards
  // clicks up (ISP: it knows nothing about levelStack/planes/animation).
  // Rule 24: composes the shared/ui primitive only, no re-skinning — the
  // only CSS here is the wrapper's own position/layout.
  import { Button } from '@/shared/ui';

  const DEPTH_OPTIONS = [1, 2, 3] as const;

  let {
    depthWindow,
    onDepthWindowChange,
    canAscend,
    onAscend,
  }: {
    depthWindow: 1 | 2 | 3;
    onDepthWindowChange: (n: 1 | 2 | 3) => void;
    canAscend: boolean;
    onAscend: () => void;
  } = $props();
</script>

<div class="iso-controls">
  <div class="depth-group" role="group" aria-label="Visible depth layers">
    {#each DEPTH_OPTIONS as n (n)}
      <Button
        variant={depthWindow === n ? 'primary' : 'ghost'}
        size="sm"
        aria-pressed={depthWindow === n}
        onclick={() => onDepthWindowChange(n)}
      >
        {n}
      </Button>
    {/each}
  </div>
  <Button variant="secondary" size="sm" disabled={!canAscend} onclick={onAscend}>
    ascend ⬆
  </Button>
</div>

<style>
  .iso-controls {
    position: absolute;
    right: 16px;
    bottom: 16px;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--bg-1);
    border: 1px solid var(--line, var(--fg-4));
    border-radius: 8px;
  }

  .depth-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>
