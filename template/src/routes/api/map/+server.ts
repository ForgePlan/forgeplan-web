import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { readMapFile } from "@/shared/server";

// SPEC-006 C5 / rule 22 amendment: GET-only, no spawn, no forgeplan
// invocation. Delegates entirely to readMapFile() (shared/server/map.ts).
export const GET: RequestHandler = async () => {
  return json(await readMapFile());
};
