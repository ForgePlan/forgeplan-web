import type { ArtifactSummary } from "../model/types";

// Display identifier for an artefact. Returns id_display when present
// (forgeplan ≥ 0.28 with slug-canonical identity), falls back to id
// for legacy artefacts. Pure — safe to call inside reactive contexts.
//
// The "?" marker for drafts originates in the CLI (`PRD-74?`) and is
// preserved verbatim — never appended or stripped here. See RFC-015 D-2.
export function displayId(
  a: Pick<ArtifactSummary, "id" | "id_display">,
): string {
  // `||` (not `??`): an empty-string `id_display` from a regressed upstream
  // must still fall back to `id` — see RFC-015 invariant I-5.
  return a.id_display || a.id;
}
