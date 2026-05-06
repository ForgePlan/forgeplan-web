import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { compareSemver } from '@/shared/server';

// PRD-013 / RFC-012: read-only npm registry probe. Allowed by rule 22 as the
// single non-forgeplan endpoint. URL is a string literal — no user input
// reaches the network call. No host filesystem mutation occurs anywhere in
// this module. See `.claude/rules/22-readonly-proxy.md`.

const REGISTRY_URL = 'https://registry.npmjs.org/@forgeplan/web/latest';
const TIMEOUT_MS = 5_000;
const CACHE_MS = 5 * 60_000;
const CMD_LABEL = 'GET registry.npmjs.org/@forgeplan/web/latest';
const USER_AGENT = `@forgeplan/web ${__FORGEPLAN_WEB_VERSION__} (update-check)`;

let cache: { latest: string; ts: number } | null = null;
let inflight: Promise<string | null> | null = null;

async function fetchLatest(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
    });
    if (!res.ok) {
      // FIXME(rate-limit): npm 429s could surface here — caller falls back to hasUpdate:false.
      throw new Error(`registry HTTP ${res.status}`);
    }
    const body = (await res.json()) as { version?: unknown };
    if (typeof body.version !== 'string' || body.version.length === 0) return null;
    return body.version;
  } finally {
    clearTimeout(timer);
  }
}

async function getLatestCached(): Promise<string | null> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_MS) return cache.latest;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const v = await fetchLatest();
      if (v) cache = { latest: v, ts: Date.now() };
      return v;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const GET: RequestHandler = async () => {
  const current = __FORGEPLAN_WEB_VERSION__;
  try {
    const latest = await getLatestCached();
    return json({
      ok: true,
      data: {
        current,
        latest,
        hasUpdate: latest ? compareSemver(latest, current) > 0 : false,
      },
      cmd: CMD_LABEL,
    });
  } catch (err) {
    return json({
      ok: false,
      error: (err as Error).message,
      data: { current, latest: null, hasUpdate: false },
      cmd: CMD_LABEL,
    });
  }
};
