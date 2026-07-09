# Proactive hints — rule reference

PRD-011 / RFC-010. The hints engine surfaces workspace anomalies as ranked,
dismissible cards above the HealthBar. Every signal is computed **client-side**
from already-polled, allow-listed read-only endpoints — there is **no
`/api/anomalies` endpoint** and no allow-list widening (rule 22).

- Rules: [`template/src/widgets/hints/lib/hint-rules.ts`](../template/src/widgets/hints/lib/hint-rules.ts)
- Ranking + dedupe + snooze: [`compute-hints.ts`](../template/src/widgets/hints/lib/compute-hints.ts)
- Copy (i18n-ready): [`hint-copy.ts`](../template/src/widgets/hints/lib/hint-copy.ts)

## The 8 rules

| Rule id                | Severity | Fires when                                                            | Data source                           |
| ---------------------- | -------- | --------------------------------------------------------------------- | ------------------------------------- |
| `stale-spike`          | warning  | `stale_count − lastSeenStaleCount ≥ 3`                                | `/api/health` + localStorage baseline |
| `low-r-eff-critical`   | critical | an **active** artifact scores `r_eff < 0.3`                           | `/api/score` × `/api/list` (status)   |
| `valid-until-imminent` | warning  | `health.at_risk` is non-empty (degraded — see below)                  | `/api/health.at_risk`                 |
| `blind-spot-new`       | warning  | `health.blind_spots.length ≥ 2`                                       | `/api/health.blind_spots`             |
| `orphan-detected`      | tip      | `health.orphans.length ≥ 1`                                           | `/api/health.orphans`                 |
| `draft-too-old`        | tip      | `health.stale_drafts` is non-empty (degraded — see below)             | `/api/health.stale_drafts`            |
| `velocity-drop`        | warning  | last full week's net flow `< prevWeek.net × 0.4` (guarded `prev > 0`) | `/api/log` → `weeklyVelocity()`       |
| `cycle-detected`       | critical | `blocked.cycles` is non-empty                                         | `/api/blocked.cycles`                 |

Thresholds are exported consts at the top of `hint-rules.ts`
(`STALE_SPIKE_DELTA`, `LOW_R_EFF_THRESHOLD`, `BLIND_SPOT_MIN`, `ORPHAN_MIN`,
`VELOCITY_DROP_FACTOR`). Adding a 9th rule is a single append to `HINT_RULES`.

## Ranking

`rankHints` sorts by severity weight (critical 3 → warning 2 → tip 1) desc,
then by the rule's stable array index (`priority`) asc, then by id asc — fully
deterministic (NFR-003). The top 3 show by default; "show all" expands. Dedupe
keys on `affectedIds[0]`, first rule in `HINT_RULES` wins (RFC R-2).

## Snooze / dismiss

Snooze 1 day / 1 week per hint; **Dismiss == a 24h snooze** (not permanent — a
persisting state-based hint re-fires the next day, which is the correct
behaviour). Snoozes persist in `localStorage` under `settings.hintsSnoozed`
(hint id → epoch-ms expiry) and are auto-pruned on every load/save. A master
"Hints on/off" toggle in the HealthBar hides the whole panel
(`settings.hintsHidden`).

## Degraded rules and a deferred Could (documented blockers)

These are **constraints of the read-only proxy**, not bugs — and explicitly not
a reason to widen the allow-list:

- **`valid-until-imminent`** — per-artifact `valid_until` lives only on
  `/api/get/[id]`, not in any aggregate payload. The rule degrades to the coarse
  `health.at_risk` count ("N artifacts at risk of decaying"); the precise
  "expire in N days" copy is unreachable read-only.
- **`draft-too-old`** — per-artifact `created_at` is likewise only on
  `/api/get/[id]`. The rule degrades to `health.stale_drafts[]` (id + age_hours),
  so its semantics are "draft flagged stale by health", not "draft older than 30
  days".
- **FR-010 (per-rule thresholds via `forgeplan-web.json`)** — that file is read
  server-side only (`shared/server/forgeplan.ts`); no allow-listed client
  endpoint exposes it. Threshold tuning is deferred; the exported consts in
  `hint-rules.ts` are the single-file tunable surface until a config-exposing
  surface exists.
