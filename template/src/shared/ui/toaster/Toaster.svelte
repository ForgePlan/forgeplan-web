<script lang="ts">
  import { Toaster as SonnerToaster } from 'svelte-sonner';

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
</script>

<SonnerToaster
  {position}
  closeButton
  duration={4500}
  visibleToasts={5}
  toastOptions={{
    classes: {
      toast: 'fp-toast',
      title: 'fp-toast-title',
      description: 'fp-toast-desc',
      closeButton: 'fp-toast-close',
    },
  }}
/>

<style>
  :global([data-sonner-toaster]) {
    --normal-bg: var(--bg-1);
    --normal-text: var(--fg-1);
    --normal-border: var(--line-2);
    --success-bg: var(--bg-1);
    --success-text: var(--fg-1);
    --success-border: var(--good);
    --error-bg: var(--bg-1);
    --error-text: var(--fg-1);
    --error-border: var(--bad);
    --warning-bg: var(--bg-1);
    --warning-text: var(--fg-1);
    --warning-border: var(--accent);
    --info-bg: var(--bg-1);
    --info-text: var(--fg-1);
    --info-border: var(--fg-2);
    --border-radius: 6px;
    --font-family: var(--font-sans);
  }

  :global([data-sonner-toaster] [data-sonner-toast].fp-toast) {
    box-shadow: var(--shadow-card);
    border-left-width: 3px;
    font-size: 12px;
  }

  :global([data-sonner-toaster] [data-sonner-toast][data-type='success'].fp-toast) {
    border-left-color: var(--good);
  }
  :global([data-sonner-toaster] [data-sonner-toast][data-type='error'].fp-toast) {
    border-left-color: var(--bad);
  }
  :global([data-sonner-toaster] [data-sonner-toast][data-type='warning'].fp-toast) {
    border-left-color: var(--accent);
  }
  :global([data-sonner-toaster] [data-sonner-toast][data-type='info'].fp-toast) {
    border-left-color: var(--fg-2);
  }

  :global([data-sonner-toaster] .fp-toast-title) {
    font-weight: 600;
  }

  :global([data-sonner-toaster] .fp-toast-desc) {
    color: var(--fg-2);
    line-height: 1.4;
  }

  :global([data-sonner-toaster] .fp-toast-close) {
    color: var(--fg-3);
    background: transparent;
    border: none;
  }
  :global([data-sonner-toaster] .fp-toast-close:hover) {
    color: var(--fg-1);
    background: var(--bg-2);
  }
</style>
