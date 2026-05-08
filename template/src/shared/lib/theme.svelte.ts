// PRD-015 / RFC-014 — theme store.
//
// Tri-state mode (`auto` | `light` | `dark`) persisted in localStorage,
// with a derived `effective` ('light' | 'dark') that resolves Auto via
// the `prefers-color-scheme` media query and stays subscribed to OS
// changes for as long as the page is open.
//
// First-paint correctness is handled by an inline script in `app.html`
// that runs before SvelteKit hydrates. This module re-applies the
// resolved value on every change (so toggle clicks work without reload).

export type ThemeMode = 'auto' | 'light' | 'dark' | 'orch';
export type ThemeEffective = 'light' | 'dark' | 'orch';

const STORAGE_KEY = 'forgeplan-web.theme';

function isMode(v: unknown): v is ThemeMode {
  return v === 'auto' || v === 'light' || v === 'dark' || v === 'orch';
}

function readStored(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'auto';
  const v = localStorage.getItem(STORAGE_KEY);
  return isMode(v) ? v : 'auto';
}

function readSystem(): ThemeEffective {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function readDocumentMode(): ThemeMode {
  if (typeof document === 'undefined') return 'auto';
  const v = document.documentElement.dataset.themeMode;
  return isMode(v) ? v : 'auto';
}

function applyToDOM(effective: ThemeEffective, mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = effective;
  document.documentElement.dataset.themeMode = mode;
}

class ThemeStore {
  // Initialise from the DOM if the pre-paint script ran (browser); from
  // localStorage if running on the client without DOM-attribute hint;
  // default to 'auto' on the server (no `document`).
  mode = $state<ThemeMode>(typeof document !== 'undefined' ? readDocumentMode() : readStored());
  systemPref = $state<ThemeEffective>(readSystem());

  effective = $derived<ThemeEffective>(
    this.mode === 'auto' ? this.systemPref : this.mode
  );

  // Bumps every time the effective theme changes — graph views can read
  // this signal to invalidate cached CSS-var color reads.
  tick = $derived<number>(this.effective === 'light' ? 1 : 0);

  private mql: MediaQueryList | null = null;
  private mqlListener: ((e: MediaQueryListEvent) => void) | null = null;

  start() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this.mql = window.matchMedia('(prefers-color-scheme: light)');
    this.mqlListener = (e) => {
      this.systemPref = e.matches ? 'light' : 'dark';
    };
    // Older Safari only supports addListener / removeListener.
    if (this.mql.addEventListener) {
      this.mql.addEventListener('change', this.mqlListener);
    } else {
      // TODO(safari-legacy): drop when minimum iOS 14 is no longer relevant.
      (this.mql as MediaQueryList & { addListener?: (l: (e: MediaQueryListEvent) => void) => void })
        .addListener?.(this.mqlListener);
    }
  }

  stop() {
    if (!this.mql || !this.mqlListener) return;
    if (this.mql.removeEventListener) {
      this.mql.removeEventListener('change', this.mqlListener);
    } else {
      (this.mql as MediaQueryList & { removeListener?: (l: (e: MediaQueryListEvent) => void) => void })
        .removeListener?.(this.mqlListener);
    }
    this.mql = null;
    this.mqlListener = null;
  }

  setMode(next: ThemeMode) {
    this.mode = next;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
    applyToDOM(this.effective, next);
  }
}

export const themeStore = new ThemeStore();
