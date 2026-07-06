// RFC-033 (Pillar B) — pure, rune-free onboarding tour state. Zero
// Svelte/DOM coupling: no camera, no rendering, no clock, no randomness.
// The view (ComposedMapView.svelte) holds the $state controller and calls
// these reducers; this module only computes stops and the next state.

import type { MapDocument } from "@/entities/map";

export interface MemberSummary {
  /** Count of the zone's real (non-mega) member nodes. */
  total: number;
  /** First N member labels, for the "what's inside" summary. */
  labels: string[];
}

export interface TourStop {
  zoneId: string;
  /** EN label, verbatim from the zone. */
  label: string;
  /**
   * RU narration — `zone.description_ru` or `undefined`. Never fabricated
   * (MASTER-SPEC §15 honesty): a zone with no sourced narration is a stop
   * with no `narrationRu`, not a placeholder string.
   */
  narrationRu?: string;
  memberSummary: MemberSummary;
}

export interface TourState {
  active: boolean;
  index: number;
}

const MEMBER_SUMMARY_LIMIT = 6;

/**
 * Derives the tour's zone-walk order from `composition.placements` (sorted
 * row-major: `cell.row` then `cell.col`) — the same order the renderer
 * paints top-to-bottom, so the camera walk matches what the user already
 * sees scrolling the map. Falls back to `zones[]` array order when
 * `placements` is empty/absent (a hand-written or degenerate document).
 * Deterministic and total: never throws, same `doc` always yields the same
 * stops in the same order.
 */
export function buildTourStops(doc: MapDocument): TourStop[] {
  const zoneById = new Map(doc.zones.map((zone) => [zone.id, zone] as const));
  const placements = doc.composition?.placements ?? [];
  const seen = new Set<string>();
  const orderedZoneIds: string[] = [];

  if (placements.length > 0) {
    const sorted = [...placements].sort((a, b) => {
      if (a.cell.row !== b.cell.row) return a.cell.row - b.cell.row;
      return a.cell.col - b.cell.col;
    });
    for (const placement of sorted) {
      if (!zoneById.has(placement.zone) || seen.has(placement.zone)) continue;
      seen.add(placement.zone);
      orderedZoneIds.push(placement.zone);
    }
  } else {
    for (const zone of doc.zones) {
      if (seen.has(zone.id)) continue;
      seen.add(zone.id);
      orderedZoneIds.push(zone.id);
    }
  }

  return orderedZoneIds.map((zoneId) => {
    const zone = zoneById.get(zoneId)!;
    const members = doc.nodes.filter((n) => n.zone === zoneId && !n.is_mega);
    return {
      zoneId,
      label: zone.label,
      narrationRu: zone.description_ru,
      memberSummary: {
        total: members.length,
        labels: members.slice(0, MEMBER_SUMMARY_LIMIT).map((n) => n.label),
      },
    };
  });
}

export function startTour(state: TourState): TourState {
  void state;
  return { active: true, index: 0 };
}

/** Advancing past the last stop exits the tour (FR-006 "reaching the last zone"). */
export function nextStop(state: TourState, count: number): TourState {
  if (state.index + 1 >= count) return exitTour(state);
  return { ...state, index: state.index + 1 };
}

export function prevStop(state: TourState): TourState {
  return { ...state, index: Math.max(0, state.index - 1) };
}

export function goToStop(
  state: TourState,
  index: number,
  count: number,
): TourState {
  const clamped = Math.max(0, Math.min(Math.max(0, count - 1), index));
  return { ...state, index: clamped };
}

export function exitTour(state: TourState): TourState {
  void state;
  return { active: false, index: 0 };
}

export function currentStop(
  stops: readonly TourStop[],
  state: TourState,
): TourStop | null {
  if (!state.active) return null;
  return stops[state.index] ?? null;
}
