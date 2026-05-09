import { tabsStore } from "../model/store.svelte";

/**
 * Centralised entry point for "open this artifact" gestures across the app
 * (graph node, rail row, in-panel link, NodeRef chip, breadcrumb).
 *
 * Shift = "open in new tab" (append + activate). Anything else replaces the
 * active tab so plain click keeps the existing single-panel UX. Keep this
 * one-liner — every call site routes through it so the modifier policy stays
 * in one place (NFR-002 in PRD-032).
 */
export function useOpen(
  event: Event | undefined | null,
  id: string,
): void {
  const append = isShift(event);
  tabsStore.openTab(id, { append });
}

function isShift(e: Event | undefined | null): boolean {
  if (!e) return false;
  const me = e as MouseEvent & KeyboardEvent;
  return me.shiftKey === true;
}
