<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title?: string;
    dismissOnScrim?: boolean;
    dismissOnEscape?: boolean;
    showClose?: boolean;
    width?: string;
    onclose?: () => void;
    body?: Snippet;
    footer?: Snippet;
    children?: Snippet;
  }

  let {
    open,
    title,
    dismissOnScrim = true,
    dismissOnEscape = true,
    showClose = true,
    width = '420px',
    onclose,
    body,
    footer,
    children,
  }: Props = $props();

  let dialogEl = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    const el = dialogEl;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  });

  function handleClose() {
    onclose?.();
  }

  function handleCancel(e: Event) {
    if (!dismissOnEscape) {
      e.preventDefault();
      return;
    }
    onclose?.();
  }

  function handleScrimMousedown(e: MouseEvent) {
    if (!dismissOnScrim) return;
    if (e.target === dialogEl) {
      onclose?.();
    }
  }
</script>

<dialog
  bind:this={dialogEl}
  class="dialog"
  style:--dialog-width={width}
  onclose={handleClose}
  oncancel={handleCancel}
  onmousedown={handleScrimMousedown}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions
       Stop scrim-mousedown from bubbling out of the panel — see PRD-013/RFC-012. -->
  <div
    class="panel"
    role="document"
    onmousedown={(e) => e.stopPropagation()}
  >
    {#if title || showClose}
      <header class="header">
        <h2 class="title">{title ?? ''}</h2>
        {#if showClose}
          <button
            type="button"
            class="close"
            aria-label="Close dialog"
            onclick={() => onclose?.()}
          >×</button>
        {/if}
      </header>
    {/if}
    <div class="body">
      {#if body}
        {@render body()}
      {:else if children}
        {@render children()}
      {/if}
    </div>
    {#if footer}
      <footer class="footer">
        {@render footer()}
      </footer>
    {/if}
  </div>
</dialog>

<style>
  .dialog {
    background: transparent;
    border: 0;
    padding: 0;
    color: var(--fg-1);
    max-width: 90vw;
    max-height: 90vh;
  }

  .dialog::backdrop {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
  }

  .panel {
    width: var(--dialog-width);
    max-width: 100%;
    background: var(--bg-1);
    border: 1px solid var(--line-2);
    border-radius: 4px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px 8px 14px;
    border-bottom: 1px solid var(--line);
  }
  .title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--fg);
  }
  .close {
    background: transparent;
    border: 0;
    color: var(--fg-3);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 2px;
  }
  .close:hover {
    color: var(--fg);
    background: var(--bg-2);
  }
  .close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .body {
    padding: 14px;
    overflow-y: auto;
    font-size: 13px;
    color: var(--fg-1);
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid var(--line);
    background: var(--bg);
  }
</style>
