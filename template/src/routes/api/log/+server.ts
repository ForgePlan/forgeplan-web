import type { RequestHandler } from './$types';
import { runForgeplan } from '$lib/server/forgeplan';
import { respond } from '$lib/server/respond';

export const GET: RequestHandler = async ({ url }) => {
  const limit = url.searchParams.get('limit') ?? '20';
  const safeLimit = /^\d{1,4}$/.test(limit) ? limit : '20';
  return respond(await runForgeplan(['log', '--json', '--limit', safeLimit]));
};
