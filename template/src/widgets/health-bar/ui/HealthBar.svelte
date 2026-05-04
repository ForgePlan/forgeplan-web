<script lang="ts">
  import { healthPoller } from '@/entities/health';

  const health = $derived(healthPoller.state.data);
  const lastUpdated = $derived(
    healthPoller.state.lastFetched
      ? new Date(healthPoller.state.lastFetched).toLocaleTimeString()
      : '—'
  );
</script>

<header class="bar">
  <div class="brand">
    <span class="logo" aria-label="Forgeplan">F<span class="o">O</span>RGEPLAN</span>
    {#if health}
      <span class="project">/ {health.project}</span>
    {/if}
  </div>
  <div class="stats">
    {#if health}
      <span class="stat"><b>{health.total}</b><span class="lbl">total</span></span>
      {#each health.by_status as s}
        <span class="stat status-{s.status}">{s.count} <span class="lbl">{s.status}</span></span>
      {/each}
      {#if health.stale_count > 0}
        <span class="stat warn">{health.stale_count} <span class="lbl">stale</span></span>
      {/if}
      {#if health.blind_spots.length > 0}
        <span class="stat warn">{health.blind_spots.length} <span class="lbl">blind</span></span>
      {/if}
    {:else if healthPoller.state.loading}
      <span class="stat muted">loading…</span>
    {:else if healthPoller.state.error}
      <span class="stat err" title={healthPoller.state.error}>error</span>
    {/if}
  </div>
  <div class="meta">
    <span class="muted">updated {lastUpdated}</span>
    <span class="pulse" class:on={healthPoller.state.loading}></span>
  </div>
</header>

<style>
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 12px 20px;
    background: rgba(5, 5, 5, 0.85);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
    color: var(--fg-1);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.02em;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }
  .logo {
    font-family: var(--font-mono);
    font-weight: 600;
    letter-spacing: 0.18em;
    font-size: 13px;
    color: var(--fg);
  }
  .logo .o {
    color: var(--accent);
  }
  .project {
    color: var(--fg-3);
    font-size: 11px;
    letter-spacing: 0.08em;
  }
  .stats {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .stat {
    border: 1px solid var(--line-2);
    padding: 3px 9px;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--fg-2);
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  .stat b {
    color: var(--fg);
    font-weight: 600;
  }
  .stat .lbl {
    color: var(--fg-3);
    text-transform: lowercase;
    font-size: 10.5px;
  }
  .status-active {
    border-color: var(--good);
    color: var(--good);
  }
  .status-active .lbl {
    color: var(--good);
    opacity: 0.7;
  }
  .status-draft {
    border-color: var(--accent);
    color: var(--accent);
  }
  .status-draft .lbl {
    color: var(--accent);
    opacity: 0.7;
  }
  .stat.warn {
    border-color: var(--accent);
    color: var(--accent);
  }
  .stat.warn .lbl {
    color: var(--accent);
    opacity: 0.7;
  }
  .stat.muted,
  .muted {
    color: var(--fg-3);
  }
  .stat.err {
    border-color: var(--bad);
    color: var(--bad);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: var(--fg-3);
  }
  .pulse {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--fg-4);
    transition: background 200ms, box-shadow 200ms;
  }
  .pulse.on {
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }
</style>
