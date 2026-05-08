<script lang="ts">
  import { Slider as SliderPrimitive } from 'bits-ui';

  type Orientation = 'horizontal' | 'vertical';

  interface Props {
    value?: number[];
    onValueChange?: (next: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    orientation?: Orientation;
    ariaLabel?: string;
    id?: string;
    class?: string;
  }

  let {
    value = $bindable([0]),
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    orientation = 'horizontal',
    ariaLabel,
    id,
    class: className,
  }: Props = $props();
</script>

<SliderPrimitive.Root
  type="multiple"
  bind:value
  {onValueChange}
  {min}
  {max}
  {step}
  {disabled}
  {orientation}
  {id}
  class="slider orient-{orientation} {className ?? ''}"
>
  {#snippet children({ thumbs })}
    <SliderPrimitive.Range class="slider-range" />
    {#each thumbs as i (i)}
      <SliderPrimitive.Thumb index={i} class="slider-thumb" aria-label={ariaLabel} />
    {/each}
  {/snippet}
</SliderPrimitive.Root>

<style>
  :global(.slider) {
    position: relative;
    display: flex;
    align-items: center;
    user-select: none;
    touch-action: none;
  }

  :global(.slider.orient-horizontal) {
    width: 100%;
    height: 18px;
  }

  :global(.slider.orient-vertical) {
    flex-direction: column;
    height: 100%;
    width: 18px;
  }

  :global(.slider::before) {
    content: '';
    position: absolute;
    background: var(--bg-2);
    border-radius: 999px;
  }

  :global(.slider.orient-horizontal::before) {
    inset: 50% 0 auto 0;
    transform: translateY(-50%);
    height: 4px;
  }

  :global(.slider.orient-vertical::before) {
    inset: 0 50% 0 auto;
    transform: translateX(-50%);
    width: 4px;
  }

  :global(.slider-range) {
    position: absolute;
    background: var(--accent);
    border-radius: 999px;
  }

  :global(.slider.orient-horizontal .slider-range) {
    top: 50%;
    transform: translateY(-50%);
    height: 4px;
  }

  :global(.slider.orient-vertical .slider-range) {
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
  }

  :global(.slider-thumb) {
    display: block;
    width: 14px;
    height: 14px;
    background: var(--fg);
    border: 2px solid var(--accent);
    border-radius: 50%;
    cursor: grab;
    transition: box-shadow 120ms ease;
  }

  :global(.slider-thumb:active) {
    cursor: grabbing;
  }

  :global(.slider-thumb:focus-visible) {
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  :global(.slider[data-disabled]) {
    opacity: 0.5;
    pointer-events: none;
  }
</style>
