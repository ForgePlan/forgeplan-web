import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { runForgeplan } from '$lib/server/forgeplan';
import { respond } from '$lib/server/respond';

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export const GET: RequestHandler = async ({ params }) => {
  const id = params.id ?? '';
  // Block path traversal / shell metachars before passing to spawn (which is
  // already arg-array safe, but we still guard the value against typos).
  if (!ID_RE.test(id)) {
    throw error(400, `invalid artifact id: ${id}`);
  }
  return respond(await runForgeplan(['get', id, '--json']));
};
