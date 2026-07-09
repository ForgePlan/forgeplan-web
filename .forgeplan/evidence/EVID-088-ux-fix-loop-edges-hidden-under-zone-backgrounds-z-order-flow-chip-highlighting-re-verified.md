---
depth: standard
id: EVID-088
kind: evidence
last_modified_at: 2026-07-03T11:48:46.221037+00:00
last_modified_by: claude-code/2.1.198
links:
- target: RFC-030
  relation: informs
status: active
title: 'UX fix-loop: edges hidden under zone backgrounds (z-order), flow-chip highlighting re-verified'
---

## Bug found via user's own live UX check

The user reported, testing the render-proof live: "стрелки почему-то за карточками и их не видно" (arrows are somehow behind the cards and invisible). Root-caused precisely: SVG paint order was `edge-layer` (bottom) → `zone-slab` ×5 (middle) → `node-hit` ×16 (top). Zone slabs carry a solid `fill: var(--zone)` covering large rectangular areas — any edge segment passing UNDER a zone's rect (i.e. most cross-zone edges, since zones tile most of the canvas) was hidden by the zone's own background, not merely under individual node cards (which would be normal/expected).

## Fix

Reordered `ComposedMapView.svelte`'s render to `zone-slab` (background) → `edge-layer` (now visible against it) → `node-hit` (unchanged, still on top — edges terminating at a card still disappear under that card's small footprint, which is the normal/expected node-link-diagram convention, not a bug).

## Verification

- Live Playwright: previously-invisible cross-zone edges (e.g. `start` → `SPEC-006`) now render continuously; screenshots `composed-map-zorder-fixed.png` confirm.
- `npx svelte-check` 0 errors / 1155 files, `npx vitest run` 477/477 — no regression.
- **Flow-chip highlighting independently re-verified at the DOM level** (the user also asked whether chips "correctly highlight only specific arrows"): clicking the "init scaffolds the web app" chip produces exactly 1 edge/connector at `opacity: 1` and 16 at `opacity: 0.2` (computed style, not just class presence) — the dim/highlight mechanism itself was never broken; only the z-order made the base (undimmed) state hard to read. Note for follow-up: opacity-only dimming is subtle at typical zoom levels — a future polish pass could also bump `stroke-width`/color on the active path for more visual contrast, not done in this fix.
- Also noted (not this repo's bug, informational): the checkpoint fixture only defines 2 flows (`init scaffolds the web app`, `build pipeline produces images`) — "chips feel few" is a **fixture data** characteristic (Phase-1 hand-authored minimal checkpoint), not a code defect. A real cartographer-emitted map would carry as many flows as the scan discovers.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test


