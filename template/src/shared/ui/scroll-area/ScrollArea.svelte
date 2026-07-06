<script lang="ts">
  /**
   * ScrollArea — token-styled wrapper over bits-ui's ScrollArea (rule 24: a
   * shared/ui-class primitive, not something upper layers hand-roll). Hides
   * the native scrollbar and renders a custom vertical thumb using
   * `--line-2`/`--line-3`/`--fg-3` so it stays correct in both themes for
   * free, the same way every other primitive reads tokens instead of
   * hardcoding colors. `viewportRef` is exposed so a caller (e.g. a chat
   * message list) can read `scrollTop`/`scrollHeight` and call `scrollTo`
   * directly on the real scrolling element.
   */
  import type { Snippet } from 'svelte';
  import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';

  interface Props {
    class?: string;
    viewportClass?: string;
    /** `type="hover"` (bits-ui default) shows the scrollbar on hover/scroll
     * only — matches the rest of the app's subtle-scrollbar convention. */
    type?: 'hover' | 'scroll' | 'auto' | 'always';
    viewportRef?: HTMLDivElement | null;
    onViewportScroll?: (event: Event) => void;
    children?: Snippet;
  }

  let {
    class: className,
    viewportClass,
    type = 'hover',
    viewportRef = $bindable(null),
    onViewportScroll,
    children,
  }: Props = $props();
</script>

<ScrollAreaPrimitive.Root class="scroll-area {className ?? ''}" {type}>
  <ScrollAreaPrimitive.Viewport
    bind:ref={viewportRef}
    class="scroll-area-viewport {viewportClass ?? ''}"
    onscroll={onViewportScroll}
  >
    {@render children?.()}
  </ScrollAreaPrimitive.Viewport>
  <ScrollAreaPrimitive.Scrollbar orientation="vertical" class="scroll-area-scrollbar">
    <ScrollAreaPrimitive.Thumb class="scroll-area-thumb" />
  </ScrollAreaPrimitive.Scrollbar>
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>

<style>
  :global(.scroll-area) {
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }

  :global(.scroll-area-viewport) {
    width: 100%;
    height: 100%;
  }

  :global(.scroll-area-scrollbar) {
    display: flex;
    user-select: none;
    touch-action: none;
    padding: 2px;
    width: 10px;
    background: transparent;
    transition: background 120ms ease;
  }

  :global(.scroll-area-scrollbar:hover) {
    background: var(--bg-2);
  }

  :global(.scroll-area-thumb) {
    flex: 1;
    position: relative;
    background: var(--line-3);
    border-radius: 999px;
  }

  :global(.scroll-area-scrollbar:hover .scroll-area-thumb) {
    background: var(--fg-3);
  }

  /* Larger invisible hit target than the visible thumb, same touch-target
   * generosity as the rest of the catalogue's compact controls. */
  :global(.scroll-area-thumb::before) {
    content: '';
    position: absolute;
    inset: -6px;
  }
</style>
