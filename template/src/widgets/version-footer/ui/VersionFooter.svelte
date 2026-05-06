<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { ApiEnvelope } from '@/shared/api';
  import { modalManager } from '@/shared/services';
  import { updatePoller } from '../api/update-check.svelte';
  import UpdateButton from './UpdateButton.svelte';
  import UpdateDialog from './UpdateDialog.svelte';

  type VersionData = { web: string; cli: string | null };

  let web = $state<string | null>(null);
  let cli = $state<string | null>(null);
  let loaded = $state(false);

  onMount(async () => {
    updatePoller.start();
    try {
      const res = await fetch('/api/version');
      const env = (await res.json()) as ApiEnvelope<VersionData>;
      if (env.ok && env.data) {
        web = env.data.web;
        cli = env.data.cli;
      }
    } catch {
      // FIXME(network): /api/version unreachable — leaving placeholders.
    } finally {
      loaded = true;
    }
  });

  onDestroy(() => {
    updatePoller.stop();
  });

  const ariaLabel = $derived(
    `forgeplan-web version ${web ?? 'unknown'}, forgeplan CLI version ${cli ?? 'unknown'}`
  );

  const update = $derived(updatePoller.state.data);

  function openUpdateDialog() {
    if (!update?.hasUpdate || !update.latest) return;
    void modalManager.open(UpdateDialog, {
      current: update.current,
      latest: update.latest,
    });
  }
</script>

{#if update?.hasUpdate && update.latest}
  <UpdateButton current={update.current} latest={update.latest} onclick={openUpdateDialog} />
{/if}

{#if loaded}
  <span class="footer" aria-label={ariaLabel} role="contentinfo">
    <span class="seg">web v{web ?? '?'}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span class="seg">cli {cli ? `v${cli}` : '?'}</span>
  </span>
{/if}

<style>
  .footer {
    position: fixed;
    bottom: 8px;
    left: 10px;
    z-index: 50;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--fg-3);
    background: color-mix(in srgb, var(--bg) 80%, transparent);
    padding: 2px 6px;
    border: 1px solid var(--line-2);
    border-radius: 2px;
    pointer-events: none;
    user-select: none;
  }
  .seg {
    white-space: nowrap;
  }
  .dot {
    opacity: 0.6;
  }
  @media (max-width: 640px) {
    .footer {
      font-size: 9px;
      bottom: 6px;
      left: 6px;
    }
  }
</style>
