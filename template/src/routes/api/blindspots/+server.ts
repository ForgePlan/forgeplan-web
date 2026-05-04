import type { RequestHandler } from './$types';
import { runForgeplan, respond } from '@/shared/server';

// FIXME(forgeplan-cli): blindspots has no --json flag in 0.27 — return raw
// text for the UI to render.
export const GET: RequestHandler = async () =>
  respond(await runForgeplan(['blindspots'], { parse: false }));
