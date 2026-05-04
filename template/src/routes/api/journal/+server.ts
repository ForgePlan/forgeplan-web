import type { RequestHandler } from './$types';
import { runForgeplan } from '$lib/server/forgeplan';
import { respond } from '$lib/server/respond';

// FIXME(forgeplan-cli): `forgeplan journal` does not (as of 0.27) support
// --json. We capture the raw text and let the client render it as-is.
export const GET: RequestHandler = async () =>
  respond(await runForgeplan(['journal'], { parse: false }));
