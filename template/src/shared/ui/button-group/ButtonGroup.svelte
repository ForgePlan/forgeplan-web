<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  type Orientation = 'horizontal' | 'vertical';

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
    orientation?: Orientation;
    attached?: boolean;
    children?: Snippet;
  }

  let {
    orientation = 'horizontal',
    attached = true,
    class: className,
    children,
    ...rest
  }: Props = $props();
</script>

<div
  role="group"
  class="button-group orient-{orientation} {attached ? 'attached' : 'spaced'} {className ?? ''}"
  {...rest}
>
  {@render children?.()}
</div>

<style>
  .button-group {
    display: inline-flex;
    align-items: stretch;
  }

  .orient-horizontal {
    flex-direction: row;
  }

  .orient-vertical {
    flex-direction: column;
  }

  .attached.orient-horizontal :global(> *:not(:first-child)) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    margin-left: -1px;
  }

  .attached.orient-horizontal :global(> *:not(:last-child)) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .attached.orient-vertical :global(> *:not(:first-child)) {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    margin-top: -1px;
  }

  .attached.orient-vertical :global(> *:not(:last-child)) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .attached :global(> *:hover),
  .attached :global(> *:focus-visible) {
    z-index: 1;
  }

  .spaced.orient-horizontal {
    gap: 6px;
  }

  .spaced.orient-vertical {
    gap: 6px;
  }
</style>
