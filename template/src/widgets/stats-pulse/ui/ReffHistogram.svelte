<script lang="ts">
  import { Tooltip } from "@/shared/ui";
  import { motionDuration } from "@/widgets/dependency-graph/lib/reduced-motion";
  import type { HistogramBucket } from "../lib/pulse-stats";
  import type { Interpretation } from "../lib/interpret";

  let {
    buckets,
    interpretation,
    onSelectBucket,
  }: {
    buckets: HistogramBucket[];
    interpretation: Interpretation;
    onSelectBucket?: (bucket: HistogramBucket) => void;
  } = $props();

  const W = 280;
  const H = 130;
  const PAD_L = 26;
  const PAD_B = 22;
  const PAD_T = 8;
  const PAD_R = 6;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const max = $derived(Math.max(1, ...buckets.map((b) => b.count)));
  const barW = $derived(plotW / buckets.length);
  const animMs = motionDuration(280);

  function barColor(lo: number): string {
    if (lo >= 0.7) return "var(--good)";
    if (lo >= 0.4) return "var(--accent)";
    return "var(--bad)";
  }
  function barX(i: number): number {
    return PAD_L + i * barW;
  }
  function barH(count: number): number {
    return (count / max) * plotH;
  }
  function barY(count: number): number {
    return PAD_T + plotH - barH(count);
  }
  function label(b: HistogramBucket): string {
    return `R_eff ${b.lo.toFixed(1)}–${b.hi.toFixed(1)}: ${b.count} artifact(s)`;
  }
</script>

<figure class="chart" style="--anim:{animMs}ms">
  <figcaption class="head">
    <Tooltip
      label="Distribution of R_eff across evidenced artifacts. Higher buckets (≥0.7) mean stronger evidence."
    >
      <h4 class="title">R_eff distribution</h4>
    </Tooltip>
    <span
      class="status status-{interpretation.tone}"
      data-test="chart-status"
      title={interpretation.copy}
    >
      <span class="status-icon" aria-hidden="true">{interpretation.icon}</span>
    </span>
  </figcaption>

  <svg
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label="R_eff distribution histogram across {buckets.length} buckets"
    data-test="stats-r_eff"
    preserveAspectRatio="xMidYMid meet"
  >
    <!-- gridline at top -->
    <line
      x1={PAD_L}
      y1={PAD_T}
      x2={W - PAD_R}
      y2={PAD_T}
      class="grid"
    />
    <line
      x1={PAD_L}
      y1={PAD_T + plotH}
      x2={W - PAD_R}
      y2={PAD_T + plotH}
      class="axis"
    />
    <text x={PAD_L - 6} y={PAD_T + 4} class="tick" text-anchor="end">{max}</text>
    <text
      x={PAD_L - 6}
      y={PAD_T + plotH}
      class="tick"
      text-anchor="end">0</text
    >
    {#each buckets as b, i (i)}
      {@const h = barH(b.count)}
      {@const interactive = b.count > 0 && !!onSelectBucket}
      <g
        class="bar"
        class:clickable={interactive}
        role="button"
        tabindex="0"
        aria-label={label(b)}
        onclick={() => interactive && onSelectBucket?.(b)}
        onkeydown={(e) => {
          if (interactive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelectBucket?.(b);
          }
        }}
      >
        <title>{label(b)}</title>
        <rect
          x={barX(i) + 1.5}
          y={barY(b.count)}
          width={Math.max(0, barW - 3)}
          height={h}
          fill={barColor(b.lo)}
          class="bar-rect"
        />
        {#if i % 2 === 0}
          <text
            x={barX(i) + barW / 2}
            y={H - 8}
            class="xtick"
            text-anchor="middle">{b.lo.toFixed(1)}</text
          >
        {/if}
      </g>
    {/each}
  </svg>
  <p class="caption" data-test="chart-caption">
    Buckets of R_eff (0–1) for evidenced artifacts only. Unscored artifacts are
    not shown.
  </p>
</figure>

<style>
  .chart {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-2);
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    line-height: 1;
  }
  .status-icon {
    font-size: 13px;
  }
  .status-good {
    color: var(--good);
  }
  .status-warn {
    color: var(--accent);
  }
  .status-bad {
    color: var(--bad);
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .grid {
    stroke: var(--line-2);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
  .axis {
    stroke: var(--line-2);
    stroke-width: 1;
  }
  .tick,
  .xtick {
    fill: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 8px;
  }
  .bar-rect {
    transition: height var(--anim) ease, y var(--anim) ease;
  }
  .bar.clickable {
    cursor: pointer;
  }
  .bar.clickable:hover .bar-rect {
    opacity: 0.82;
  }
  .bar:focus-visible {
    outline: none;
  }
  .bar:focus-visible .bar-rect {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .caption {
    margin: 0;
    font-size: 10px;
    color: var(--fg-3);
    line-height: 1.4;
  }
</style>
