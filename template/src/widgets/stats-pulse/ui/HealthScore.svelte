<script lang="ts">
  import { Tooltip } from "@/shared/ui";
  import type { HealthScore } from "../lib/health-score";
  import { healthBand } from "../lib/health-score";
  import type { Interpretation } from "../lib/interpret";
  import type { TrendPoint } from "../lib/trend";

  let {
    health,
    interpretation,
    trend,
    trendSufficient,
  }: {
    health: HealthScore;
    interpretation: Interpretation;
    trend: TrendPoint[];
    trendSufficient: boolean;
  } = $props();

  const band = $derived(healthBand(health.score));
  const bandLabel = $derived(
    band === "good" ? "Strong" : band === "warn" ? "Fair" : "Weak",
  );

  // Sparkline geometry.
  const SW = 96;
  const SH = 26;
  const sparkPoints = $derived(buildSpark(trend));

  function buildSpark(points: TrendPoint[]): string {
    if (points.length < 2) return "";
    const vals = points.map((p) => p.activeCumulative);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * (SW - 2) + 1;
        const y = SH - 2 - ((p.activeCumulative - min) / range) * (SH - 4);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }
</script>

<div class="health-score band-{band}" data-test="health-score">
  <div class="score-main">
    <Tooltip label={interpretation.copy}>
      <div class="score-number">
        <span class="num">{health.score}</span>
        <span class="denom">/100</span>
      </div>
    </Tooltip>
    <div class="score-meta">
      <span class="band-badge band-{band}" data-test="chart-status">
        <span class="band-icon" aria-hidden="true">{interpretation.icon}</span>
        <span class="band-text">{bandLabel}</span>
      </span>
      <span class="score-label">Workspace health</span>
    </div>
  </div>

  <div class="score-side">
    <Tooltip
      label={trendSufficient
        ? "Approximate 30-day trend reconstructed from the activity log (active-artifact count). Per-day R_eff history is not available read-only."
        : "Not enough activity-log history yet to draw a meaningful trend."}
    >
      <div class="spark" data-test="health-trend">
        {#if sparkPoints && trendSufficient}
          <svg
            viewBox="0 0 {SW} {SH}"
            role="img"
            aria-label="Approximate 30-day active-artifact trend"
            preserveAspectRatio="none"
          >
            <polyline points={sparkPoints} class="spark-line" />
          </svg>
        {:else}
          <span class="spark-empty">no trend data yet</span>
        {/if}
      </div>
    </Tooltip>
  </div>

  <details class="breakdown" data-test="health-score-breakdown">
    <summary>Breakdown</summary>
    <ul>
      {#each health.components as c (c.key)}
        <li>
          <span class="c-label">{c.label}</span>
          <span class="c-bar-track">
            <span class="c-bar" style:width={pct(c.value)}></span>
          </span>
          <span class="c-val">{pct(c.value)}</span>
          <span class="c-weight">×{c.weight.toFixed(2)}</span>
        </li>
      {/each}
    </ul>
  </details>
</div>

<style>
  .health-score {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "main side"
      "breakdown breakdown";
    gap: 8px 12px;
    align-items: center;
    padding: 12px 14px;
    border: 1px solid var(--line-2);
    background: var(--bg-1);
  }
  .band-good {
    border-color: color-mix(in srgb, var(--good) 40%, var(--line-2));
  }
  .band-bad {
    border-color: color-mix(in srgb, var(--bad) 40%, var(--line-2));
  }
  .score-main {
    grid-area: main;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .score-number {
    display: flex;
    align-items: baseline;
    gap: 1px;
  }
  .num {
    font-family: var(--font-mono);
    font-size: 34px;
    line-height: 1;
    font-weight: 600;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .band-good .num {
    color: var(--good);
  }
  .band-warn .num {
    color: var(--accent);
  }
  .band-bad .num {
    color: var(--bad);
  }
  .denom {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--fg-3);
  }
  .score-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .band-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border: 1px solid var(--line-2);
    width: fit-content;
  }
  .band-icon {
    font-size: 11px;
  }
  .band-badge.band-good {
    color: var(--good);
    border-color: color-mix(in srgb, var(--good) 50%, transparent);
  }
  .band-badge.band-warn {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  }
  .band-badge.band-bad {
    color: var(--bad);
    border-color: color-mix(in srgb, var(--bad) 50%, transparent);
  }
  .score-label {
    font-size: 10px;
    color: var(--fg-3);
    letter-spacing: 0.04em;
  }
  .score-side {
    grid-area: side;
    display: flex;
    align-items: center;
  }
  .spark {
    width: 96px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .spark svg {
    width: 96px;
    height: 26px;
    display: block;
  }
  .spark-line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .spark-empty {
    font-size: 9px;
    color: var(--fg-4);
    font-family: var(--font-mono);
  }
  .breakdown {
    grid-area: breakdown;
    font-size: 10px;
  }
  .breakdown summary {
    cursor: pointer;
    color: var(--fg-3);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    user-select: none;
  }
  .breakdown summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .breakdown ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .breakdown li {
    display: grid;
    grid-template-columns: 96px 1fr 32px 36px;
    gap: 6px;
    align-items: center;
  }
  .c-label {
    color: var(--fg-2);
    font-family: var(--font-mono);
    font-size: 9px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .c-bar-track {
    height: 5px;
    background: var(--bg-2);
    border-radius: 2px;
    overflow: hidden;
  }
  .c-bar {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .c-val {
    text-align: right;
    color: var(--fg-1);
    font-family: var(--font-mono);
    font-size: 9px;
    font-variant-numeric: tabular-nums;
  }
  .c-weight {
    text-align: right;
    color: var(--fg-4);
    font-family: var(--font-mono);
    font-size: 9px;
  }
</style>
