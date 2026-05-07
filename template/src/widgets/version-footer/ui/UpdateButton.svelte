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
    variant="ghost-mono"
    size="sm"
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

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent);
    flex-shrink: 0;
  }

  .label {
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
  }
</style>
