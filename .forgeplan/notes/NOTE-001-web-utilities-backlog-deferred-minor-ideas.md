---
depth: tactical
id: NOTE-001
kind: note
links:
- target: PRD-008
  relation: informs
- target: PRD-009
  relation: informs
- target: PRD-010
  relation: informs
- target: PRD-011
  relation: informs
status: active
title: 'Web utilities backlog: deferred minor ideas'
---

# NOTE-001: Web utilities backlog — deferred minor ideas

| Field       | Value                              |
| ----------- | ---------------------------------- |
| Status      | Active                             |
| Created     | 2026-05-06                         |
| Valid Until | 2026-08-06 (re-evaluate quarterly) |
| Context     | post-v0.1.11 strategic backlog     |

## Note

Capture of small/medium feature ideas surfaced during the v0.1.x
brainstorm sessions but **deliberately deferred** in favour of the F18
(Time-travel) → F19 (Risk overlay) → F22 (Stats dashboard) → F23
(Proactive hints) implementation arc. Each item below is a candidate
for a future Tactical or Standard PRD when prioritised.

## Backlog items

| ID  | Idea                                | Type      | Cost    | Why deferred                                                                                                                                                                       |
| --- | ----------------------------------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F25 | "Ask AI about this artifact" button | Tactical  | 0.5d    | Light version of chat — builds markdown context block, copies to clipboard. Wait until F22/F23 ship to see real workflow patterns first                                            |
| F26 | RSS feed `/api/feed.xml`            | Tactical  | 0.5d    | Subscribe to changes per artifact / workspace. Good Slack/IFTTT bridge. Low priority until users ask                                                                               |
| F27 | View-state permalink (URL)          | Tactical  | 1d      | `?view=force&selected=PRD-005&zoom=1.5&t=2026-04-15` — share state. Foundational for time-travel deep links (F18 unlock)                                                           |
| F28 | Inline structured search            | Standard  | 2d      | "PRDs about X with R_eff > 0.5 modified < 30d" — filter expressions, no embeddings yet. Embeddings layer = separate future PRD                                                     |
| F29 | Walkthrough mode                    | Tactical  | 1d      | Click "Tour" on artifact → auto-step through ancestors/descendants with copy. Onboarding-adjacent                                                                                  |
| F30 | GitHub PR cross-link                | Tactical  | 1.5d    | Pull PR comments mentioning artifact id; show in Coverage section. Needs GitHub token + auth flow                                                                                  |
| F31 | Decision genealogy timeline         | Standard  | 2-3d    | "This decision is based on THESE older ones, ordered by time" — like git blame for forgeplan. Partly subsumed by F18 time-travel                                                   |
| F32 | Snapshot bookmarks on time-travel   | Tactical  | 0.5d    | Bookmark interesting points on the F18 scrubber with custom labels. After F18 ships                                                                                                |
| F33 | Annotation layer                    | Standard  | 2d      | Per-team notes on artifacts without modifying source markdown. **Requires ADR exception to rule 20** (host writes only to `.forgeplan-web/`). Defer until clear need               |
| F34 | Embedded chat / agent (heavy)       | Strategic | 2 weeks | Full LLM-powered chat with tool-calling on workspace. Architectural shift — separate read-only proxy contract, secrets, network egress, privacy. Treat as new product, not feature |
| F35 | Coverage section in ArtifactPanel   | Tactical  | 1.5d    | Single layer (12 commits · 3 files) — git log -G search. Read-only, rule 22 OK with `git` allow-list extension. Originally F20                                                     |
| F36 | Onboarding empty-state hint         | Tactical  | 0.5d    | Single welcome banner with 3 "start here" suggested artifact ids. localStorage-dismissed flag. Originally F21                                                                      |

## Decision criteria when picking next

- **Picks before F22/F23 land**: F27 (permalink, foundational) — only if it accelerates F18 deep-links.
- **Picks after F22/F23 land**: F25 + F35 + F36 — cheap quality-of-life wins.
- **Wait for usage data**: F28 (search), F33 (annotations), F34 (chat).

## Decision: which NOT to do

- F34 (heavy chat) — treat as separate product, not feature. Re-evaluate Q3.
- F31 (decision genealogy) as standalone — subsumed by F18 once shipped; only revisit if F18's COMPARE mode doesn't cover it.

## Related

This note tracks deferred siblings of the active arc:

- PRD-008 / RFC-007 — F18 Time-travel
- PRD-009 / RFC-008 — F19 Risk overlay
- PRD-010 / RFC-009 — F22 Workspace pulse
- PRD-011 / RFC-010 — F23 Proactive hints

Update this note when items are promoted to PRDs OR when scope shifts.




