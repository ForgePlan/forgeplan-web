<script lang="ts">
  interface Props {
    current: string;
    latest: string;
    onclick: () => void;
  }

  let { current, latest, onclick }: Props = $props();
</script>

<button
  type="button"
  class="update-btn"
  aria-label={`Update available: ${current} → ${latest}`}
  {onclick}
>
  <span class="dot" aria-hidden="true"></span>
  <span class="label">Update</span>
  <span class="arrow" aria-hidden="true">→</span>
  <span class="version">v{latest}</span>
</button>

<style>
  .update-btn {
    position: fixed;
    bottom: 32px;
    left: 10px;
    z-index: 50;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-2);
    border: 1px solid var(--accent-dim);
    border-radius: 2px;
    color: var(--fg-1);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    padding: 3px 8px;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .update-btn:hover {
    background: var(--bg-3);
    border-color: var(--accent);
    color: var(--fg);
  }

  .update-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
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
    .update-btn {
      bottom: 26px;
      left: 6px;
      font-size: 9px;
    }
  }
</style>
