import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { readInstances, REGISTRY_CMD_LABEL } from "@/shared/server";

// PRD-027 / RFC-023 / SPEC-003 / ADR-004: read-only mirror of the global
// instance registry at `~/.forgeplan-web/instances.json`. Allowed by rule 22
// as the second non-forgeplan endpoint (see `.claude/rules/22-readonly-proxy.md`).
// No spawn, no host filesystem write — the only side-effect is the
// process-local cache inside `readInstances`.

export const GET: RequestHandler = async () => {
  try {
    const instances = await readInstances();
    return json({
      ok: true,
      data: { instances },
      cmd: REGISTRY_CMD_LABEL,
    });
  } catch (err) {
    return json({
      ok: false,
      error: (err as Error).message,
      data: { instances: [] },
      cmd: REGISTRY_CMD_LABEL,
    });
  }
};
