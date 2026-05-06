---
depth: standard
id: PRD-017
kind: prd
last_modified_at: 2026-05-06T21:47:45.143144+00:00
last_modified_by: claude-code/2.1.131
status: draft
title: Shared Select component with icon-augmented graph view picker
---

# PRD-017 — Shared Select component with icon-augmented graph view picker

## Problem

`template/src/widgets/mosaic/ui/PaneFrame.svelte` uses a native `<select>` to switch between
the 7 graph views (force, tree, radial, matrix, lanes, sankey, sunburst). The native control
is functional but visually inconsistent with the rest of the design system (Button, Dialog,
Code), cannot show per-option iconography, and is constrained by the OS-level dropdown
chrome. Additionally, every consumer that needs a single-choice picker must re-style the
native element from scratch.

## Goals

- Ship a reusable `Select` primitive in `shared/ui/` that mirrors the visual language of
  `Button` (CSS variables, no Tailwind, monospace typography for technical UI).
- Replace the native `<select>` in `PaneFrame.svelte` with the new primitive.
- Surface a recognisable Lucide icon per graph view to speed scanning of the picker
  trigger and dropdown listbox.
- Preserve current keyboard / drag behaviour: the trigger must not start a pane drag,
  Escape closes the menu, arrows navigate.

## Non-Goals

- Multi-select, search input, async option loading — single-value only this iteration.
- Custom theming hooks beyond what the existing CSS variable system already exposes.
- Replacing every other native `<select>` in the app in this PR (none exist today, but
  follow-up adoption is out of scope).
- Animations beyond the bits-ui defaults — no spring or motion library introduced.

## Functional Requirements

- The component MUST be implemented on top of `bits-ui`'s `Select` primitive (headless,
  accessible by default) and import only from `bits-ui` for behaviour, never re-implementing
  ARIA semantics.
- The component MUST accept a generic `value` of type `string`, an `onValueChange`
  callback, an `items: Array<{ value: string; label: string; icon?: Component }>` list,
  and an optional `placeholder`.
- The trigger MUST render the active item's icon (if any) + label + a chevron, mirroring
  the screenshot supplied by the user (single-line, monospace, bordered, full-width).
- The content panel MUST render each item with icon + label, support keyboard navigation,
  and visually mark the currently selected item.
- Each of the 7 graph views MUST have a Lucide icon assigned via a static map exported
  from `shared/config/ui-prefs.ts` (or a sibling) so other call sites can reuse the same
  pictogram.
- The host's drag-handle in `PaneFrame.svelte` MUST continue to work — clicking the
  Select's trigger MUST NOT initiate a drag.
- Two runtime deps are added to `template/package.json#dependencies`: `bits-ui` and
  `@lucide/svelte`. Both are pinned to caret-bounded versions resolved at install time.
- No Tailwind classes, no inline `style` attributes carrying layout (only CSS variables),
  no global selector leaks — all styles live inside the component's `<style>` block.

## Target Users

Internal users of `forgeplan-web` (developers running the dashboard against their own
Forgeplan workspace). Indirect: any future consumer in `template/src/` that needs a
single-choice picker — they will import `Select` from `@/shared/ui` rather than reinvent.

## Related Artifacts

- PRD-016 — Multi-graph mosaic dashboard (parent feature; this iterates the picker UX).
- PRD-013 — Shared UI primitives (sets the precedent: variables, no Tailwind, FSD layer).
- Rule 21 — Template purity (runtime deps live in `template/package.json#dependencies`).
- Rule 22 — Read-only proxy (unchanged: this is a client-side widget, no server impact).

