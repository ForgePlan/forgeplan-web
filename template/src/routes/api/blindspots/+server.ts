import type { RequestHandler } from './$types';
import { runForgeplan } from '$lib/server/forgeplan';
import { respond } from '$lib/server/respond';

// FIXME(forgeplan-cli): blindspots has no --json flag in 0.27 — return raw
// text for the UI to render.
export const GET: RequestHandler = async () =>
  respond(await runForgeplan(['blindspots'], { parse: false }));
