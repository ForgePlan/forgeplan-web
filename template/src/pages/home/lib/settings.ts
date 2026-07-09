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
  riskOverlay: boolean;
  // PRD-011 / RFC-010 — proactive hints engine.
  hintsHidden: boolean;
  hintsCollapsed: boolean;
  hintsSnoozed: Record<string, number>; // hint id → epoch ms when snooze ends
}

export interface ResolvedSettings {
  view: GraphView;
  kindFilter: Set<ArtifactKind>;
  statusFilter: Set<ArtifactStatus>;
  activeTab: InsightTab;
  notify: boolean;
  riskOverlay: boolean;
  hintsHidden: boolean;
  hintsCollapsed: boolean;
  hintsSnoozed: Record<string, number>;
}

export const DEFAULT_SETTINGS: ResolvedSettings = {
  view: "force",
  kindFilter: new Set<ArtifactKind>(),
  statusFilter: new Set<ArtifactStatus>(),
  activeTab: "agents",
  notify: false,
  riskOverlay: false,
  hintsHidden: false,
  hintsCollapsed: false,
  hintsSnoozed: {},
};

/**
 * Drop snooze entries whose TTL has already passed (RFC-010 auto-cleanup,
 * FR-008). Pure; returns a fresh record.
 */
function pruneSnoozed(
  snoozed: Record<string, number>,
  nowMs: number = Date.now(),
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, until] of Object.entries(snoozed)) {
    if (typeof until === "number" && until > nowMs) out[id] = until;
  }
  return out;
}

function isSnoozeRecord(v: unknown): v is Record<string, number> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((n) => typeof n === "number");
}

export function loadSettings(): ResolvedSettings {
  if (!browser) return cloneDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const s = JSON.parse(raw) as Partial<PersistedSettings>;
    const out = cloneDefaults();
    if (s.view && GRAPH_VIEW_IDS.has(s.view)) out.view = s.view;
    if (Array.isArray(s.kindFilter)) {
      out.kindFilter = new Set<ArtifactKind>(
        s.kindFilter.filter(isArtifactKind),
      );
    }
    if (Array.isArray(s.statusFilter)) {
      out.statusFilter = new Set<ArtifactStatus>(
        s.statusFilter.filter(isArtifactStatus),
      );
    }
    if (s.activeTab && INSIGHT_TAB_IDS.has(s.activeTab))
      out.activeTab = s.activeTab;
    if (typeof s.notify === "boolean") out.notify = s.notify;
    if (typeof s.riskOverlay === "boolean") out.riskOverlay = s.riskOverlay;
    if (typeof s.hintsHidden === "boolean") out.hintsHidden = s.hintsHidden;
    if (typeof s.hintsCollapsed === "boolean")
      out.hintsCollapsed = s.hintsCollapsed;
    if (isSnoozeRecord(s.hintsSnoozed))
      out.hintsSnoozed = pruneSnoozed(s.hintsSnoozed);
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
      riskOverlay: snapshot.riskOverlay,
      hintsHidden: snapshot.hintsHidden,
      hintsCollapsed: snapshot.hintsCollapsed,
      hintsSnoozed: pruneSnoozed(snapshot.hintsSnoozed),
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
    riskOverlay: DEFAULT_SETTINGS.riskOverlay,
    hintsHidden: DEFAULT_SETTINGS.hintsHidden,
    hintsCollapsed: DEFAULT_SETTINGS.hintsCollapsed,
    hintsSnoozed: {},
  };
}
