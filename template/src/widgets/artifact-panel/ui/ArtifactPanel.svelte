<script lang="ts">
  import {
    fetchArtifact,
    kindLabel,
    kindLabelColor,
    statusRing,
    NodeRef,
    type ArtifactDetail
  } from '@/entities/artifact';
  import type { GraphEdge } from '@/entities/graph';
  import { nodeHover, setImpactRoot, highlight } from '@/entities/graph';
  import { reffTone } from '@/entities/score';
  import { buildMarkdownSummary } from '../lib/markdown-export';

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
  let bodyExpanded = $state(true);
  let bodyHydrated = $state(false);
  let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;
  let renderFn = $state<((s: string) => string) | null>(null);

  // Sticky stack: each section pins at top:var(--header-h) when scrolled to;
  // later sections (higher z-index) cover earlier ones. metaScrolledPast
  // toggles the meta-trail (depth + updated_at) into body-actions.
  let panelEl = $state<HTMLElement | undefined>();
  let headerEl = $state<HTMLElement | undefined>();
  let bodyActionsEl = $state<HTMLElement | undefined>();
  let headerH = $state(64);
  let metaScrolledPast = $state(false);

  function onPanelScroll() {
    if (!panelEl || !bodyActionsEl) return;
    // Body-actions becomes the active sticky when its natural top reaches
    // the sticky line (panel.scrollTop + headerH). At that moment we surface
    // the meta-trail on its right side.
    metaScrolledPast = panelEl.scrollTop + headerH + 8 >= bodyActionsEl.offsetTop;
  }

  $effect(() => {
    if (!headerEl) return;
    const measure = () => {
      headerH = headerEl!.offsetHeight;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(headerEl);
    return () => ro.disconnect();
  });
  $effect(() => {
    if (bodyExpanded && !renderFn) {
      import('../lib/markdown-renderer').then((m) => { renderFn = m.renderBody; });
    }
  });

  async function writeToClipboard(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // TODO(clipboard-fallback): non-secure contexts (http://) lack navigator.clipboard.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand('copy');
      if (!ok) throw new Error('execCommand copy failed');
    } finally {
      document.body.removeChild(ta);
    }
  }

  async function copyAsMarkdown() {
    if (!detail) return;
    const md = buildMarkdownSummary(detail, outgoing, incoming);
    try {
      await writeToClipboard(md);
      copyState = 'copied';
    } catch {
      copyState = 'failed';
    }
    if (copyResetTimer) clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      copyState = 'idle';
    }, 2000);
  }

  $effect(() => {
    const v = localStorage.getItem('forgeplan-web.bodyExpanded');
    if (v === '0') bodyExpanded = false;
    else if (v === '1') bodyExpanded = true;
    bodyHydrated = true;
  });
  $effect(() => {
    if (!bodyHydrated) return;
    localStorage.setItem('forgeplan-web.bodyExpanded', bodyExpanded ? '1' : '0');
  });

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

<aside
  class="panel"
  bind:this={panelEl}
  onscroll={onPanelScroll}
  style:--header-h={`${headerH}px`}
>
  <header bind:this={headerEl}>
    <button class="close" type="button" onclick={() => onClose?.()} aria-label="Close">
      <span aria-hidden="true">×</span>
    </button>
    <div class="hd">
      <span class="id" use:nodeHover={id} style:color={detail ? kindLabelColor(detail.kind) : 'var(--fg)'}>{id}</span>
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
    <div class="impact-actions sticky-row">
      <button
        type="button"
        class="ghost"
        data-action="show-downstream"
        title="Highlight artifacts that depend on this one (consumers)"
        onclick={() => setImpactRoot(detail!.id, 'down')}
      >Show downstream</button>
      <button
        type="button"
        class="ghost"
        data-action="show-upstream"
        title="Highlight artifacts this one depends on (sources)"
        onclick={() => setImpactRoot(detail!.id, 'up')}
      >Show upstream</button>
      {#if highlight.impactRoot}
        <button
          type="button"
          class="ghost"
          data-action="clear-impact"
          onclick={() => setImpactRoot(null)}
        >Clear</button>
      {/if}
    </div>

    {#if detail.depth || detail.parent_epic || detail.valid_until || detail.updated_at}
      <dl class="meta sticky-row">
        {#if detail.depth}<dt>depth</dt><dd>{detail.depth}</dd>{/if}
        {#if detail.parent_epic}<dt>epic</dt><dd><NodeRef id={detail.parent_epic} onSelect={(next) => onNavigate?.({ id: next })} /></dd>{/if}
        {#if detail.valid_until}<dt>valid until</dt><dd>{detail.valid_until}</dd>{/if}
        {#if detail.updated_at}<dt>updated</dt><dd>{new Date(detail.updated_at).toLocaleString()}</dd>{/if}
      </dl>
    {/if}

    {#if outgoing.length || incoming.length}
      <section class="links sticky-row">
        {#if outgoing.length}
          <h3 class="fp-eyebrow">Outgoing</h3>
          <ul>
            {#each outgoing as e (e.from + e.to + e.relation)}
              <li>
                <span class="rel">{e.relation}</span>
                <NodeRef id={e.to} onSelect={(next) => onNavigate?.({ id: next })} />
              </li>
            {/each}
          </ul>
        {/if}
        {#if incoming.length}
          <h3 class="fp-eyebrow">Incoming</h3>
          <ul>
            {#each incoming as e (e.from + e.to + e.relation)}
              <li>
                <NodeRef id={e.from} onSelect={(next) => onNavigate?.({ id: next })} />
                <span class="rel">{e.relation}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    {#if detail.body}
      <section class="body">
        <div class="body-actions sticky-row" bind:this={bodyActionsEl}>
          <button
            type="button"
            class="ghost"
            data-action="toggle-body"
            aria-expanded={bodyExpanded}
            onclick={() => bodyExpanded = !bodyExpanded}
          >{bodyExpanded ? '− Hide body' : '+ Show body'}</button>
          <button
            type="button"
            class="ghost copy-md"
            class:copied={copyState === 'copied'}
            class:failed={copyState === 'failed'}
            data-action="copy-markdown"
            onclick={copyAsMarkdown}
            title="Copy a markdown summary to clipboard for PR descriptions"
          >{copyState === 'copied' ? '✓ Copied' : copyState === 'failed' ? '✗ Copy failed' : '📋 Copy as markdown'}</button>
          <span class="meta-trail" class:visible={metaScrolledPast} aria-hidden="true">
            {#if detail.depth}
              <span class="trail-item"><span class="trail-key">depth</span> {detail.depth}</span>
            {/if}
            {#if detail.updated_at}
              <span class="trail-item"><span class="trail-key">upd</span> {new Date(detail.updated_at).toLocaleDateString()}</span>
            {/if}
          </span>
        </div>
        {#if bodyExpanded}
          {#if renderFn}
            <div class="artifact-body">
              {@html renderFn(detail.body)}
            </div>
          {:else}
            <div class="muted">loading…</div>
          {/if}
        {/if}
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
    z-index: 10;
  }

  /* Sticky stack: as the user scrolls, each section pins below the
     header (top: var(--header-h)) with a solid background and an
     escalating z-index. The later (downstream) section paints over
     the earlier one when both are pinned, giving a "previous block
     leaves" effect. The body-actions row is the last and stays
     pinned down to the body content. */
  .sticky-row {
    position: sticky;
    top: var(--header-h, 64px);
    background: var(--bg-1);
  }
  .impact-actions.sticky-row { z-index: 1; }
  .meta.sticky-row { z-index: 2; }
  .links.sticky-row { z-index: 3; }
  .body-actions.sticky-row { z-index: 4; border-bottom: 1px solid var(--line); }
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
  .body {
    padding: 12px 18px 28px;
    border-top: 1px solid var(--line);
    margin-top: 10px;
  }
  .artifact-body {
    margin-top: 12px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--line);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.55;
    color: var(--fg-1);
  }
  .artifact-body :global(h1),
  .artifact-body :global(h2),
  .artifact-body :global(h3) {
    font-size: 14px;
    margin: 14px 0 6px;
    color: var(--fg);
    letter-spacing: 0.02em;
  }
  .artifact-body :global(h4),
  .artifact-body :global(h5),
  .artifact-body :global(h6) {
    font-size: 13px;
    margin: 10px 0 4px;
    color: var(--fg-1);
  }
  .artifact-body :global(p) { margin: 8px 0; }
  .artifact-body :global(code) {
    background: var(--bg-2);
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 12px;
  }
  .artifact-body :global(pre) {
    background: var(--bg-2);
    padding: 8px 10px;
    border-radius: 2px;
    overflow-x: auto;
    margin: 8px 0;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .artifact-body :global(pre code) {
    background: transparent;
    padding: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .artifact-body :global(blockquote) {
    border-left: 2px solid var(--accent);
    padding-left: 10px;
    margin: 8px 0;
    color: var(--fg-2);
  }
  .artifact-body :global(table) {
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 12px;
  }
  .artifact-body :global(th),
  .artifact-body :global(td) {
    border: 1px solid var(--line);
    padding: 4px 8px;
  }
  .artifact-body :global(th) {
    background: var(--bg-2);
    font-weight: 500;
  }
  .artifact-body :global(hr) {
    border: none;
    border-top: 1px solid var(--line);
    margin: 14px 0;
  }
  .artifact-body :global(ul),
  .artifact-body :global(ol) {
    padding-left: 24px;
    margin: 8px 0;
  }
  .artifact-body :global(li) { margin: 2px 0; }
  .artifact-body :global(a) {
    color: var(--accent);
    text-decoration: none;
  }
  .artifact-body :global(a:hover) { text-decoration: underline; }
  .artifact-body :global(.raw-fallback) {
    color: var(--fg-3);
    font-style: italic;
  }

  .ghost {
    background: transparent;
    border: 1px solid var(--line-2);
    color: var(--fg-2);
    padding: 5px 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 120ms, color 120ms, transform 80ms;
    user-select: none;
  }
  .ghost:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .ghost:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-dim);
  }
  .ghost:active {
    transform: translateY(1px);
  }
  .ghost[aria-expanded="true"] {
    border-color: var(--accent);
    color: var(--accent);
  }

  .impact-actions {
    display: flex;
    gap: 6px;
    margin: 12px 18px 0;
    flex-wrap: wrap;
  }
  .body-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 6px 18px 6px;
    margin: 0;
  }
  /* Meta-trail: when the user scrolls past the meta block, depth and
     updated values fade-slide into the right side of the sticky
     body-actions row. Inert (aria-hidden) — the canonical meta block
     is still in DOM above. */
  .meta-trail {
    margin-left: auto;
    display: flex;
    gap: 10px;
    align-items: baseline;
    opacity: 0;
    transform: translateX(8px);
    transition: opacity 220ms ease-out, transform 220ms ease-out;
    pointer-events: none;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-2);
  }
  .meta-trail.visible {
    opacity: 1;
    transform: translateX(0);
  }
  .trail-item {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  .trail-key {
    color: var(--fg-3);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  @media (prefers-reduced-motion: reduce) {
    .meta-trail { transition: none; }
  }
  .copy-md.copied {
    color: var(--good);
    border-color: var(--good);
  }
  .copy-md.failed {
    color: var(--bad);
    border-color: var(--bad);
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
