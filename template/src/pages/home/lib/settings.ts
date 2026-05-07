import { browser } from "$app/environment";
import {
  GRAPH_VIEW_IDS,
  type GraphView,
  INSIGHT_TAB_IDS,
  type InsightTab,
} from "@/shared/config";
import type { ArtifactKind, ArtifactStatus } from "@/entities/artifact";

const STORAGE_KEY = "forgeplan-web:settings:v1";

const ARTIFACT_KINDS = new Set<ArtifactKind>([
  "prd",
  "rfc",
  "adr",
  "spec",
  "epic",
  "evidence",
  "evid",
  "note",
  "problem",
  "solution",
]);
const ARTIFACT_STATUSES = new Set<ArtifactStatus>([
  "draft",
  "active",
  "superseded",
  "deprecated",
  "stale",
]);

function isArtifactKind(v: unknown): v is ArtifactKind {
  return typeof v === "string" && ARTIFACT_KINDS.has(v as ArtifactKind);
}
function isArtifactStatus(v: unknown): v is ArtifactStatus {
  return typeof v === "string" && ARTIFACT_STATUSES.has(v as ArtifactStatus);
}

export interface PersistedSettings {
  view: GraphView;
  kindFilter: ArtifactKind[];
  statusFilter: ArtifactStatus[];
  activeTab: InsightTab;
  notify: boolean;
}

export interface ResolvedSettings {
  view: GraphView;
  kindFilter: Set<ArtifactKind>;
  statusFilter: Set<ArtifactStatus>;
  activeTab: InsightTab;
  notify: boolean;
}

export const DEFAULT_SETTINGS: ResolvedSettings = {
  view: "force",
  kindFilter: new Set<ArtifactKind>(),
  statusFilter: new Set<ArtifactStatus>(),
  activeTab: "agents",
  notify: false,
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
      out.kindFilter = new Set<ArtifactKind>(s.kindFilter.filter(isArtifactKind));
    }
    if (Array.isArray(s.statusFilter)) {
      out.statusFilter = new Set<ArtifactStatus>(
        s.statusFilter.filter(isArtifactStatus),
      );
    }
    if (s.activeTab && INSIGHT_TAB_IDS.has(s.activeTab))
      out.activeTab = s.activeTab;
    if (typeof s.notify === "boolean") out.notify = s.notify;
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
      activeTab: snapshot.activeTab,
      notify: snapshot.notify,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // TODO(persisted-settings): quota exceeded or storage disabled — skip persist.
  }
}

function cloneDefaults(): ResolvedSettings {
  return {
    view: DEFAULT_SETTINGS.view,
    kindFilter: new Set<ArtifactKind>(DEFAULT_SETTINGS.kindFilter),
    statusFilter: new Set<ArtifactStatus>(DEFAULT_SETTINGS.statusFilter),
    activeTab: DEFAULT_SETTINGS.activeTab,
    notify: DEFAULT_SETTINGS.notify,
  };
}
