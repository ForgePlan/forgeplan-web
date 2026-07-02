import type { RequestHandler } from "./$types";
import { runForgeplan, respond } from "@/shared/server";

// 45s: `score --all` first waits up to 30s for the forgeplan workspace lock
// (held by agent sessions) and then needs real scoring time on 100+ artifacts.
// A 30s cap raced the lock-wait and killed the CLI at the boundary.
export const GET: RequestHandler = async () =>
  respond(
    await runForgeplan(["score", "--all", "--json"], { timeoutMs: 45_000 }),
  );
