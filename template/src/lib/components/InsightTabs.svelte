<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    logPoller,
    claimsPoller,
    blockedPoller,
    stalePoller,
    listPoller,
    healthPoller,
    scorePoller
  } from '$lib/stores/forgeplan';
  import { kindLabel, kindColor, kindLabelColor, statusRing, reffTone } from '$lib/theme';

  type Tab = 'recent' | 'agents' | 'blocked' | 'drafts' | 'health';

  export let activeTab: Tab = 'agents';

  const dispatch = createEventDispatcher<{ select: { id: string } }>();

  const log = logPoller.store;
  const claims = claimsPoller.store;
  const blocked = blockedPoller.store;
  const stale = stalePoller.store;
  const list = listPoller.store;
  const health = healthPoller.store;
  const score = scorePoller.store;

  $: drafts = ($list.data ?? []).filter((a) => a.status.toLowerCase() === 'draft');
  $: scoreById = new Map<string, number>(($score.data ?? []).map((s) => [s.id, s.r_eff]));
  $: kindById = new Map<string, string>(($list.data ?? []).map((a) => [a.id, a.kind]));
  $: titleById = new Map<string, string>(($list.data ?? []).map((a) => [a.id, a.title]));

  const TABS: { key: Tab; label: string; badge: () => number | null }[] = [
    { key: 'recent', label: 'Recent', badge: () => $log.data?.entries?.length ?? null },
    { key: 'agents', label: 'Agents', badge: () => $claims.data?.count ?? null },
    { key: 'blocked', label: 'Blocked', badge: () => $blocked.data?.blocked_count ?? null },
    { key: 'drafts', label: 'Drafts', badge: () => drafts.length || null },
    { key: 'health', label: 'Health', badge: () => null }
  ];

  function relTime(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diff = Date.now() - t;
    const min = Math.floor(diff / 60_000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function relTimeFuture(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diff = t - Date.now();
    if (diff <= 0) return 'expired';
    const min = Math.ceil(diff / 60_000);
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    return `${h}h ${min % 60}m`;
  }

  function selectId(id: string) {
    dispatch('select', { id });
  }
</script>

<aside class="rail">
  <nav class="tabs">
    {#each TABS as t}
      <button
        type="button"
        class="tab"
        class:on={activeTab === t.key}
        on:click={() => (activeTab = t.key)}
      >
        <span>{t.label}</span>
        {#if t.badge() !== null && t.badge() !== 0}
          <span class="badge" class:warn={t.key === 'blocked' || t.key === 'drafts'}>
            {t.badge()}
          </span>
        {/if}
      </button>
    {/each}
  </nav>

  <div class="body">
    {#if activeTab === 'recent'}
      {#if $log.data?.entries?.length}
        <ul class="rows">
          {#each $log.data.entries.slice(0, 30) as e}
            <li class="row clickable" on:click={() => selectId(e.artifact_id)}>
              <span class="time">{relTime(e.timestamp)}</span>
              <span class="id" style:color={kindLabelColor(kindById.get(e.artifact_id) ?? '')}>{e.artifact_id}</span>
              <span class="action">{e.action}{e.field ? ` · ${e.field}` : ''}</span>
              {#if e.new_value}
                <span class="val" title={e.new_value}>{e.new_value}</span>
              {/if}
            </li>
          {/each}
        </ul>
      {:else if $log.loading}
        <p class="muted">loading…</p>
      {:else}
        <p class="muted">no recent changes</p>
      {/if}

    {:else if activeTab === 'agents'}
      {#if $claims.data?.claims?.length}
        <ul class="rows agents">
          {#each $claims.data.claims as c}
            <li class="row card clickable" on:click={() => selectId(c.id)}>
              <header>
                <span class="agent">
                  <span class="dot" />
                  {c.agent_id}
                </span>
                <span class="ttl" title="Expires {new Date(c.expires_at).toLocaleString()}">
                  ttl {relTimeFuture(c.expires_at)}
                </span>
              </header>
              <div class="hd">
                <span class="id strong" style:color={kindLabelColor(kindById.get(c.id) ?? '')}>{c.id}</span>
                {#if kindById.has(c.id)}
                  <span class="kind">{kindLabel(kindById.get(c.id) ?? '')}</span>
                {/if}
              </div>
              {#if titleById.has(c.id)}
                <p class="title">{titleById.get(c.id)}</p>
              {/if}
              {#if c.note}
                <p class="note">"{c.note}"</p>
              {/if}
              <small class="muted">claimed {relTime(c.claimed_at)}</small>
            </li>
          {/each}
        </ul>
      {:else if $claims.loading}
        <p class="muted">loading…</p>
      {:else}
        <div class="empty">
          <p>No active claims.</p>
          <p class="hint">
            Workspace is idle. Run <code>forgeplan dispatch --agents N</code> to plan parallel
            work, then <code>forgeplan claim &lt;ID&gt; --agent &lt;name&gt;</code>.
          </p>
        </div>
      {/if}

    {:else if activeTab === 'blocked'}
      {#if $blocked.data}
        {@const b = $blocked.data}
        <section class="kpis">
          <div class="kpi"><b>{b.blocked_count}</b><span>blocked</span></div>
          <div class="kpi"><b>{b.ready_count}</b><span>ready</span></div>
          {#if b.cycles?.length}
            <div class="kpi warn"><b>{b.cycles.length}</b><span>cycle{b.cycles.length === 1 ? '' : 's'}</span></div>
          {/if}
        </section>
        {#if b.blocked.length}
          <h4 class="fp-eyebrow">Blocked</h4>
          <ul class="rows">
            {#each b.blocked as item}
              <li class="row">
                <button type="button" class="link strong" on:click={() => selectId(item.id)}>
                  {item.id}
                </button>
                {#if item.reason}<span class="muted">— {item.reason}</span>{/if}
                {#if item.blocked_by?.length}
                  <span class="deps">
                    waits on
                    {#each item.blocked_by as dep, i}
                      {#if i > 0}, {/if}
                      <button type="button" class="link" on:click={() => selectId(dep)}>{dep}</button>
                    {/each}
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if b.cycles?.length}
          <h4 class="fp-eyebrow warn">Cycles</h4>
          <ul class="rows">
            {#each b.cycles as cycle, i}
              <li class="row">
                <span class="time">#{i + 1}</span>
                <span>
                  {#each cycle as id, j}
                    {#if j > 0} → {/if}
                    <button type="button" class="link" on:click={() => selectId(id)}>{id}</button>
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
        {#if b.ready.length}
          <h4 class="fp-eyebrow">Ready</h4>
          <ul class="rows compact">
            {#each b.ready as id}
              <li class="row">
                <button type="button" class="link" on:click={() => selectId(id)}>{id}</button>
                {#if titleById.has(id)}
                  <span class="muted">{titleById.get(id)}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if !b.blocked.length && !b.ready.length && !b.cycles?.length}
          <p class="muted">graph empty.</p>
        {/if}
      {:else if $blocked.loading}
        <p class="muted">loading…</p>
      {:else if $blocked.error}
        <p class="err">{$blocked.error}</p>
      {/if}

    {:else if activeTab === 'drafts'}
      {#if drafts.length}
        <ul class="rows">
          {#each drafts as a}
            <li class="row clickable" on:click={() => selectId(a.id)}>
              <span class="ring" style:border-color={statusRing(a.status)} />
              <span class="kind small">{kindLabel(a.kind)}</span>
              <button type="button" class="link strong" on:click|stopPropagation={() => selectId(a.id)}>
                {a.id}
              </button>
              <span class="muted clip">{a.title}</span>
            </li>
          {/each}
        </ul>
      {:else if $list.loading}
        <p class="muted">loading…</p>
      {:else}
        <p class="muted">no drafts.</p>
      {/if}

    {:else if activeTab === 'health'}
      {#if $health.data}
        {@const h = $health.data}
        <section class="kpis">
          <div class="kpi"><b>{h.total}</b><span>total</span></div>
          {#each h.by_status as s}
            <div class="kpi" class:warn={s.status === 'stale' || s.status === 'deprecated'}>
              <b>{s.count}</b><span>{s.status}</span>
            </div>
          {/each}
        </section>

        <h4 class="fp-eyebrow">By kind</h4>
        <ul class="rows compact">
          {#each h.by_kind as k}
            <li class="row">
              <span class="dot" style:background={kindColor(k.kind)} />
              <span class="strong">{kindLabel(k.kind)}</span>
              <span class="muted">{k.count}</span>
            </li>
          {/each}
        </ul>

        {#if h.by_derived_status?.length}
          <h4 class="fp-eyebrow">Lifecycle</h4>
          <ul class="rows compact">
            {#each h.by_derived_status as d}
              <li class="row"><span class="strong">{d.status}</span><span class="muted">{d.count}</span></li>
            {/each}
          </ul>
        {/if}

        {#if h.blind_spots?.length}
          <h4 class="fp-eyebrow warn">Blind spots ({h.blind_spots.length})</h4>
          <ul class="rows compact">
            {#each h.blind_spots as id}
              <li class="row">
                <button type="button" class="link warn" on:click={() => selectId(id)}>{id}</button>
                {#if titleById.has(id)}<span class="muted clip">{titleById.get(id)}</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}

        {#if h.orphans?.length}
          <h4 class="fp-eyebrow warn">Orphans ({h.orphans.length})</h4>
          <ul class="rows compact">
            {#each h.orphans as id}
              <li class="row"><button type="button" class="link warn" on:click={() => selectId(id)}>{id}</button></li>
            {/each}
          </ul>
        {/if}

        {#if $stale.data?.stale?.length}
          <h4 class="fp-eyebrow warn">Stale ({$stale.data.stale.length})</h4>
          <ul class="rows compact">
            {#each $stale.data.stale as s}
              <li class="row"><button type="button" class="link warn" on:click={() => selectId(s.id)}>{s.id}</button></li>
            {/each}
          </ul>
        {/if}

        {#if h.next_actions?.length}
          <h4 class="fp-eyebrow">Next actions</h4>
          <ul class="rows compact">
            {#each h.next_actions as msg}
              <li class="row"><span class="muted">{msg}</span></li>
            {/each}
          </ul>
        {/if}

        {#if scoreById.size > 0}
          <h4 class="fp-eyebrow">Lowest R_eff</h4>
          <ul class="rows compact scoring">
            {#each [...scoreById.entries()].sort((a, b) => a[1] - b[1]).slice(0, 5) as [id, reff]}
              {@const tone = reffTone(reff)}
              <li class="row scoring-row">
                <button type="button" class="link" on:click={() => selectId(id)}>{id}</button>
                <span class="bar fp-progress" class:warn={tone === 'warn'} class:bad={tone === 'bad'}>
                  <span style:width={`${Math.max(0, Math.min(1, reff)) * 100}%`}></span>
                </span>
                <span class="reff" class:warn={tone === 'warn'} class:bad={tone === 'bad'}>{reff.toFixed(2)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      {:else if $health.loading}
        <p class="muted">loading…</p>
      {/if}
    {/if}
  </div>
</aside>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    background: var(--bg);
    border-left: 1px solid var(--line);
    color: var(--fg-1);
    font: 12px/1.45 var(--font-sans);
    min-width: 0;
    min-height: 0;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    padding: 8px 8px 0;
    border-bottom: 1px solid var(--line);
    background: var(--bg-1);
  }
  .tab {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 7px 8px;
    border: 0;
    background: transparent;
    color: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    cursor: pointer;
    border-bottom: 1px solid transparent;
    white-space: nowrap;
    transition: color 120ms, border-color 120ms;
  }
  .tab:hover {
    color: var(--fg);
  }
  .tab.on {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .badge {
    background: var(--bg-2);
    color: var(--fg-1);
    border: 1px solid var(--line-2);
    padding: 0 6px;
    font: 10px var(--font-mono);
    min-width: 18px;
    text-align: center;
  }
  .badge.warn {
    color: var(--accent);
    border-color: var(--accent);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px 18px;
    min-height: 0;
  }
  h4 {
    margin: 16px 0 8px;
  }
  h4.warn {
    color: var(--accent);
  }
  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rows.compact {
    gap: 4px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    align-items: baseline;
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .row.clickable {
    cursor: pointer;
    padding: 4px 8px;
    margin: 0 -8px;
    border-left: 1px solid transparent;
    transition: background 120ms, border-color 120ms;
  }
  .row.clickable:hover {
    background: var(--bg-1);
    border-left-color: var(--accent);
  }
  .row.card {
    flex-direction: column;
    align-items: stretch;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    padding: 10px 12px 12px;
    gap: 6px;
    margin: 0;
  }
  .row.card:hover {
    border-color: var(--accent);
    background: var(--bg-1);
  }
  .row.card header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .row.card .hd {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .row.card .title {
    margin: 2px 0 0;
    font-family: var(--font-sans);
    color: var(--fg-1);
    font-size: 12px;
    line-height: 1.45;
  }
  .row.card .note {
    margin: 2px 0 0;
    color: var(--fg-3);
    font-style: italic;
    font-size: 11px;
  }
  .agent {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--fg);
    font-size: 11px;
  }
  .agent .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--good);
    box-shadow: 0 0 6px var(--good);
  }
  .ttl {
    color: var(--fg-3);
    font-size: 10px;
    letter-spacing: 0.04em;
  }
  .time {
    color: var(--fg-4);
    min-width: 60px;
  }
  .id,
  .strong {
    color: var(--fg);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .action {
    color: var(--fg-2);
  }
  .val {
    color: var(--accent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .deps {
    color: var(--fg-3);
  }
  .reff {
    color: var(--good);
    text-align: right;
    min-width: 40px;
  }
  .reff.warn {
    color: var(--accent);
  }
  .reff.bad {
    color: var(--bad);
  }
  .muted {
    color: var(--fg-3);
  }
  .clip {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    font-family: var(--font-sans);
    font-size: 11px;
  }
  .link {
    background: transparent;
    border: 0;
    padding: 0;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }
  .link:hover {
    text-decoration: underline;
  }
  .link.warn {
    color: var(--accent);
  }
  .err {
    color: var(--bad);
  }
  .empty {
    padding: 12px 4px;
  }
  .empty p {
    margin: 0 0 8px;
    color: var(--fg-2);
  }
  .empty .hint {
    color: var(--fg-3);
    font-size: 11px;
  }
  .empty code {
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    padding: 1px 6px;
    color: var(--fg-1);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .kpis {
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .kpi {
    flex: 1 1 70px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }
  .kpi b {
    font-size: 18px;
    color: var(--fg);
    font-family: var(--font-mono);
    line-height: 1.1;
  }
  .kpi span {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--fg-3);
    margin-top: 2px;
    font-family: var(--font-mono);
  }
  .kpi.warn {
    border-color: var(--accent);
  }
  .kpi.warn b {
    color: var(--accent);
  }
  .kind {
    border: 1px solid var(--line-2);
    padding: 0 6px;
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--fg-2);
  }
  .kind.small {
    font-size: 9px;
  }
  .ring {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--line-3);
    flex-shrink: 0;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .scoring-row {
    display: grid;
    grid-template-columns: 80px 1fr 44px;
    align-items: center;
    gap: 10px;
  }
  .scoring-row .bar {
    width: 100%;
  }
</style>
