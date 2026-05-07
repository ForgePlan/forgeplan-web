<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { toaster } from './toaster-store.svelte';

  type Position =
    | 'top-left'
    | 'top-right'
    | 'top-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'bottom-center';

  interface Props {
    position?: Position;
  }

  let { position = 'bottom-right' }: Props = $props();

  const items = $derived(toaster.toasts);
</script>

<div class="toaster pos-{position}" aria-live="polite" aria-atomic="false">
  {#each items as t (t.id)}
    <div class="toast variant-{t.variant}" role={t.variant === 'danger' ? 'alert' : 'status'}>
      <div class="toast-body">
        {#if t.title}
          <div class="toast-title">{t.title}</div>
        {/if}
        {#if t.description}
          <div class="toast-desc">{t.description}</div>
        {/if}
      </div>
      <button
        type="button"
        class="toast-dismiss"
        aria-label="Dismiss"
        onclick={() => toaster.dismiss(t.id)}
      >
        <X size={12} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    pointer-events: none;
    z-index: 1200;
    max-width: min(420px, calc(100vw - 32px));
  }

  .pos-top-left {
    top: 0;
    left: 0;
  }
  .pos-top-right {
    top: 0;
    right: 0;
  }
  .pos-top-center {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
  }
  .pos-bottom-left {
    bottom: 0;
    left: 0;
  }
  .pos-bottom-right {
    bottom: 0;
    right: 0;
  }
  .pos-bottom-center {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-left: 3px solid var(--accent);
    border-radius: 6px;
    padding: 10px 12px;
    box-shadow: var(--shadow-card);
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--fg-1);
    animation: toast-in 200ms ease;
    max-width: 100%;
  }

  .variant-info {
    border-left-color: var(--fg-2);
  }
  .variant-success {
    border-left-color: var(--good);
  }
  .variant-warning {
    border-left-color: var(--accent);
  }
  .variant-danger {
    border-left-color: var(--bad);
  }

  .toast-body {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .toast-desc {
    color: var(--fg-2);
    line-height: 1.4;
    word-break: break-word;
  }

  .toast-dismiss {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--fg-3);
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    line-height: 0;
  }

  .toast-dismiss:hover {
    color: var(--fg-1);
    background: var(--bg-2);
  }

  .toast-dismiss:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
