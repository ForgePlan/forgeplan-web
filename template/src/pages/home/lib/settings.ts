import { browser } from '$app/environment';
import {
  GRAPH_VIEW_IDS,
  type GraphView,
  INSIGHT_TAB_IDS,
  type InsightTab
} from '@/shared/config';

const STORAGE_KEY = 'forgeplan-web:settings:v1';

export interface PersistedSettings {
  view: GraphView;
  kindFilter: string[];
  statusFilter: string[];
  activeTab: InsightTab;
}

export interface ResolvedSettings {
  view: GraphView;
  kindFilter: Set<string>;
  statusFilter: Set<string>;
  activeTab: InsightTab;
}

export const DEFAULT_SETTINGS: ResolvedSettings = {
  view: 'force',
  kindFilter: new Set(),
  statusFilter: new Set(),
  activeTab: 'agents'
};

export function loadSettings(): ResolvedSettings {
  if (!browser) return cloneDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const s = JSON.parse(raw) as Partial<PersistedSettings>;
    const out = cloneDefaults();
    if (s.view && GRAPH_VIEW_IDS.has(s.view)) out.view = s.view;
    if (Array.isArray(s.kindFilter)) {
      out.kindFilter = new Set(s.kindFilter.filter((x) => typeof x === 'string'));
    }
    if (Array.isArray(s.statusFilter)) {
      out.statusFilter = new Set(s.statusFilter.filter((x) => typeof x === 'string'));
    }
    if (s.activeTab && INSIGHT_TAB_IDS.has(s.activeTab)) out.activeTab = s.activeTab;
    return out;
  } catch {
    // TODO(persisted-settings): corrupt JSON in localStorage — fall back to defaults silently.
    return cloneDefaults();
  }
}

export function saveSettings(snapshot: ResolvedSettings): void {
  if (!browser) return;
  try {
    const persisted: PersistedSettings = {
      view: snapshot.view,
      kindFilter: [...snapshot.kindFilter],
      statusFilter: [...snapshot.statusFilter],
      activeTab: snapshot.activeTab
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // TODO(persisted-settings): quota exceeded or storage disabled — skip persist.
  }
}

function cloneDefaults(): ResolvedSettings {
  return {
    view: DEFAULT_SETTINGS.view,
    kindFilter: new Set(DEFAULT_SETTINGS.kindFilter),
    statusFilter: new Set(DEFAULT_SETTINGS.statusFilter),
    activeTab: DEFAULT_SETTINGS.activeTab
  };
}
