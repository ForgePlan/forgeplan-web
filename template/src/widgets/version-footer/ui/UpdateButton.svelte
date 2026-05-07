<script lang="ts">
  import { Button } from '@/shared/ui';

  interface Props {
    current: string;
    latest: string;
    onclick: () => void;
  }

  let { current, latest, onclick }: Props = $props();
</script>

<div class="update-btn-pos">
  <Button
    variant="secondary"
    size="sm"
    class="update-btn"
    aria-label={`Update available: ${current} → ${latest}`}
    {onclick}
  >
    <span class="dot" aria-hidden="true"></span>
    <span class="label">Update</span>
    <span class="arrow" aria-hidden="true">→</span>
    <span class="version">v{latest}</span>
  </Button>
</div>

<style>
  .update-btn-pos {
    position: fixed;
    bottom: 32px;
    left: 10px;
    z-index: 50;
  }

  .update-btn-pos :global(.update-btn) {
    border-color: var(--accent-dim);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    padding: 3px 8px;
    height: auto;
  }

  .update-btn-pos :global(.update-btn:hover:not(:disabled)) {
    border-color: var(--accent);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent);
    flex-shrink: 0;
  }

  .label {
    text-transform: uppercase;
    color: var(--accent-soft);
    font-weight: 600;
  }

  .arrow {
    color: var(--fg-3);
  }

  .version {
    color: var(--fg-1);
  }

  @media (max-width: 640px) {
    .update-btn-pos {
      bottom: 26px;
      left: 6px;
    }
    .update-btn-pos :global(.update-btn) {
      font-size: 9px;
    }
  }
</style>
