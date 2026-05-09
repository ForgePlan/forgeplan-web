/**
 * Multi-tab artifact viewing store (PRD-032 / issue #116).
 *
 * `openTab(id, { append })` is the single mutation entry point — `append=true`
 * adds the id without dropping the active one (Shift behaviour); `false` (or
 * default) replaces the active tab so the strip always stays "current focus".
 *
 * The store is intentionally unpersisted: closing the window clears it
 * (issue spec §3) — no `localStorage` writes here.
 */
const state = $state<{
  ids: string[];
  activeId: string | null;
}>({
  ids: [],
  activeId: null,
});

export const tabsStore = {
  get ids(): readonly string[] {
    return state.ids;
  },
  get activeId(): string | null {
    return state.activeId;
  },
  /**
   * Open `id`. With `append`, add as a new tab and activate it (existing tabs
   * stay). Without, replace the active tab in-place; if the strip is empty
   * the id is added.
   */
  openTab(id: string, opts: { append?: boolean } = {}): void {
    if (state.ids.includes(id)) {
      state.activeId = id;
      return;
    }
    if (opts.append || state.activeId === null) {
      state.ids = [...state.ids, id];
      state.activeId = id;
      return;
    }
    const idx = state.ids.indexOf(state.activeId);
    if (idx === -1) {
      state.ids = [...state.ids, id];
    } else {
      const next = state.ids.slice();
      next[idx] = id;
      state.ids = next;
    }
    state.activeId = id;
  },
  setActive(id: string): void {
    if (state.ids.includes(id)) state.activeId = id;
  },
  closeTab(id: string): void {
    const idx = state.ids.indexOf(id);
    if (idx === -1) return;
    const next = state.ids.slice();
    next.splice(idx, 1);
    state.ids = next;
    if (state.activeId !== id) return;
    if (next.length === 0) {
      state.activeId = null;
      return;
    }
    state.activeId = next[0] ?? null;
  },
  clear(): void {
    state.ids = [];
    state.activeId = null;
  },
  has(id: string): boolean {
    return state.ids.includes(id);
  },
};
