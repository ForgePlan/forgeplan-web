# Issue Tracker

This project **does not use** Linear, Jira, or GitHub Issues as the
day-to-day task queue. The single source of truth for "what is being
worked on" is the **Forgeplan artifact lifecycle** (`.forgeplan/`):

```
draft → active → superseded / deprecated / stale
```

See [`../../CLAUDE.md`](../../CLAUDE.md) "Source of truth" and rule
[`../../.claude/rules/11-forgeplan-required.md`](../../.claude/rules/11-forgeplan-required.md).

## Implications for fpl-skills

- **`/fpl-skills:briefing`** — prefers Forgeplan as the primary source.
  Use `forgeplan list --status draft` and `forgeplan stale` to fill
  the "overdue / due today" buckets. GitHub Issues is queried only as
  a secondary surface for community-reported bugs against the
  published `@forgeplan/web` package — see `gh issue list --repo
  ForgePlan/forgeplan-web`.
- **`/fpl-skills:do`** / **`/fpl-skills:autorun`** — must accept a
  forgeplan ID (`PRD-014`, `RFC-013`, `EVID-021`) directly. No Linear
  / Jira ticket-ID wiring is needed.
- **`/fpl-skills:sprint`** / **`/fpl-skills:research`** — output
  reports go to `research/reports/` (default) or are linked back into
  the driving Forgeplan artifact via `forgeplan link`.

## External surfaces

| Surface              | Purpose                                            | When                                       |
| -------------------- | -------------------------------------------------- | ------------------------------------------ |
| GitHub Issues        | Community bug reports against the npm package     | User-reported regressions only             |
| GitHub Pull Requests | Code review + CI matrix gate                      | All Standard+ merges                       |
| GitHub Releases      | Triggers `release.yml` → `npm publish`            | One per `vX.Y.Z` tag from `release/v*`     |

## Forbidden

- Creating Linear / Jira / Asana tickets for tracking — defeats
  Forgeplan as single source of truth.
- Treating a GitHub Issue as a substitute for a PRD on Standard+ work
  (rule 11).
