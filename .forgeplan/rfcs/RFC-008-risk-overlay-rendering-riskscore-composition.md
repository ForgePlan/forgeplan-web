---
depth: standard
id: RFC-008
kind: rfc
status: draft
title: Risk overlay rendering + riskScore composition
---

# RFC-008: Risk overlay rendering + riskScore composition

## Summary

PRD-009 wants a one-glance risk surface: glow halos on artifacts whose
R_eff or decay state is concerning, gated by a toggle in the canvas
toolbar. This RFC pins:

1. **`riskScore(detail)` composition** — pure function combining R_eff
   with decay-time-remaining.
2. **Rendering technique choice** — SVG `filter` vs background `<circle>`
   halo vs HTML `box-shadow`.
3. **Toggle integration** — where it lives in canvas-toolbar, settings
   shape, view-aware enabling.

## Motivation

Without an RFC, the rendering technique decision (SVG filter vs simulated
halo) becomes ad-hoc on N=300 workspaces and risks paint jank. Pinning
here means the implementation is mechanical and audit-replicable.

## Algorithmic constants

```ts
const RISK_THRESHOLD = 0.6; // node-risk class applied below this
const GLOW_R_MIN = 2; // px
const GLOW_R_MAX = 14; // px
const DECAY_WINDOW_DAYS = 90; // days_remaining beyond this → no decay penalty
```

## riskScore composition

`widgets/dependency-graph/lib/risk-score.ts`:

```ts
import type { ArtifactDetail } from "@/entities/artifact";

const DECAY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Compose a risk score in [0, 1] where 1 is "highest risk".
 *
 *   risk = clamp(1 - r_eff)  ×  decay_factor
 *
 *   decay_factor =
 *     1                      if no valid_until field
 *     0                      if days_remaining ≥ 90 (no decay penalty yet)
 *     1 - daysRemaining/90   linearly increasing as expiry approaches
 *     1                      if expired (negative daysRemaining)
 *
 * Pure function — easy to unit test, no side effects.
 */
export function riskScore(
  detail: ArtifactDetail,
  now: Date = new Date(),
): number {
  const reff = typeof detail.r_eff === "number" ? detail.r_eff : 1;
  const reffPart = clamp(1 - reff, 0, 1);

  let decayFactor = 1;
  if (detail.valid_until) {
    const expiresAt = new Date(detail.valid_until).getTime();
    const remaining = expiresAt - now.getTime();
    if (remaining >= DECAY_WINDOW_MS) decayFactor = 0;
    else if (remaining <= 0) decayFactor = 1;
    else decayFactor = 1 - remaining / DECAY_WINDOW_MS;
  }

  return clamp(reffPart * decayFactor, 0, 1);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Convert risk score to a glow radius in pixels.
 */
export function glowRadiusPx(score: number): number {
  return Math.round(GLOW_R_MIN + score * (GLOW_R_MAX - GLOW_R_MIN));
}
```

Unit tests cover:

- no `r_eff` field → 0 risk (idle)
- `r_eff = 0.5`, no `valid_until` → 0.5
- `r_eff = 0.5`, expired → 1.0
- `r_eff = 0.9`, expired → 0.1 (clamp not needed because reffPart already clamped)
- `r_eff = 0.5`, valid_until = now + 45 days → 0.5 × 0.5 = 0.25
- `r_eff = 0.5`, valid_until = now + 100 days → 0 (outside decay window)

## Rendering technique — choice

| Technique                                       | Cost                                                                 | Visual quality                                                         | Verdict                                        |
| ----------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| **A. SVG `<filter>` blur halo**                 | medium — feGaussianBlur per node, GPU-accelerated in modern browsers | best — soft, true blur                                                 | **Chosen** for ≤ 200 nodes                     |
| B. Outer `<circle>` halo (radius + low opacity) | cheap — vanilla SVG                                                  | good — visually similar, no filter cost                                | **Chosen** for > 200 nodes (perf fallback)     |
| C. HTML `box-shadow` on `<g>` parent            | very cheap                                                           | doesn't actually clip to circle shape; halos are square in SVG context | Rejected — doesn't render correctly inside SVG |

**Strategy:** Apply A by default. Wrap glow application in a derived check:

```ts
const useFilterGlow = $derived(filteredNodes.length <= 200);
```

When N > 200, fall back to B (outer `<circle r="kindRadius + glowRadius" fill="var(--bad)" fill-opacity="0.25">`). NFR-001 (≤ 16ms) governs.

## CSS application

In `app.css`:

```css
/* Risk overlay (PRD-009 / RFC-008). Halo around artifacts with composite
   risk > 0 (R_eff degraded or decay imminent). Toggle-gated; doesn't
   apply to Sankey/Sunburst (their layouts already encode hierarchy). */
svg .node-risk .box,
svg .node-risk .arc,
svg .node-risk .bar {
  filter: drop-shadow(0 0 var(--node-risk-r, 6px) var(--bad));
}
```

Per-node `--node-risk-r` set inline via `style:--node-risk-r={`${glowRadiusPx(score)}px`}`.

## Toggle in canvas-toolbar

In HomePage.svelte view-toggle row:

```svelte
<button
  type="button"
  class="ghost"
  data-action="toggle-risk"
  class:active={riskOverlay}
  disabled={view === 'sankey' || view === 'sunburst'}
  title={view === 'sankey' || view === 'sunburst'
    ? 'Risk overlay not applicable for this view (hierarchy already encoded)'
    : 'Toggle risk overlay (R_eff + decay glow)'}
  onclick={() => riskOverlay = !riskOverlay}
>{riskOverlay ? '🔴 Risk' : '⚪ Risk'}</button>
```

State `riskOverlay` lives in `pages/home/lib/settings.ts` Settings shape:

```ts
export interface Settings {
  // ...existing
  riskOverlay: boolean;
}
```

Default `false`. Persisted via existing `loadSettings` / `saveSettings` localStorage flow.

## Risk anatomy section in ArtifactPanel

New sticky-row between meta and links:

```svelte
{#if riskScoreFor(detail) > 0.1}
  <section class="risk-anatomy sticky-row" data-test="risk-anatomy">
    <h3 class="fp-eyebrow">Risk anatomy</h3>
    <p class="risk-summary">{riskCopyFor(detail, evidence)}</p>
    {#if detail.evidence?.length}
      <ul class="evidence-list">
        {#each detail.evidence as e}
          <li class:weakest={e.id === weakestId}>
            <NodeRef id={e.id} />
            <span class="evidence-cl">CL{e.congruence_level}</span>
            <span class="evidence-type">{e.evidence_type}</span>
          </li>
        {/each}
      </ul>
    {/if}
    {#if detail.valid_until}
      <span data-test="decay-timer">Expires in {daysRemaining(detail.valid_until)}d</span>
    {/if}
  </section>
{/if}
```

Where `riskCopyFor()` produces a 1-2-sentence human summary like
"R_eff = 0.18 because the only Evidence is CL1 audit. Will become
stale in 9 days."

## Implementation Phases

1. **F19-T1** — `lib/risk-score.ts` + tests (riskScore, glowRadiusPx).
2. **F19-T2** — extend `Settings` with `riskOverlay`; HomePage toggle button + persistence.
3. **F19-T3** — apply `class:node-risk` + `style:--node-risk-r` on Force/Tree/Radial/Lanes/Matrix.
4. **F19-T4** — `app.css` `.node-risk` filter rule + reduced-motion guard.
5. **F19-T5** — Risk anatomy section in ArtifactPanel (`riskCopyFor`, evidence list, decay-timer).
6. **F19-T6** — perf fallback: when N > 200, swap filter for outer `<circle>` halo. Test on Helios playground.
7. **F19-T7** — CHANGELOG, smoke + tests, commit, push, PR `feature/f19-risk-overlay → develop`.

## Proposed Direction

Adopt SVG-filter-with-circle-fallback for rendering. PR
`feature/f19-risk-overlay → develop`. Implementation phases run
sequentially because they touch the same files in escalating
specificity.

## Options Considered

| Option                                      | Description                              | Verdict                                                                                   |
| ------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| **A. riskScore = (1-R_eff) × decay_factor** | Multiplicative composition               | **Chosen** — small risk × distant expiry stays small; either factor large → overall large |
| B. riskScore = max(1-R_eff, decay_factor)   | Either dimension dominates               | Rejected — decay alone shouldn't trigger glow if R_eff is healthy and evidence is fresh   |
| C. riskScore = (1-R_eff) + decay_factor / 2 | Additive                                 | Rejected — easy to overflow [0..1]                                                        |
| **D. SVG filter with N=200 fallback**       | Best fidelity + performance escape hatch | **Chosen**                                                                                |
| E. Always outer-circle halo                 | Cheaper but less polished                | Rejected as default — N=300 is rare, can fall back when reached                           |

## Invariants

- `riskScore` is pure (no side effects, deterministic).
- Risk overlay never auto-creates artifacts (rule 22).
- Sankey + Sunburst views NEVER render risk overlay (their layouts already encode hierarchy; competing channels confuse).
- Glow filter never affects layout (positioned via SVG filter, doesn't push siblings).
- Settings `riskOverlay` field defaults to `false`.

## Rollback Plan

1. Revert each F19-T\* commit independently.
2. Drop `lib/risk-score.ts` + test.
3. Remove `node-risk` class application from 5 view files.
4. Remove `.node-risk` CSS from app.css.
5. Drop `riskOverlay` from Settings (harmless on read; survives in localStorage as orphan boolean).

## Risks

- R-1: SVG filter paints slower than expected on N=300. Test on Helios playground in F19-T6; switch to outer-circle halo if NFR-001 (≤16ms) fails.
- R-2: `decay_factor` formula is linear; some users may want exponential. Not worth a flag — monitor feedback.
- R-3: `--bad` colour clash with selection-ring `--accent`. Selection-ring renders at z-index 1; risk glow at z-index 0 (filter on the box). Visually distinct.
