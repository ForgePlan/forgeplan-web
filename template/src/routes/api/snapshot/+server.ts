import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";
import { getSnapshot } from "@/shared/server";

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export const GET: RequestHandler = async ({ url }) => {
  const at = url.searchParams.get("at");
  const compare = url.searchParams.get("compare");

  if (!at || !ISO_RE.test(at)) {
    throw error(
      400,
      "invalid 'at' parameter — expected ISO 8601 (YYYY-MM-DDTHH:MM:SS[.sss]Z)",
    );
  }

  if (compare !== null) {
    if (!ISO_RE.test(compare)) {
      throw error(400, "invalid 'compare' parameter — expected ISO 8601");
    }
    // TODO(F18-T6): COMPARE mode — call compareSnapshots(at, compare).
    throw error(501, "COMPARE mode not yet implemented (F18-T6)");
  }

  const result = await getSnapshot(at);
  if (!result.ok) {
    return json(
      {
        ok: false,
        at,
        sha: result.sha,
        error: result.error,
        error_code: result.error_code,
        stderr_excerpt: result.stderr_excerpt,
      },
      { status: result.status ?? 502 },
    );
  }

  return json({
    ok: true,
    at,
    sha: result.sha,
    snapshot: result.snapshot,
    fromCache: result.fromCache,
  });
};
