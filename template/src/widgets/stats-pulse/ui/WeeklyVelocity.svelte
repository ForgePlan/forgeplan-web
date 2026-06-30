<script lang="ts">
  import { Tooltip } from "@/shared/ui";
  import { motionDuration } from "@/widgets/dependency-graph/lib/reduced-motion";
  import type { WeekVelocity } from "../lib/pulse-stats";
  import type { Interpretation } from "../lib/interpret";

  let {
    weeks,
    interpretation,
  }: {
    weeks: WeekVelocity[];
    interpretation: Interpretation;
  } = $props();

  const W = 280;
  const H = 130;
  const PAD_L = 26;
  const PAD_B = 22;
  const PAD_T = 10;
  const PAD_R = 8;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const animMs = motionDuration(280);

  const maxAbs = $derived(
    Math.max(1, ...weeks.map((w) => Math.abs(w.net))),
  );
  const zeroY = $derived(PAD_T + plotH / 2);

  function pointX(i: number): number {
    if (weeks.length <= 1) return PAD_L + plotW / 2;
    return PAD_L + (i / (weeks.length - 1)) * plotW;
  }
  function pointY(net: number): number {
    return zeroY - (net / maxAbs) * (plotH / 2);
  }
  const linePoints = $derived(
    weeks.map((w, i) => `${pointX(i)},${pointY(w.net)}`).join(" "),
  );
  const areaPath = $derived(
    weeks.length === 0
      ? ""
      : `M ${pointX(0)},${zeroY} ` +
        weeks.map((w, i) => `L ${pointX(i)},${pointY(w.net)}`).join(" ") +
        ` L ${pointX(weeks.length - 1)},${zeroY} Z`,
  );

  function label(w: WeekVelocity): string {
    return `Week of ${w.week}: net ${w.net >= 0 ? "+" : ""}${w.net} (${w.activated} activated, ${w.deprecated} retired, ${w.draftsAdded} drafts added)`;
  }
</script>

<figure class="chart" style="--anim:{animMs}ms">
  <figcaption class="head">
    <Tooltip
      label="Net weekly flow = activations + retirements − new drafts. Above the zero line means the workspace advanced that week."
    >
      <h4 class="title">Weekly velocity</h4>
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
    aria-label="Weekly net velocity over {weeks.length} weeks"
    data-test="stats-velocity"
    preserveAspectRatio="xMidYMid meet"
  >
    {#if weeks.length === 0}
      <text x={W / 2} y={H / 2} class="empty" text-anchor="middle">no activity</text>
    {:else}
      <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} class="zero" />
      <text x={PAD_L - 6} y={PAD_T + 4} class="tick" text-anchor="end"
        >+{maxAbs}</text
      >
      <text x={PAD_L - 6} y={PAD_T + plotH} class="tick" text-anchor="end"
        >−{maxAbs}</text
      >
      <path d={areaPath} class="area" />
      <polyline points={linePoints} class="line" />
      {#each weeks as w, i (w.weekStartMs)}
        <g class="dot" role="img" aria-label={label(w)}>
          <title>{label(w)}</title>
          <circle
            cx={pointX(i)}
            cy={pointY(w.net)}
            r="3"
            class:pos={w.net > 0}
            class:neg={w.net < 0}
          />
        </g>
      {/each}
    {/if}
  </svg>
  <p class="caption" data-test="chart-caption">
    Net artifacts progressed per week from the activity log. Last
    {weeks.length} week(s).
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
  .zero {
    stroke: var(--line-2);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
  .area {
    fill: var(--accent-dim);
    stroke: none;
  }
  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  circle {
    fill: var(--fg-3);
    transition: cx var(--anim) ease, cy var(--anim) ease;
  }
  circle.pos {
    fill: var(--good);
  }
  circle.neg {
    fill: var(--bad);
  }
  .dot:focus-visible {
    outline: none;
  }
  .dot:focus-visible circle {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .tick {
    fill: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 8px;
  }
  .empty {
    fill: var(--fg-3);
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .caption {
    margin: 0;
    font-size: 10px;
    color: var(--fg-3);
    line-height: 1.4;
  }
</style>
