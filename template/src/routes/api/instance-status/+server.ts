import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runForgeplan } from '@/shared/server';

// Issue #134: pre-flight validation + live-status polling endpoint for the
// instance switcher. Uses only allowed subcommands (health, claims) per rule 22;
// no new non-forgeplan external calls.
const CMD_LABEL = 'health + claims --json';

// CORS headers are required: other forgeplan-web instances fetch this endpoint
// cross-origin (different port = different origin) to display live status in
// the instance switcher. Without these headers the browser blocks the response.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const GET: RequestHandler = async () => {
  const [healthResult, claimsResult] = await Promise.all([
    runForgeplan(['health', '--json']),
    runForgeplan(['claims', '--json']),
  ]);

  const claimsData =
    claimsResult.ok && claimsResult.data
      ? (claimsResult.data as { count?: number; claims?: unknown[] })
      : null;

  const agentCount = claimsData?.count ?? claimsData?.claims?.length ?? 0;

  return json(
    {
      ok: healthResult.ok,
      data: {
        health: healthResult.ok ? healthResult.data : null,
        agentCount,
      },
      cmd: CMD_LABEL,
    },
    { headers: CORS_HEADERS },
  );
};
