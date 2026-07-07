<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'ghost-mono' | 'magic';
  type Size = 'sm' | 'md' | 'icon';

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    variant?: Variant;
    size?: Size;
    children?: Snippet;
  }

  let {
    variant = 'secondary',
    size = 'md',
    type = 'button',
    class: className,
    children,
    ...rest
  }: Props = $props();
</script>

<button
  {type}
  class="btn variant-{variant} size-{size} {className ?? ''}"
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    font-family: var(--font-sans);
    font-weight: 500;
    letter-spacing: 0.01em;
    line-height: 1;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
    white-space: nowrap;
    user-select: none;
  }

  :global(.btn > svg) {
    display: flex;
    flex-shrink: 0;
  }

  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .size-sm {
    font-size: 11px;
    padding: 4px 8px;
    height: 22px;
  }

  .size-md {
    font-size: 12px;
    padding: 6px 12px;
    height: 28px;
  }

  .size-icon {
    width: 22px;
    height: 22px;
    padding: 0;
    font-size: 14px;
    line-height: 1;
  }

  .variant-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .variant-primary:hover:not(:disabled) {
    background: var(--accent-soft);
    border-color: var(--accent-soft);
  }

  .variant-secondary {
    background: var(--bg-2);
    border-color: var(--line-2);
    color: var(--fg-1);
  }
  .variant-secondary:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--line-3);
  }

  .variant-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--fg-2);
  }
  .variant-ghost:hover:not(:disabled) {
    background: var(--bg-2);
    color: var(--fg-1);
  }

  .variant-ghost-mono {
    background: transparent;
    border-color: var(--line-2);
    color: var(--fg-2);
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .variant-ghost-mono:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
    background: transparent;
  }
  .variant-ghost-mono:active {
    transform: translateY(1px);
  }
  .variant-ghost-mono[aria-expanded='true'] {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* `magic` — a deliberately theme-INDEPENDENT variant (unlike every other
     variant above, which reads --bg, --fg and --accent tokens). It is meant
     to read as "the AI/assistant action" at a glance in both light and dark
     — a fixed vivid rainbow gradient + white text carries its own contrast
     regardless of theme, which a token-driven background could not
     guarantee. Radius/padding/font/height still come from `.btn`/`.size-*`
     above (untouched) so it composes like every other variant (rule 24). */
  .variant-magic {
    position: relative;
    isolation: isolate;
    overflow: visible;
    border-color: transparent;
    color: #fff;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    background-image: linear-gradient(
      115deg,
      #ff5f6d,
      #ffc371,
      #f9f871,
      #6bf9a2,
      #47c9f9,
      #a76ff9,
      #f947d1,
      #ff5f6d
    );
    background-size: 300% 300%;
    background-position: 0% 50%;
    animation:
      btn-magic-shimmer 6s ease-in-out infinite,
      btn-magic-glow 2.4s ease-in-out infinite;
  }
  .variant-magic:hover:not(:disabled) {
    filter: brightness(1.08) saturate(1.1);
  }
  .variant-magic:active:not(:disabled) {
    transform: translateY(1px);
  }
  .variant-magic[aria-expanded='true'] {
    box-shadow:
      0 0 0 2px var(--accent-dim),
      0 0 14px 2px rgba(168, 85, 247, 0.55);
  }
  .variant-magic:disabled {
    animation: none;
    filter: grayscale(0.5) brightness(0.85);
  }

  /* Sparkle accents — pure CSS pseudo-elements, no extra DOM/markup. Two
     tiny stars twinkling out of phase so the effect never fully vanishes. */
  .variant-magic::before,
  .variant-magic::after {
    content: '✦';
    position: absolute;
    line-height: 1;
    color: #fff;
    text-shadow: 0 0 4px rgba(255, 255, 255, 0.9);
    pointer-events: none;
    animation: btn-magic-twinkle 1.8s ease-in-out infinite;
  }
  .variant-magic::before {
    top: -4px;
    right: 4px;
    font-size: 8px;
    animation-delay: 0s;
  }
  .variant-magic::after {
    bottom: -4px;
    left: 6px;
    font-size: 6px;
    animation-delay: 0.6s;
  }
  .variant-magic:disabled::before,
  .variant-magic:disabled::after {
    animation: none;
    opacity: 0.2;
  }

  @keyframes btn-magic-shimmer {
    0%,
    100% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
  }
  @keyframes btn-magic-glow {
    0%,
    100% {
      box-shadow:
        0 0 6px 0 rgba(168, 85, 247, 0.35),
        0 0 0 1px rgba(255, 255, 255, 0.12) inset;
    }
    50% {
      box-shadow:
        0 0 14px 2px rgba(168, 85, 247, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    }
  }
  @keyframes btn-magic-twinkle {
    0%,
    100% {
      opacity: 0.2;
      transform: scale(0.6);
    }
    50% {
      opacity: 1;
      transform: scale(1.15);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .variant-magic,
    .variant-magic::before,
    .variant-magic::after {
      animation: none;
    }
    .variant-magic {
      background-position: 30% 50%;
      box-shadow:
        0 0 8px 0 rgba(168, 85, 247, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    }
    .variant-magic::before,
    .variant-magic::after {
      opacity: 0.85;
      transform: none;
    }
  }
</style>
