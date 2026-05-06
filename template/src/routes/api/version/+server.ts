import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getForgeplanVersion } from '@/shared/server';

export const GET: RequestHandler = async () => {
  const cli = await getForgeplanVersion();
  return json({
    ok: true,
    data: { web: __FORGEPLAN_WEB_VERSION__, cli },
    cmd: 'forgeplan --version',
  });
};
