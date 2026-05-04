<script lang="ts">
  import {
    fetchArtifact,
    kindLabel,
    kindLabelColor,
    statusRing,
    type ArtifactDetail
  } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import { reffTone } from '@/entities/score';

  let {
    id,
    edges = [],
    onClose,
    onNavigate
  }: {
    id: string;
    edges?: GraphEdge[];
    onClose?: () => void;
    onNavigate?: (detail: { id: string }) => void;
  } = $props();

  let detail = $state<ArtifactDetail | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let loadToken = 0;

  const outgoing = $derived(edges.filter((e) => e.from === id));
  const incoming = $derived(edges.filter((e) => e.to === id));

  $effect(() => {
    const target = id;
    const myToken = ++loadToken;
    loading = true;
    loadError = null;
    fetchArtifact(target)
      .then((next) => {
        if (myToken !== loadToken) return;
        detail = next;
        if (!next) loadError = 'not found';
      })
      .catch((err) => {
        if (myToken !== loadToken) return;
        loadError = (err as Error).message;
      })
      .finally(() => {
        if (myToken === loadToken) loading = false;
      });
  });
</script>

<aside class="panel">
  <header>
    <button class="close" type="button" onclick={() => onClose?.()} aria-label="Close">
      <span aria-hidden="true">×</span>
    </button>
    <div class="hd">
      <span class="id" style:color={detail ? kindLabelColor(detail.kind) : 'var(--fg)'}>{id}</span>
      {#if detail}
        <span class="kind">{kindLabel(detail.kind)}</span>
        <span class="status" style:color={statusRing(detail.status)}>{detail.status}</span>
        {#if detail.r_eff !== undefined}
          {@const tone = reffTone(detail.r_eff)}
          <span class="reff" class:warn={tone === 'warn'} class:bad={tone === 'bad'}
            title="R_eff (weakest-link evidence score)">
            R_eff {detail.r_eff.toFixed(2)}
          </span>
        {/if}
      {/if}
    </div>
    {#if detail}
      <h2>{detail.title}</h2>
    {/if}
  </header>

  {#if loading}
    <div class="muted">loading…</div>
  {:else if loadError}
    <div class="err">{loadError}</div>
  {:else if detail}
    {#if detail.depth || detail.parent_epic || detail.valid_until}
      <dl class="meta">
        {#if detail.depth}<dt>depth</dt><dd>{detail.depth}</dd>{/if}
        {#if detail.parent_epic}<dt>epic</dt><dd>{detail.parent_epic}</dd>{/if}
        {#if detail.valid_until}<dt>valid until</dt><dd>{detail.valid_until}</dd>{/if}
        {#if detail.updated_at}<dt>updated</dt><dd>{new Date(detail.updated_at).toLocaleString()}</dd>{/if}
      </dl>
    {/if}

    {#if outgoing.length || incoming.length}
      <section class="links">
        {#if outgoing.length}
          <h3 class="fp-eyebrow">Outgoing</h3>
          <ul>
            {#each outgoing as e (e.from + e.to + e.relation)}
              <li>
                <span class="rel">{e.relation}</span>
                <button type="button" class="ref" onclick={() => onNavigate?.({ id: e.to })}>{e.to}</button>
              </li>
            {/each}
          </ul>
        {/if}
        {#if incoming.length}
          <h3 class="fp-eyebrow">Incoming</h3>
          <ul>
            {#each incoming as e (e.from + e.to + e.relation)}
              <li>
                <button type="button" class="ref" onclick={() => onNavigate?.({ id: e.from })}>{e.from}</button>
                <span class="rel">{e.relation}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    {#if detail.body}
      <section class="body">
        <pre>{detail.body}</pre>
      </section>
    {/if}
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
    position: sticky;
    top: 0;
    background: var(--bg-1);
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--line);
    z-index: 1;
  }
  .close {
    position: absolute;
    top: 10px;
    right: 12px;
    background: transparent;
    border: 0;
    color: var(--fg-3);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }
  .close:hover {
    color: var(--accent);
  }
  .hd {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .id {
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .kind {
    border: 1px solid var(--line-2);
    padding: 1px 7px;
    color: var(--fg-2);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .status {
    font-size: 11px;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .reff {
    color: var(--good);
    font-size: 11px;
    letter-spacing: 0.04em;
  }
  .reff.warn {
    color: var(--accent);
  }
  .reff.bad {
    color: var(--bad);
  }
  h2 {
    margin: 10px 0 0;
    font-size: 16px;
    font-weight: 500;
    color: var(--fg);
    line-height: 1.3;
    letter-spacing: -0.01em;
  }
  .meta {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 12px;
    row-gap: 3px;
    margin: 14px 18px;
    font-family: var(--font-mono);
    font-size: 11px;
  }
  dt {
    color: var(--fg-3);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 10px;
  }
  dd {
    margin: 0;
    color: var(--fg-1);
  }
  .links {
    padding: 0 18px 8px;
  }
  .links h3 {
    margin: 14px 0 6px;
  }
  .links ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .links li {
    display: flex;
    gap: 10px;
    align-items: baseline;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .rel {
    color: var(--fg-3);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .ref {
    background: transparent;
    border: 0;
    padding: 0;
    color: var(--accent);
    cursor: pointer;
    font: inherit;
  }
  .ref:hover {
    text-decoration: underline;
  }
  .body {
    padding: 12px 18px 28px;
    border-top: 1px solid var(--line);
    margin-top: 10px;
  }
  .body pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font: 12px/1.6 var(--font-mono);
    color: var(--fg-1);
  }
  .muted {
    color: var(--fg-3);
    padding: 16px 18px;
    font-family: var(--font-mono);
  }
  .err {
    color: var(--bad);
    padding: 16px 18px;
    font-family: var(--font-mono);
  }
</style>
