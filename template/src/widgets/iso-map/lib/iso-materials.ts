// TODO(iso-promote): promote to widgets/iso-map + move shared drill logic to
// entities on graduation (see .claude/rules/10-comments-policy.md).
//
// Token -> THREE.Color reader + tuned material constants for the iso-spike.
// THEME-REACTIVE: `readIsoColors` must be called from inside a `$derived.by`
// that ALSO reads `themeStore.tick` (see IsoScene.svelte), fixing the former
// "read once at mount, not reactive to theme" TODO — colors recompute every
// time the theme toggles instead of freezing at first paint.
import * as THREE from "three";

export interface IsoColorTokens {
  /** --accent */
  accent: THREE.Color;
  /** --accent-soft */
  accentSoft: THREE.Color;
  /** --bg-2 */
  plate: THREE.Color;
  /** --fg-2 */
  node: THREE.Color;
}

const FALLBACKS = {
  accent: "#ff5a1f",
  accentSoft: "#ff8a5b",
  plate: "#141414",
  node: "#a3a3a3",
} as const;

function readCssColor(varName: string, fallback: string): THREE.Color {
  if (typeof document === "undefined") return new THREE.Color(fallback);
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return new THREE.Color(val || fallback);
}

export function readIsoColors(): IsoColorTokens {
  return {
    accent: readCssColor("--accent", FALLBACKS.accent),
    accentSoft: readCssColor("--accent-soft", FALLBACKS.accentSoft),
    plate: readCssColor("--bg-2", FALLBACKS.plate),
    node: readCssColor("--fg-2", FALLBACKS.node),
  };
}

// --- Scout-1: matte paper-sheet zone fill --------------------------------
// Zone fill used to be MeshBasicMaterial opacity 0.02 with NO color
// (effectively invisible, kept alive only so raycast picking still worked).
// Now the fill is bound to the SAME color driving <Edges> (see
// IsoZoneFrame.svelte) at a low-but-visible opacity, so zones read as thin
// matte sheets tinted in their own outline color.
//
// MINIMAP reframe: this view is a compact overview shown alongside the main
// 2D map, not a heavy interactive surface — sheets read as thin translucent
// PAPER, not dark plates, so opacity was lowered again (0.16 -> 0.07).
export const ZONE_FILL_OPACITY = 0.07;
// polygonOffset (paired with depthWrite:false on the fill material) keeps
// the coplanar fill + <Edges> outline from z-fighting.
export const ZONE_POLYGON_OFFSET_FACTOR = -1;
export const ZONE_POLYGON_OFFSET_UNITS = -1;

// Per-level floor "plate" — thin translucent paper, faintly tinted (MINIMAP
// reframe: 0.12/0.28 read as heavy dark plates, dropped to 0.03/0.10).
export const PLATE_THICKNESS = 0.03;
export const PLATE_Y_OFFSET = PLATE_THICKNESS / 2 + 0.02;
export const PLATE_OPACITY = 0.1;

// --- Stage 3 (redesigned): per-ELEMENT hover-dwell emphasis --------------
// Highlights ONLY the individual zone/node under the cursor — the former
// whole-PLATE emphasis (PLATE_EMPHASIS_OPACITY_MULT, boosting the entire
// sheet's fill + gating a bright <Edges> outline on the plate itself) is
// retired: on a minimap, brightening the whole sheet for one hovered box
// is disproportionate. `brightenForEmphasis` lightens the element's OWN
// color toward white; callers (IsoZoneFrame/IsoNodeBox) pair it with a
// modest fill boost for translucent elements.
export const ELEMENT_EMPHASIS_LERP = 0.55;
export const ELEMENT_EMPHASIS_FILL_MULT = 1.8;

/** Brightens `color` toward white for the per-element hover-dwell
 * highlight. Returns a NEW THREE.Color; never mutates the input. */
export function brightenForEmphasis(color: THREE.Color): THREE.Color {
  return color.clone().lerp(new THREE.Color(1, 1, 1), ELEMENT_EMPHASIS_LERP);
}

// Monotonic depth falloff: shallower planes (index 0 = root) keep full
// tint; deeper planes dim toward PLANE_FALLOFF_MIN so the exploded stack
// reads front-to-back.
export const PLANE_FALLOFF_STEP = 0.42;
export const PLANE_FALLOFF_MIN = 0.22;

/** Opacity multiplier for a plane at `index` (0 = shallowest/root). */
export function planeFalloff(index: number): number {
  return Math.max(PLANE_FALLOFF_MIN, 1 - index * PLANE_FALLOFF_STEP);
}

// Desaturation companion to the opacity falloff above — deeper planes lose
// saturation toward neutral gray, on top of dimming.
export const PLANE_DESATURATION_STEP = 0.09;
export const PLANE_DESATURATION_MAX = 0.3;

/** Desaturates `color` toward neutral gray as depth `index` increases.
 * Returns a NEW THREE.Color; never mutates the input. */
export function desaturateForDepth(
  color: THREE.Color,
  index: number,
): THREE.Color {
  const amount = Math.min(
    PLANE_DESATURATION_MAX,
    index * PLANE_DESATURATION_STEP,
  );
  if (amount <= 0) return color.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * (1 - amount), hsl.l);
}

// --- Fine dashed lines (frustum connectors + ICOM boundary arrows) -------
// Thinner, higher dash frequency, shorter dash segments than the original
// fat-dash pass — a fine dotted look instead of chunky dashes.
//
// The now-thin translucent plates (PLATE_OPACITY/ZONE_FILL_OPACITY above)
// made these lines nearly invisible where they cross a sheet — fixed by
// pairing near-opaque CONNECTOR_LINE_OPACITY with `depthTest={false}` +
// a high `renderOrder` on the mesh (see IsoFrustum.svelte /
// IsoIcomArrows.svelte), so the dashed corner-to-corner lines always
// paint ON TOP of every plate/zone sheet regardless of draw order.
export const CONNECTOR_LINE_WIDTH = 0.8;
export const CONNECTOR_LINE_OPACITY = 1;
export const CONNECTOR_DASH_ARRAY = 0.06;
export const CONNECTOR_DASH_RATIO = 0.65;

export const ICOM_ARROW_WIDTH = 1.2;
export const ICOM_ARROW_OPACITY = 0.95;
export const ICOM_ARROW_DASH_ARRAY = 0.06;
export const ICOM_ARROW_DASH_RATIO = 0.65;

/** Shared renderOrder for dashed connector/arrow meshes — always higher
 * than any plate's own `renderOrder={planeIndex}` (see IsoPlane.svelte),
 * so these lines composite after (visually on top of) every sheet. */
export const LINE_RENDER_ORDER = 1000;
