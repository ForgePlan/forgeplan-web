import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isValidZoneId, readMapLayerFile } from "@/shared/server";

// PRD-038 FR-002 / rule-22 amendment: GET-only, read-only mirror of a
// map-pack-emitted per-zone layer at
// <workspaceRoot>/.forgeplan/map/layers/<zone>.json. Same "dumb honest
// mirror" contract as /api/map (no spawn, no forgeplan invocation, no
// structural validation — the web client validates, SPEC-006 C4). MVP
// scope: single-segment top-level zone ids only.
export const GET: RequestHandler = async ({ params }) => {
  const zone = params.zone ?? "";
  if (!isValidZoneId(zone)) {
    throw error(400, `invalid zone id: ${zone}`);
  }
  return json(await readMapLayerFile(zone));
};
