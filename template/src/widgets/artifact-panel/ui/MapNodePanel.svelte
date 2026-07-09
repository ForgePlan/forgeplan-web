<script lang="ts">
  import { kindColor } from '@/entities/artifact';
  import { tabsStore } from '@/entities/artifact-tabs';
  import { getNodeTab } from '@/widgets/composed-map/model/node-tabs.svelte';
  import { Badge, Button } from '@/shared/ui';

  let { nodeId }: { nodeId: string } = $props();

  const snapshot = $derived(getNodeTab(nodeId));
  const node = $derived(snapshot?.node ?? null);
  const connections = $derived(snapshot?.connections ?? []);
  const outgoing = $derived(connections.filter((c) => c.dir === 'out'));
  const incoming = $derived(connections.filter((c) => c.dir === 'in'));

  function openArtifactTab(): void {
    if (node?.artifact_id) tabsStore.openTab(node.artifact_id);
  }
</script>

<aside class="panel">
  {#if !node}
    <div class="muted">No data recorded for this node — reopen it from the map.</div>
  {:else}
    <header>
      <div class="hd">
        <span class="label" style:color={kindColor(node.kind)}>{node.label}</span>
        <Badge variant="mono" size="sm">{node.kind}</Badge>
      </div>
      {#if node.meta}<p class="meta-line">{node.meta}</p>{/if}
    </header>

    <section class="narrative">
      {#if node.description_ru}
        <p class="description">{node.description_ru}</p>
      {:else}
        <p class="no-narration">Нарратив недоступен — у этого модуля нет doc-источника.</p>
      {/if}
    </section>

    {#if node.provenance?.ref}
      <dl class="source-meta">
        <dt>source</dt>
        <dd><code>{node.provenance.ref}</code></dd>
      </dl>
    {/if}

    {#if node.artifact_id}
      <div class="artifact-affordance">
        <Button variant="ghost-mono" size="sm" onclick={openArtifactTab}>
          Open {node.artifact_id}
        </Button>
      </div>
    {/if}

    <section class="connections">
      <span class="fp-eyebrow">Connections</span>
      {#if outgoing.length === 0 && incoming.length === 0}
        <p class="muted no-connections">No connections recorded.</p>
      {:else}
        <ul>
          {#each outgoing as c, i (i)}
            <li class="out">
              <span class="arrow" aria-hidden="true">→</span>
              {c.label}
              <span class="rel">({c.relation})</span>
            </li>
          {/each}
          {#each incoming as c, i (i)}
            <li class="in">
              <span class="arrow" aria-hidden="true">←</span>
              {c.label}
              <span class="rel">({c.relation})</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</aside>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    border-left: 1px solid var(--line);
    color: var(--fg-1);
    font: 13px/1.5 var(--font-sans);
    overflow-y: auto;
  }
  header {
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--line);
  }
  .hd {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .label {
    font-weight: 600;
    font-size: 15px;
    letter-spacing: -0.01em;
  }
  .meta-line {
    margin: 8px 0 0;
    color: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .narrative {
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
  }
  .description {
    margin: 0;
    color: var(--fg-1);
  }
  .no-narration {
    margin: 0;
    color: var(--fg-3);
    font-style: italic;
  }
  .source-meta {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 12px;
    margin: 14px 18px;
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .source-meta dt {
    color: var(--fg-3);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 10px;
  }
  .source-meta dd {
    margin: 0;
    color: var(--fg-1);
    word-break: break-all;
  }
  .artifact-affordance {
    padding: 0 18px 8px;
  }
  .connections {
    padding: 12px 18px 24px;
  }
  .connections ul {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .connections li {
    display: flex;
    gap: 6px;
    align-items: baseline;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .arrow {
    color: var(--fg-3);
  }
  .rel {
    color: var(--fg-3);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .no-connections {
    padding: 0;
    margin: 8px 0 0;
  }
  .muted {
    color: var(--fg-3);
    padding: 16px 18px;
    font-family: var(--font-mono);
  }
</style>
