import type { RequestHandler } from './$types';
import { runForgeplan, respond } from '@/shared/server';

export const GET: RequestHandler = async ({ url }) => {
  const limit = url.searchParams.get('limit') ?? '20';
  const safeLimit = /^\d{1,4}$/.test(limit) ? limit : '20';
  return respond(await runForgeplan(['log', '--json', '--limit', safeLimit]));
};
