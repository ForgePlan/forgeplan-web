import type { RequestHandler } from './$types';
import { runForgeplan } from '$lib/server/forgeplan';
import { respond } from '$lib/server/respond';

export const GET: RequestHandler = async () =>
  respond(await runForgeplan(['score', '--all', '--json'], { timeoutMs: 30_000 }));
