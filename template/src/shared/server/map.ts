import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { workspaceRoot } from "./forgeplan";

// SPEC-006 C5 — GET /api/map is a dumb honest mirror of
// <workspaceRoot>/.forgeplan/map/map.json. No structural validation happens
// here: C4 (validateMapDocument) is the web client's job, the third of the
// three validation call sites (§20) — forking the rule list between server
// and client would hide errors from the error-surface UX (RFC-030, Option 3,
// refuted).

const CMD_LABEL = "map:read" as const;

export interface MapFileOk {
  ok: true;
  data: unknown;
  cmd: typeof CMD_LABEL;
}

export interface MapFileErr {
  ok: false;
  data: Record<string, never>;
  cmd: typeof CMD_LABEL;
  error: string;
}

export type MapFileResult = MapFileOk | MapFileErr;

function mapFilePath(): string {
  return join(workspaceRoot(), ".forgeplan", "map", "map.json");
}

export async function readMapFile(): Promise<MapFileResult> {
  const path = mapFilePath();
  if (!existsSync(path)) {
    return { ok: true, data: {}, cmd: CMD_LABEL };
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    return {
      ok: false,
      data: {},
      cmd: CMD_LABEL,
      error: (err as Error).message,
    };
  }
  try {
    const data = JSON.parse(raw) as unknown;
    return { ok: true, data, cmd: CMD_LABEL };
  } catch (err) {
    return {
      ok: false,
      data: {},
      cmd: CMD_LABEL,
      error: `map: invalid JSON — ${(err as Error).message}`,
    };
  }
}

export const MAP_CMD_LABEL = CMD_LABEL;

// PRD-038 FR-002 / rule-22 amendment — GET /api/map/layers/<zone> is the
// same "dumb honest mirror" pattern as readMapFile, applied to a
// map-pack-emitted per-zone layer document at
// <workspaceRoot>/.forgeplan/map/layers/<zone>.json. No structural
// validation here either — the web client validates (SPEC-006 C4), same
// division of labour as the root map document.

const LAYER_CMD_LABEL = "map:layer:read" as const;

export interface MapLayerFileOk {
  ok: true;
  data: unknown;
  cmd: typeof LAYER_CMD_LABEL;
}

export interface MapLayerFileErr {
  ok: false;
  data: Record<string, never>;
  cmd: typeof LAYER_CMD_LABEL;
  error: string;
}

export type MapLayerFileResult = MapLayerFileOk | MapLayerFileErr;

// Single-segment, traversal-free zone id: letters/digits/dot/dash/underscore
// only, and never containing `..` (a zone id like "z.decisions" is valid;
// "../../etc/passwd" or "a/b" is not — "/" is already excluded by the
// charset, ".." is rejected explicitly since the charset alone permits two
// adjacent dots). MVP scope: single-segment top-level zone ids only: a
// nested "<ancestor>/<zone>" layer path is a follow-up (PRD-038 out of
// scope for this arc) and is rejected the same as any other traversal
// attempt.
const ZONE_ID_RE = /^[a-zA-Z0-9._-]+$/;

export function isValidZoneId(zone: string): boolean {
  return ZONE_ID_RE.test(zone) && !zone.includes("..");
}

function mapLayerFilePath(zone: string): string {
  return join(workspaceRoot(), ".forgeplan", "map", "layers", `${zone}.json`);
}

export async function readMapLayerFile(
  zone: string,
): Promise<MapLayerFileResult> {
  const path = mapLayerFilePath(zone);
  if (!existsSync(path)) {
    return { ok: true, data: {}, cmd: LAYER_CMD_LABEL };
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    return {
      ok: false,
      data: {},
      cmd: LAYER_CMD_LABEL,
      error: (err as Error).message,
    };
  }
  try {
    const data = JSON.parse(raw) as unknown;
    return { ok: true, data, cmd: LAYER_CMD_LABEL };
  } catch (err) {
    return {
      ok: false,
      data: {},
      cmd: LAYER_CMD_LABEL,
      error: `map layer: invalid JSON — ${(err as Error).message}`,
    };
  }
}

export const MAP_LAYER_CMD_LABEL = LAYER_CMD_LABEL;
