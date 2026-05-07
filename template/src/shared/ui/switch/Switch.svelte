<script lang="ts">
  import { Switch as SwitchPrimitive } from 'bits-ui';

  type Size = 'sm' | 'md';

  interface Props {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    name?: string;
    value?: string;
    ariaLabel?: string;
    size?: Size;
    id?: string;
    class?: string;
  }

  let {
    checked = $bindable(false),
    onCheckedChange,
    disabled = false,
    name,
    value,
    ariaLabel,
    size = 'md',
    id,
    class: className,
  }: Props = $props();
</script>

<SwitchPrimitive.Root
  bind:checked
  {onCheckedChange}
  {disabled}
  {name}
  {value}
  {id}
  aria-label={ariaLabel}
  class="switch size-{size} {className ?? ''}"
>
  <SwitchPrimitive.Thumb class="switch-thumb" />
</SwitchPrimitive.Root>

<style>
  :global(.switch) {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding: 2px;
    border: 1px solid var(--line-2);
    border-radius: 999px;
    background: var(--bg-2);
    cursor: pointer;
    transition:
      background 120ms ease,
      border-color 120ms ease;
    flex-shrink: 0;
  }

  :global(.switch.size-sm) {
    width: 28px;
    height: 16px;
  }

  :global(.switch.size-md) {
    width: 34px;
    height: 20px;
  }

  :global(.switch[data-state='checked']) {
    background: var(--accent);
    border-color: var(--accent);
  }

  :global(.switch[data-disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.switch:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  :global(.switch-thumb) {
    display: block;
    background: var(--fg);
    border-radius: 999px;
    transition: transform 140ms ease;
  }

  :global(.switch.size-sm .switch-thumb) {
    width: 10px;
    height: 10px;
  }

  :global(.switch.size-md .switch-thumb) {
    width: 14px;
    height: 14px;
  }

  :global(.switch[data-state='checked'] .switch-thumb) {
    background: var(--on-accent);
    transform: translateX(calc(100% + 2px));
  }
</style>
