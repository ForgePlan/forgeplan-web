import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { runForgeplan, respond } from "@/shared/server";
import type { ForgeplanResult } from "@/shared/server";

// `score --all` is the heaviest CLI call: it takes the forgeplan workspace
// lock and can run for tens of seconds on 100+ artifacts — long enough that
// naive per-request spawns queue up on the lock and starve EACH OTHER (each
// newcomer burns its 30s lock-wait against the previous spawn). Discipline:
//
//   single-flight — at most ONE score spawn at a time; concurrent requests
//     await the same promise instead of spawning competitors;
//   stale-while-revalidate — a fresh-enough success is served instantly;
//     an expired cache is served immediately too while ONE background
//     refresh runs; only the very first request (no cache yet) blocks;
//   last-good on failure — a failed run answers ok:false + error + the
//     previous good payload so the Stats tab keeps real numbers.
const FRESH_TTL_MS = 120_000;
const SCORE_TIMEOUT_MS = 120_000;

let lastGood: { data: unknown; cmd: string; at: number } | null = null;
let inflight: Promise<ForgeplanResult<unknown>> | null = null;

function refresh(): Promise<ForgeplanResult<unknown>> {
  inflight ??= runForgeplan(["score", "--all", "--json"], {
    timeoutMs: SCORE_TIMEOUT_MS,
  })
    .then((result) => {
      if (result.ok) {
        lastGood = { data: result.data, cmd: result.cmd, at: Date.now() };
      }
      return result;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export const GET: RequestHandler = async () => {
  if (lastGood && Date.now() - lastGood.at < FRESH_TTL_MS) {
    return json({ ok: true, data: lastGood.data, cmd: lastGood.cmd });
  }
  if (lastGood) {
    // Serve stale instantly; ONE background refresh replaces it.
    void refresh();
    return json({ ok: true, data: lastGood.data, cmd: lastGood.cmd });
  }
  const result = await refresh();
  if (result.ok) return respond(result);
  if (lastGood) {
    // A parallel first-load may have populated the cache meanwhile.
    return json({
      ok: false,
      error: result.error ?? "unknown error",
      cmd: result.cmd,
      data: (lastGood as { data: unknown }).data,
    });
  }
  return respond(result);
};
