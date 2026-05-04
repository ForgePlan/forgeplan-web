import type { RequestHandler } from './$types';
import { runForgeplan, respond } from '@/shared/server';

export const GET: RequestHandler = async () => respond(await runForgeplan(['order', '--json']));
