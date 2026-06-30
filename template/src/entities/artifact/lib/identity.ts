import type { ArtifactSummary } from "../model/types";

// Display identifier for an artefact. Returns id_display when present,
// else falls back to id. NOTE: the forgeplan CLI (`list`/`get --json`)
// never emits id_display — it is MCP-DTO-only (≥ 0.31). Against the CLI
// transport this app uses (rule 22) this helper therefore always returns
// `a.id`; it is forward-compatible scaffolding for a future CLI that
// projects a render id into `list --json`. Pure — safe in reactive contexts.
//
// The "?" draft marker (`PRD-74?`) would be preserved verbatim if it ever
// arrived, but it too lives only in frontmatter, not CLI JSON. See
// RFC-015 D-2 + the forgeplan 0.33 contract audit (2026-06-23).
export function displayId(
  a: Pick<ArtifactSummary, "id" | "id_display">,
): string {
  // `||` (not `??`): an empty-string `id_display` from a regressed upstream
  // must still fall back to `id` — see RFC-015 invariant I-5.
  return a.id_display || a.id;
}
