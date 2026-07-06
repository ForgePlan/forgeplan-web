<script lang="ts">
  import { tabsStore } from '@/entities/artifact-tabs';
  import { kindLabelColor, listPoller } from '@/entities/artifact';
  import { nodeHover } from '@/entities/graph';
  import { getNodeTab } from '@/widgets/composed-map/model/node-tabs.svelte';

  const ids = $derived(tabsStore.ids);
  const activeId = $derived(tabsStore.activeId);
  const kindById = $derived(
    new Map<string, string>((listPoller.state.data ?? []).map((a) => [a.id, a.kind]))
  );

  const NODE_TAB_PREFIX = 'node:';

  function tabLabel(id: string): string {
    if (!id.startsWith(NODE_TAB_PREFIX)) return id;
    const nodeId = id.slice(NODE_TAB_PREFIX.length);
    return getNodeTab(nodeId)?.node.label ?? id;
  }

  function activate(id: string) {
    tabsStore.setActive(id);
  }

  function close(e: MouseEvent, id: string) {
    e.stopPropagation();
    tabsStore.closeTab(id);
  }

  function onTabKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      tabsStore.closeTab(id);
    }
  }
</script>

{#if ids.length > 0}
  <div class="tabbar" role="tablist" aria-label="Open artifacts">
    {#each ids as id (id)}
      {@const kind = kindById.get(id) ?? null}
      {@const color = kind ? kindLabelColor(kind) : undefined}
      <div
        class="tab"
        class:active={id === activeId}
        role="tab"
        tabindex="0"
        aria-selected={id === activeId}
        use:nodeHover={id}
        onclick={() => activate(id)}
        onkeydown={(e) => onTabKeydown(e, id)}
      >
        <span class="id" style:color={color}>{id}</span>
        <button
          type="button"
          class="close"
          aria-label={`Close ${id}`}
          onclick={(e) => close(e, id)}
        >×</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .tabbar {
    display: flex;
    align-items: stretch;
    gap: 0;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
    overflow-x: auto;
    overflow-y: hidden;
    flex: 0 0 auto;
    min-height: 30px;
  }
  .tabbar::-webkit-scrollbar {
    height: 4px;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px 4px 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-2);
    cursor: pointer;
    border-right: 1px solid var(--line);
    border-bottom: 2px solid transparent;
    background: transparent;
    transition: background 120ms, border-color 120ms, color 120ms;
    user-select: none;
    white-space: nowrap;
  }
  .tab:hover,
  .tab:focus-visible {
    background: var(--bg-2);
    outline: none;
  }
  .tab.active {
    color: var(--fg);
    background: var(--bg);
    border-bottom-color: var(--accent);
  }
  .id {
    letter-spacing: 0.02em;
  }
  .close {
    background: transparent;
    border: 0;
    padding: 0 6px;
    margin: 0;
    color: var(--fg-3);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    border-radius: 2px;
    transition: background 120ms, color 120ms;
  }
  .close:hover,
  .close:focus-visible {
    background: var(--line-2);
    color: var(--fg);
    outline: none;
  }
</style>
