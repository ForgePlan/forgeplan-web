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
