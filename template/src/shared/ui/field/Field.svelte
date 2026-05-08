<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id?: string;
    label?: string;
    required?: boolean;
    optional?: boolean;
    helper?: string;
    error?: string;
    children?: Snippet<[{ id: string; describedBy: string | undefined; invalid: boolean }]>;
    class?: string;
  }

  let {
    id,
    label,
    required = false,
    optional = false,
    helper,
    error,
    class: className,
    children,
  }: Props = $props();

  const inputId = $derived(id ?? `field-${Math.random().toString(36).slice(2, 8)}`);
  const helperId = $derived(`${inputId}-helper`);
  const errorId = $derived(`${inputId}-error`);
  const invalid = $derived(Boolean(error));
  const describedBy = $derived(
    [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(' ') || undefined,
  );
</script>

<div class="field {className ?? ''}">
  {#if label}
    <label class="field-label" for={inputId}>
      <span>{label}</span>
      {#if required}
        <span class="field-required" aria-label="required">*</span>
      {:else if optional}
        <span class="field-optional">(optional)</span>
      {/if}
    </label>
  {/if}
  <div class="field-control">
    {@render children?.({ id: inputId, describedBy, invalid })}
  </div>
  {#if error}
    <p class="field-error" id={errorId} role="alert">{error}</p>
  {:else if helper}
    <p class="field-helper" id={helperId}>{helper}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--font-sans);
  }

  .field-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    color: var(--fg-2);
    user-select: none;
  }

  .field-required {
    color: var(--bad);
    font-weight: 600;
  }

  .field-optional {
    color: var(--fg-3);
    font-weight: 400;
    font-size: 10px;
  }

  .field-control {
    display: flex;
    width: 100%;
  }

  .field-helper {
    margin: 0;
    font-size: 10px;
    color: var(--fg-3);
    line-height: 1.3;
  }

  .field-error {
    margin: 0;
    font-size: 10px;
    color: var(--bad);
    line-height: 1.3;
  }
</style>
