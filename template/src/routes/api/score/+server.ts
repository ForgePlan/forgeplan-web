import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { runForgeplan, respond } from "@/shared/server";

// Last-good payload survives lock storms: `score --all` needs the forgeplan
// workspace lock, which agent sessions can hold for minutes at a time. When
// the current run fails we serve the previous successful payload alongside
// ok:false + error — the client keeps rendering real numbers and shows the
// error state honestly instead of an empty Stats tab. Process-lifetime
// cache, no TTL: score output only changes when the workspace does, and a
// fresh success always replaces it.
let lastGood: { data: unknown; cmd: string } | null = null;

// 45s: `score --all` first waits up to 30s for the forgeplan workspace lock
// and then needs real scoring time on 100+ artifacts. A 30s cap raced the
// lock-wait and killed the CLI at the boundary.
export const GET: RequestHandler = async () => {
  const result = await runForgeplan(["score", "--all", "--json"], {
    timeoutMs: 45_000,
  });
  if (result.ok) {
    lastGood = { data: result.data, cmd: result.cmd };
    return respond(result);
  }
  if (lastGood) {
    return json({
      ok: false,
      error: result.error ?? "unknown error",
      cmd: result.cmd,
      data: lastGood.data,
    });
  }
  return respond(result);
};
