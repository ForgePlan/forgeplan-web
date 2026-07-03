---
depth: standard
id: EVID-087
kind: evidence
last_modified_at: 2026-07-03T11:38:38.825204+00:00
last_modified_by: claude-code/2.1.198
links:
- target: RFC-030
  relation: informs
status: active
title: 'Visual render-proof: composed-map renders correctly, live UX testing found and fixed a real reactivity bug'
---

## What this closes

EVID-086 (guardian gate, CONCERNS) named the missing browser render-proof as the one remaining unmet requirement against RFC-030's own "load-bearing Phase-1 gate" framing. This EVID closes it with a real screenshot plus live interaction testing — done at the user's explicit request ("хочу теперь проверить это в UX").

### What was verified visually (dev server `:5179`, `FORGEPLAN_CWD` correctly set)

- **All 5 zones render correctly**: CLI Surfaces, SvelteKit App, Build Pipeline, Docs & Governance, Decision Trail — neutral-dashed chrome per §16 FINAL, no rainbow tinting, labels + sub-labels legible.
- **16 node cards render at their computed grid positions**, no overlap, no clipping, EN labels verbatim, kind-derived border colors visible (Decision Trail cards show distinct per-kind coloring).
- **Curved edges + zone connectors render** between zones (e.g. CLI Surfaces → Build Pipeline "spawns"/"copies dist/"/"bundled into" labels legible on the connector paths).
- **Flow chips render** ("init scaffolds the web app", "build pipeline produces images") as an HTML overlay, distinct from the SVG canvas, matching FR-007/PRD Q5 minima.
- **Click-to-select works correctly, including cross-referencing**: clicking the `RFC-030` decision-trail card selects it (orange border + glow) AND simultaneously highlights the `API proxy` code node in the SvelteKit App zone — this is the checkpoint fixture's own `artifact_id` annotation on a code node pointing at the RFC that governs it, working exactly as designed (initially mistook this for a bug during investigation — it is not one). The existing `ArtifactPanel` opens showing RFC-030's real body content, confirming `onSelect` wiring into the host's existing artifact-panel plumbing (RFC-030's Component Diagram claim) is correct.
- **Dark theme verified**: toggling to Dark re-renders every token correctly with zero caller-side intervention (Invariant 7) — zone chrome, node borders, connector strokes, minimap all adapt.
- **Minimap renders** (bottom-right), confirming the `onViewState` reporting shape matches what the host's existing `Minimap` component expects (RFC-030's "zero new minimap code" claim holds).
- Screenshots saved: `composed-map-render-proof.png` (initial), `composed-map-selected-clean.png` (RFC-030 selected, light), `composed-map-dark-theme.png` (same selection, dark).

### Real bug found and fixed via this live testing (not caught by any prior automated check)

Switching into the Map view and letting it sit produced a browser console warning: `[svelte] derived_inert — Reading a derived belonging to a now-destroyed effect may result in stale values`, reproducibly, tied to `ComposedMapView.svelte`. Root cause: the "zoom-to-fit only the first document" effect scheduled `fitToView()` via `queueMicrotask`, and that callback's closure read the `layout` `$derived.by` value — if the owning effect was torn down (e.g. the view was switched away) before the microtask fired, reading `layout` at that point is exactly what Svelte's warning describes. Neither `svelte-check` nor `vitest` catch this class of bug (it's a runtime reactivity-timing issue, not a type or logic error) — **only live browser interaction surfaced it**, which is the concrete argument for why the render-proof gate matters beyond what static checks already covered.

Fixed by capturing `layout`'s value at schedule time and guarding the microtask callback with the effect's own cleanup-set `destroyed` flag, rather than re-reading the live derived from a stale closure. Confirmed fixed live: repeated reload / view-switch cycles that reliably reproduced the warning before the fix now produce zero console warnings and zero errors (one unrelated transient `/api/score` 504 was observed, caused by pre-existing `.forgeplan/.lock` contention from concurrent `forgeplan score --all` processes on this machine — unrelated to composed-map, not fixed here).

### Still not done (genuinely deferred, not a live-testing finding)

The Phase-4 render-harness automated test suite (mirroring `idef0-view.render.test.ts`) still does not exist — this manual pass is a one-time human/agent-driven confirmation, not a regression guard. A future commit should still add it so this exact class of bug (and the render-proof more broadly) is caught by CI, not only by someone remembering to open a browser.

## Structured Fields

verdict: supports
congruence_level: 3
evidence_type: test


