<script module lang="ts">
  let magicStarInstanceCount = 0;
</script>

<script lang="ts">
  interface Props {
    size?: number;
    class?: string;
  }

  let { size = 20, class: className }: Props = $props();

  const gradientId = `magic-star-grad-${++magicStarInstanceCount}`;

  let reducedMotion = $state(false);

  $effect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });
</script>

<svg
  class="magic-star {className ?? ''}"
  width={size}
  height={size}
  viewBox="-1 -1 26 26"
  fill="none"
  role="img"
  aria-hidden="true"
>
  <defs>
    <linearGradient
      id={gradientId}
      x1="0"
      y1="0"
      x2="1"
      y2="1"
      gradientUnits="objectBoundingBox"
    >
      <stop offset="0%" stop-color="#5B8DEF" />
      <stop offset="20%" stop-color="#9D7BEA" />
      <stop offset="40%" stop-color="#FB7185" />
      <stop offset="60%" stop-color="#FBBF24" />
      <stop offset="80%" stop-color="#34D399" />
      <stop offset="100%" stop-color="#5B8DEF" />
      {#if !reducedMotion}
        <!-- Faster rotation (3s, was 6s) so the gradient's sweep across the
             sparkle's arms reads as an obvious blue→violet→rose→amber→
             emerald cycle rather than a near-static tint. -->
        <animateTransform
          attributeName="gradientTransform"
          type="rotate"
          from="0 0.5 0.5"
          to="360 0.5 0.5"
          dur="3s"
          repeatCount="indefinite"
        />
      {/if}
    </linearGradient>
  </defs>
  <!-- ✨ sparkles motif — one main four-pointed sparkle (concave-sided
       "twinkle", N/E/S/W long points) plus two small accent sparkles
       (top-right, bottom-left), all sharing the animated gradient stroke
       via the group's `stroke`. Geometry mirrors the widely-used
       Lucide "sparkles" icon shape. -->
  <g
    stroke="url(#{gradientId})"
    stroke-width="1.75"
    stroke-linejoin="round"
    stroke-linecap="round"
  >
    <path
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    />
    <path d="M20 3v4M22 5h-4" />
    <path d="M4 17v2M5 18H3" />
  </g>
</svg>

<style>
  /* The rotating gradientTransform (SMIL, above) sweeps color across the
     sparkle's arms; layered on top, a gentle CSS hue-rotate makes the
     color change unmistakable at a glance (belt-and-suspenders — the SMIL
     rotation alone reads too subtly on a shape this small). Both freeze
     under prefers-reduced-motion: the SMIL <animateTransform> is
     conditionally omitted above, and the CSS animation is disabled below.
     Tasteful pace (4s per hue cycle), not seizure-fast. */
  .magic-star {
    display: block;
    flex-shrink: 0;
    animation: magic-star-hue 4s linear infinite;
    filter:
      hue-rotate(0deg)
      drop-shadow(0 0 3px rgba(157, 123, 234, 0.55))
      drop-shadow(0 0 5px rgba(91, 141, 239, 0.3));
  }

  @keyframes magic-star-hue {
    0% {
      filter:
        hue-rotate(0deg)
        drop-shadow(0 0 3px rgba(157, 123, 234, 0.55))
        drop-shadow(0 0 5px rgba(91, 141, 239, 0.3));
    }
    100% {
      filter:
        hue-rotate(360deg)
        drop-shadow(0 0 3px rgba(157, 123, 234, 0.55))
        drop-shadow(0 0 5px rgba(91, 141, 239, 0.3));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .magic-star {
      animation: none;
      filter:
        drop-shadow(0 0 3px rgba(157, 123, 234, 0.55))
        drop-shadow(0 0 5px rgba(91, 141, 239, 0.3));
    }
  }
</style>
