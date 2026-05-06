---
depth: standard
id: RFC-010
kind: rfc
links:
- target: PRD-011
  relation: refines
status: draft
title: Hints rule DSL + ranking dispatcher
---

# RFC-010: Hints rule DSL + ranking dispatcher

## Summary

PRD-011 wants a proactive hints engine. This RFC pins:

1. The **rule shape** (DSL) — what each rule looks like, how it's added.
2. The **8+ initial rules** with thresholds and copy.
3. The **ranking algorithm** — severity × recency, deterministic.
4. The **snooze model** — localStorage TTL behaviour.

## Motivation

Without a pinned shape, rules become ad-hoc and hint copy diverges in
tone. Pinning the rule contract here makes adding rules in the future
mechanical and avoids hint-copy drift.

## Rule shape

```ts
export type HintSeverity = "critical" | "warning" | "tip";

export interface HintInput {
  artifacts: ArtifactSummary[];
  edges: GraphEdge[];
  health: HealthResponse;
  scores: ScoreEntry[];
  velocityWeekly: number; // last 4w avg net activations
  now: Date;
}

export interface Hint {
  id: string; // stable per-rule (`stale-spike`, `low-r-eff`, ...)
  severity: HintSeverity;
  text: string; // 1 sentence, plain language
  action?: {
    label: string; // "Open Risk tab" | "Run forgeplan stale"
    href?: string; // navigates to in-app surface
    cliHint?: string; // CLI command to copy
  };
  affectedIds?: string[]; // for click-drill
  computedAt: number; // timestamp ms
}

export interface HintRule {
  id: string;
  defaultSeverity: HintSeverity;
  copy: (matched: HintInput) => string;
  match: (input: HintInput) => HintMatch | null;
}

export interface HintMatch {
  severity?: HintSeverity; // override default
  affectedIds: string[];
  data?: Record<string, unknown>;
}
```

Each rule:

- Has a stable `id`.
- Returns `null` if not applicable, or a `HintMatch` with affected ids.
- Hint copy is computed by `copy(input)` for fresh, current text.

## The 8 initial rules

| Rule id                | Default severity | Trigger                                                               | Copy template                                                      |
| ---------------------- | ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `stale-spike`          | warning          | `health.stale_count - last_seen_stale_count >= 3`                     | "{N} artifacts went stale recently — review {topId} and others"    |
| `low-r-eff-critical`   | critical         | any artifact with `r_eff < 0.3` and `status === active`               | "{topId} is active but rests on weak evidence (R_eff {x})"         |
| `valid-until-imminent` | warning          | any artifact with `valid_until` in next 7 days                        | "{N} evidence packs expire in {minDays} days — schedule a refresh" |
| `blind-spot-new`       | warning          | `health.blind_spots.length >= 2`                                      | "{N} active artifacts have no evidence supporting them"            |
| `orphan-detected`      | tip              | artifact with no incoming AND outgoing hierarchy edges, status=active | "{N} active artifacts have no links — connect them or deprecate"   |
| `draft-too-old`        | tip              | artifact with `status === draft` AND `created_at` > 30 days ago       | "{topId} has been a draft for {N} days — activate or delete"       |
| `velocity-drop`        | warning          | `velocityWeekly < prevVelocity × 0.4`                                 | "Activations slowed {pct}% — drafts piling up"                     |
| `cycle-detected`       | critical         | dependency cycle in hierarchy edges                                   | "Dependency cycle: {a} → {b} → ... → {a}"                          |

Rules live in `template/src/widgets/hints/lib/hint-rules.ts`. Adding a 9th rule = appending to a single exported array.

## Ranking algorithm

```ts
function rankHints(hints: Hint[]): Hint[] {
  const SEVERITY_WEIGHT = { critical: 3, warning: 2, tip: 1 };
  return [...hints].sort((a, b) => {
    const dw = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (dw !== 0) return dw;
    // Recency tiebreaker — prefer hints first emitted recently
    return b.computedAt - a.computedAt;
  });
}
```

Top 3 by default. "Show all" expands.

## Snooze model

`pages/home/lib/settings.ts` adds:

```ts
export interface Settings {
  hintsHidden: boolean;
  hintsSnoozed: Record<string, number>; // hint id → epoch ms when snooze ends
}
```

When user clicks "Snooze 1d" on hint `stale-spike`:

```ts
settings.hintsSnoozed["stale-spike"] = Date.now() + 24 * 3600 * 1000;
```

`computeHints()` filters: `hints.filter(h => !settings.hintsSnoozed[h.id] || settings.hintsSnoozed[h.id] < Date.now())`.

Auto-cleanup: on every save, drop entries where `value < Date.now()`.

"Dismiss" = same as "Snooze 24h" (not permanent — if the issue persists tomorrow, hint re-appears, which is the right behaviour for state-based hints).

## Localization-ready copy

All copy strings centralized in:

```ts
// hint-copy.ts
export const HINT_COPY = {
  "stale-spike":
    "{N} artifacts went stale recently — review {topId} and others",
  "low-r-eff-critical":
    "{topId} is active but rests on weak evidence (R_eff {x})",
  // ...
};
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string;
```

Future-proof for i18n bundle injection.

## Implementation Phases

1. **F23-T1** — `lib/hint-rules.ts` with 8 rules + `lib/hint-rules.test.ts` (one fixture per rule).
2. **F23-T2** — `lib/compute-hints.ts` runner + ranker + tests (deterministic ordering for fixtures).
3. **F23-T3** — `Settings.hintsHidden` + `Settings.hintsSnoozed` + auto-cleanup; localStorage persist.
4. **F23-T4** — `HintCard.svelte` (severity icon + text + action + dismiss/snooze menu).
5. **F23-T5** — `HintsPanel.svelte` (top 3 + collapsible + "show all").
6. **F23-T6** — embed in HomePage above HealthBar; aria-live polite mirror.
7. **F23-T7** — CHANGELOG, smoke + tests, commit, push, PR.

## Proposed Direction

Adopt rule-array DSL (single file extension point). PR
`feature/f23-proactive-hints → develop`.

## Options Considered

| Option                               | Description                                | Verdict                                                                                     |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **A. Array of rules in single file** | Simple add-via-append                      | **Chosen**                                                                                  |
| B. Rule plugin loader                | Each rule own file, dynamic registration   | Rejected — over-engineered for ~10 rules                                                    |
| C. JSON config-driven rules          | Author-tweakable without code change       | Rejected — FR-010 covers threshold tuning via config; structural rule definition stays code |
| **D. Severity × recency ranking**    | Simple, predictable                        | **Chosen**                                                                                  |
| E. Bayesian severity                 | Score recalculated based on action history | Rejected — premature, no usage data yet                                                     |

## Invariants

- Each rule has a stable `id` (never renamed; deprecation requires a new id).
- Rules don't fetch additional data — they consume `HintInput` snapshot only.
- `computeHints` is pure — same input → same output (NFR-003).
- "Dismiss" never permanent — only TTL-snooze (24h default). Re-fires if issue persists.
- All copy strings in `hint-copy.ts` map (NFR-005, future i18n).

## Rollback Plan

1. Revert each F23-T\* commit independently.
2. Drop `widgets/hints/` directory.
3. Remove `hintsHidden` / `hintsSnoozed` from Settings.
4. localStorage entries become orphan (harmless).

## Risks

- R-1: Rule thresholds wrong → false positives. Mitigate via dogfood + config override (FR-010).
- R-2: Rules conflict (same artifact appears in 2 rules). Engine dedupes by `affectedIds[0]` — first rule wins. Document.
- R-3: Hint copy carries stale data when workspace changes between render and click. Mitigate by computing fresh on each 10s poll cycle.
- R-4: Snooze TTL too short → hint fatigue; too long → user misses real issue. 24h default tunable per rule via config.

