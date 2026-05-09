<script lang="ts">
  import { untrack } from 'svelte';
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
  import { Badge, Button, Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/shared/ui';
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
    onNavigate?: (detail: { id: string; event?: Event }) => void;
  } = $props();

  let detail = $state<ArtifactDetail | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let loadToken = 0;
  let bodyExpanded = $state(true);
  let bodyHydrated = $state(false);
  let outgoingExpanded = $state(true);
  let incomingExpanded = $state(true);
  const LINK_COLLAPSE_THRESHOLD = 8;
  let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
  let copyResetTimer: ReturnType<typeof setTimeout> | undefined;
  let renderFn = $state<((s: string) => string) | null>(null);

  // Sticky stack: each section pins at top:var(--header-h) when scrolled to.
  // Only ONE block is sticky at any moment — earlier ones get
  // `position: static` once a later block has reached the sticky line, so a
  // shorter active block doesn't leave the taller previous block visible
  // underneath. metaScrolledPast toggles the meta-trail in body-actions.
  let panelEl = $state<HTMLElement | undefined>();
  let headerEl = $state<HTMLElement | undefined>();
  let impactEl = $state<HTMLElement | undefined>();
  let metaEl = $state<HTMLElement | undefined>();
  let linksEl = $state<HTMLElement | undefined>();
  let bodyActionsEl = $state<HTMLElement | undefined>();
  let headerH = $state(64);
  let activeStickyKey = $state<'' | 'impact' | 'meta' | 'links' | 'body-actions'>('');
  let metaScrolledPast = $state(false);

  const STICKY_ORDER = ['impact', 'meta', 'links', 'body-actions'] as const;

  function isPassed(key: typeof STICKY_ORDER[number]): boolean {
    if (!activeStickyKey) return false;
    return STICKY_ORDER.indexOf(key) < STICKY_ORDER.indexOf(activeStickyKey);
  }

  function onPanelScroll() {
    if (!panelEl) return;
    const threshold = panelEl.scrollTop + headerH + 1;
    let active: typeof activeStickyKey = '';
    if (impactEl && impactEl.offsetTop <= threshold) active = 'impact';
    if (metaEl && metaEl.offsetTop <= threshold) active = 'meta';
    if (linksEl && linksEl.offsetTop <= threshold) active = 'links';
    if (bodyActionsEl && bodyActionsEl.offsetTop <= threshold) active = 'body-actions';
    activeStickyKey = active;
    metaScrolledPast = active === 'body-actions';
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
    try {
      ta.select();
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

  // Auto-collapse long edge lists on first arrival of a new artifact.
  // Tracking via a $effect keyed on `id` only — outgoing/incoming length
  // reads must be untracked so the 10s poll (which re-derives identical
  // arrays with new references) doesn't silently undo user toggles.
  $effect(() => {
    void id;
    outgoingExpanded = untrack(() => outgoing.length) <= LINK_COLLAPSE_THRESHOLD;
    incomingExpanded = untrack(() => incoming.length) <= LINK_COLLAPSE_THRESHOLD;
  });

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
    <Button
      variant="ghost"
      size="icon"
      class="close-pos"
      onclick={() => onClose?.()}
      aria-label="Close"
    >
      <span aria-hidden="true">×</span>
    </Button>
    <div class="hd">
      <span class="id" use:nodeHover={id} style:color={detail ? kindLabelColor(detail.kind) : 'var(--fg)'}>{id}</span>
      {#if detail}
        <Badge variant="mono" size="sm">{kindLabel(detail.kind)}</Badge>
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
    <div class="impact-actions sticky-row" class:passed={isPassed('impact')} bind:this={impactEl}>
      <Button
        variant="ghost-mono"
        size="sm"
        data-action="show-downstream"
        title="Highlight artifacts that depend on this one (consumers)"
        onclick={() => setImpactRoot(detail!.id, 'down')}
      >Show downstream</Button>
      <Button
        variant="ghost-mono"
        size="sm"
        data-action="show-upstream"
        title="Highlight artifacts this one depends on (sources)"
        onclick={() => setImpactRoot(detail!.id, 'up')}
      >Show upstream</Button>
      {#if highlight.impactRoot}
        <Button
          variant="ghost-mono"
          size="sm"
          data-action="clear-impact"
          onclick={() => setImpactRoot(null)}
        >Clear</Button>
      {/if}
    </div>

    {#if detail.depth || detail.parent_epic || detail.valid_until || detail.updated_at}
      <dl class="meta sticky-row" class:passed={isPassed('meta')} bind:this={metaEl}>
        {#if detail.depth}<dt>depth</dt><dd>{detail.depth}</dd>{/if}
        {#if detail.parent_epic}<dt>epic</dt><dd><NodeRef id={detail.parent_epic} onSelect={(next, ev) => onNavigate?.({ id: next, event: ev })} /></dd>{/if}
        {#if detail.valid_until}<dt>valid until</dt><dd>{detail.valid_until}</dd>{/if}
        {#if detail.updated_at}<dt>updated</dt><dd>{new Date(detail.updated_at).toLocaleString()}</dd>{/if}
      </dl>
    {/if}

    {#if outgoing.length || incoming.length}
      <section class="links sticky-row" class:passed={isPassed('links')} bind:this={linksEl}>
        {#if outgoing.length}
          <Collapsible bind:open={outgoingExpanded}>
            <CollapsibleTrigger class="links-toggle">
              <span class="fp-eyebrow">Outgoing</span>
              <span class="links-count">{outgoing.length}</span>
              <span class="links-chevron" aria-hidden="true">{outgoingExpanded ? '−' : '+'}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul>
                {#each outgoing as e (e.from + e.to + e.relation)}
                  <li>
                    <span class="rel">{e.relation}</span>
                    <NodeRef id={e.to} onSelect={(next, ev) => onNavigate?.({ id: next, event: ev })} />
                  </li>
                {/each}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        {/if}
        {#if incoming.length}
          <Collapsible bind:open={incomingExpanded}>
            <CollapsibleTrigger class="links-toggle">
              <span class="fp-eyebrow">Incoming</span>
              <span class="links-count">{incoming.length}</span>
              <span class="links-chevron" aria-hidden="true">{incomingExpanded ? '−' : '+'}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul>
                {#each incoming as e (e.from + e.to + e.relation)}
                  <li>
                    <NodeRef id={e.from} onSelect={(next, ev) => onNavigate?.({ id: next, event: ev })} />
                    <span class="rel">{e.relation}</span>
                  </li>
                {/each}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        {/if}
      </section>
    {/if}

    {#if detail.body}
      <section class="body">
        <div class="body-actions sticky-row" class:passed={isPassed('body-actions')} bind:this={bodyActionsEl}>
          <Button
            variant="ghost-mono"
            size="sm"
            data-action="toggle-body"
            aria-expanded={bodyExpanded}
            onclick={() => bodyExpanded = !bodyExpanded}
          >{bodyExpanded ? '− Hide body' : '+ Show body'}</Button>
          <Button
            variant="ghost-mono"
            size="sm"
            class={`copy-md ${copyState === 'copied' ? 'copied' : copyState === 'failed' ? 'failed' : ''}`}
            data-action="copy-markdown"
            onclick={copyAsMarkdown}
            title="Copy a markdown summary to clipboard for PR descriptions"
          >{copyState === 'copied' ? '✓ Copied' : copyState === 'failed' ? '✗ Copy failed' : '📋 Copy as markdown'}</Button>
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

  /* Sticky stack: each section pins below the header at
     top: var(--header-h) with a solid background. JS state
     activeStickyKey tracks which row is *currently* the active sticky;
     earlier rows get class .passed → position: static so they scroll
     away with the rest of content. This guarantees only ONE block
     occupies the sticky line at any moment (otherwise a shorter
     active block would leave the taller previous one visible
     underneath because both would be pinned at the same top:). */
  .sticky-row {
    position: sticky;
    top: var(--header-h, 64px);
    background: var(--bg-1);
    z-index: 1;
  }
  .sticky-row.passed {
    position: static;
  }
  .body-actions.sticky-row {
    border-bottom: 1px solid var(--line);
  }
  header :global(.close-pos) {
    position: absolute;
    top: 10px;
    right: 12px;
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
  /* layout-only — composes the Collapsible primitive's trigger.
     Class is forwarded onto the bits-ui-rendered <button> root, so
     rule 24 layout-vs-skin: this only sets size/spacing, not chrome. */
  :global(.links-toggle) {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 12px 0 6px;
    margin: 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  :global(.links-toggle:hover .fp-eyebrow) {
    color: var(--accent-soft);
  }
  :global(.links-toggle:hover .links-chevron) {
    color: var(--accent);
  }
  .links-count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-3);
    font-variant-numeric: tabular-nums;
  }
  .links-chevron {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--fg-3);
    line-height: 1;
    width: 12px;
    text-align: center;
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
  :global(.copy-md.copied) {
    color: var(--good);
    border-color: var(--good);
  }
  :global(.copy-md.failed) {
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
