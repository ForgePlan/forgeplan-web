# forgeplan-map-pack — output-quality findings (first rendered real map vs the spike)

> **How to use this file.** Portable handoff — copy into `~/Work/ForgePlanMarketplace`.
> Companion to `MAP-PACK-v0.2.0-FINDINGS.md` (which covered v0.2.0 _pipeline_
> defects, resolved in v0.5.0). This file covers the _output data quality_ of the
> `map.json` v0.5.0 emits, found by rendering the first real generated map of
> `forgeplan-web` in the composed-map view and comparing it to the reference
> spike (`forge-understand/spike/index.html`). The renderer was hardened
> defensively for all three (forgeplan-web commit 07a4dc8), so the map is now
> readable regardless — but the map.json itself should improve so the output is
> right at the source, not just survivable downstream.

## Context

v0.5.0 successfully generated a real `web-fullstack` map of forgeplan-web
(4 zones / 32 nodes / 14 edges). Rendering it surfaced three data-shape gaps vs
the spike — none block rendering (the web renderer now clips/guards), but each
makes the emitted map lower-fidelity than the spike's curated reference.

## Finding O-1 — 🔴 `node.meta` carries full descriptions → cards overflow ~5x

The emitter puts a **full sentence** in `node.meta` — e.g.
`"bin/commands/init.mjs — init subcommand: scaffolds .forgeplan-web/ from bundled
dist image, ensures forgeplan binary+workspace, appends .gitignore"` (146 chars).
`meta` is the card **subline** — it renders on one line in a ~190px card. Measured
in-browser: **29 of 32 cards overflowed, up to 706px** past the card, spilling
across zones. The spike keeps `meta` to a short kind·count subline
(`surface · 76 commands`, `core · routing`) and puts prose elsewhere.

**Fix (map-pack):** `map-emitter`/`zone-extractor` should keep `node.meta` a short
subline (path or `kind · <count/tag>`), and move the full sentence into
`node.description_ru` (already in the schema — SPEC-003; the web renderer shows it
in the detail panel, not on the card). Rule of thumb: `meta` ≤ ~30 chars.
(forgeplan-web already truncates `meta` to fit + a `<title>` tooltip, so this is
about source fidelity, not a crash — but a 146-char subline is never right.)

## Finding O-2 — 🔴 zero `flows` emitted → no flow chips / no path highlight

The generated map has **`flows: []`**. The spike ships **7 flows** (Shape / Prove /
Reason / Search / Brownfield / Drift / …) whose chips are the map's headline
feature: click one → dim everything, light the end-to-end path with animated
clay edges + a numbered step caption. With no flows, the composed-map shows **no
chips at all** — the entire flow-navigation experience is dark on real data.

**Fix (map-pack):** the pipeline should derive a handful of `flows` for the
selected composition (each `{ id, name, node_ids, edge_ids?, steps[] }`). The
`web-fullstack` composition could ship 2–4 canonical flows as `flow_hints`
(e.g. "request path: routes → entities → widgets", "decision trail:
RFC → SPEC → PRD → EPIC"), and the emitter fills `node_ids`/`edge_ids` from the
extracted graph + writes short `steps[]` narration. `MapFlow.name` should be
**short** (chip label) — `"Map render"`, not a sentence. (forgeplan-web renders
flows fully — chips top-right, dim/light, marching-ants, step caption — verified
against a hand-added demo flow; it just needs the data.)

## Finding O-3 — 🟡 `stack-ttb` arrangement → tall narrow strip vs the spike's 2D grid

`web-fullstack.yaml` uses `arrangement: stack-ttb` with `canvas.grid.cols: 1`, so
all 4 zones stack **vertically** in one column — a tall, narrow ribbon you must
scroll. The spike lays zones out in a **3×2 grid** (Surfaces / Core / Storage on
top; Orchestration / Intelligence / External below) — a comfortable wide canvas
where the whole system is visible at once.

**Fix (map-pack):** give `web-fullstack` (and similar) a multi-column arrangement —
`grid.cols: 2` (or 3) with `placements` spreading zones across a 2D grid instead
of one column. forgeplan-web's `computeComposedLayout` already supports
multi-column placements (`cell: {row, col, col_span?, row_span?}`), so this is
purely a composition-data change. (Marked 🟡 because our own PROJECT-MAP-SPEC
staged multi-column as Phase-2, but on a real 4-zone map the single column is
already the least comfortable part of the layout.)

## Summary

| #   | Sev | What                                                                    | Fix (map-pack)                                                |
| --- | --- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| O-1 | 🔴  | `node.meta` = 146-char sentence → 29/32 cards overflow                  | keep `meta` a short subline; full text → `description_ru`     |
| O-2 | 🔴  | `flows: []` → no chips / no flow highlight (the map's headline feature) | derive 2–4 flows per composition with short names + `steps[]` |
| O-3 | 🟡  | `stack-ttb` cols:1 → tall narrow ribbon                                 | multi-column arrangement (`grid.cols: 2–3`, 2D placements)    |

_From the first rendered real map of forgeplan-web (map-pack v0.5.0), 2026-07-04,
compared to `forge-understand/spike/index.html`. Renderer hardened for all three
(forgeplan-web 07a4dc8); these are source-fidelity improvements for map-pack._
