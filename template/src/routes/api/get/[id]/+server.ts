import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { runForgeplan, respond } from '@/shared/server';

const ID_RE = /^[A-Z]+-[0-9]+$/;

export const GET: RequestHandler = async ({ params }) => {
  const id = params.id ?? '';
  if (!ID_RE.test(id)) {
    throw error(400, `invalid artifact id: ${id}`);
  }
  return respond(await runForgeplan(['get', id, '--json']));
};
