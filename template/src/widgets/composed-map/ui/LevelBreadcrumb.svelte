<script lang="ts">
  /**
   * LevelBreadcrumb — RFC-031 Phase 4. Renders the drill-down trail
   * root -> ... -> current and climbs back on crumb click. Composes
   * `shared/ui` primitives only (rule 24) — no primitive re-skinning, layout
   * CSS only on this file's own wrapper markup.
   */
  import { Button } from "@/shared/ui";
  import type { LevelFrame } from "../model/drill-state";

  let {
    stack,
    onCrumb,
    labelFor,
  }: {
    stack: readonly LevelFrame[];
    onCrumb: (index: number) => void;
    labelFor: (focusId: string | null) => string;
  } = $props();
</script>

{#if stack.length > 1}
  <nav class="breadcrumb" aria-label="Map drill-down path">
    <ol class="crumb-list">
      {#each stack as frame, i (frame.focusId ?? "root")}
        <li class="crumb-item">
          {#if i > 0}
            <span class="crumb-sep" aria-hidden="true">›</span>
          {/if}
          {#if i === stack.length - 1}
            <span class="crumb-current" aria-current="page"
              >{labelFor(frame.focusId)}</span
            >
          {:else}
            <Button variant="ghost" size="sm" onclick={() => onCrumb(i)}>
              {labelFor(frame.focusId)}
            </Button>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}

<style>
  /* Positioning + our own wrapper's motion only (rule 24) — the crumbs
     themselves are shared/ui Button instances, unmodified. */
  .breadcrumb {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 3;
    max-width: 60%;
    transition: opacity 160ms ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .breadcrumb {
      transition: none;
    }
  }

  .crumb-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 2px;
    flex-wrap: wrap;
  }

  .crumb-item {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }

  .crumb-sep {
    color: var(--fg-4);
    font-size: 12px;
    padding: 0 2px;
  }

  .crumb-current {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-2);
    padding: 4px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
