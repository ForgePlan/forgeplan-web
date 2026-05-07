<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import Info from '@lucide/svelte/icons/info';
  import CheckCircle2 from '@lucide/svelte/icons/circle-check';
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
  import AlertCircle from '@lucide/svelte/icons/circle-alert';

  type Variant = 'info' | 'success' | 'warning' | 'danger';
  type IconComponent = Component<{ size?: number | string; class?: string }>;

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
    variant?: Variant;
    title?: string;
    icon?: IconComponent | null;
    children?: Snippet;
  }

  let {
    variant = 'info',
    title,
    icon,
    class: className,
    children,
    ...rest
  }: Props = $props();

  const defaultIcon = $derived.by<IconComponent>(() => {
    switch (variant) {
      case 'success':
        return CheckCircle2;
      case 'warning':
        return AlertTriangle;
      case 'danger':
        return AlertCircle;
      default:
        return Info;
    }
  });

  const Icon = $derived(icon === null ? null : (icon ?? defaultIcon));
</script>

<div
  class="alert variant-{variant} {className ?? ''}"
  role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'}
  {...rest}
>
  {#if Icon}
    <Icon size={14} class="alert-icon" />
  {/if}
  <div class="alert-content">
    {#if title}
      <div class="alert-title">{title}</div>
    {/if}
    {#if children}
      <div class="alert-body">{@render children()}</div>
    {/if}
  </div>
</div>

<style>
  .alert {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    border: 1px solid transparent;
    border-radius: 6px;
    font-family: var(--font-sans);
    font-size: 12px;
    line-height: 1.4;
  }

  :global(.alert-icon) {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .alert-content {
    flex: 1;
    min-width: 0;
  }

  .alert-title {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .alert-body {
    color: inherit;
    opacity: 0.9;
  }

  .variant-info {
    background: var(--bg-2);
    border-color: var(--line-2);
    color: var(--fg-1);
  }

  .variant-success {
    background: var(--good-dim);
    border-color: var(--good);
    color: var(--good);
  }

  .variant-warning {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: var(--accent);
  }

  .variant-danger {
    background: rgba(239, 68, 68, 0.14);
    border-color: var(--bad);
    color: var(--bad);
  }
</style>
