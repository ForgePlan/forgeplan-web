import type { ArtifactDetail } from "@/entities/artifact";
import { displayId } from "@/entities/artifact/lib/identity";
import type { GraphEdge } from "@/entities/graph";

const BODY_EXCERPT_LIMIT = 500;

/**
 * Build a copy-paste-friendly markdown summary of an artifact for use
 * in PR descriptions, Slack threads, etc.
 *
 * Format:
 *   # {id} — {title}
 *
 *   **Status**: ... · **Kind**: ... · **R_eff**: ...
 *
 *   ## Outgoing
 *   - {to} ({relation})
 *
 *   ## Incoming
 *   - {from} ({relation})
 *
 *   ## Body excerpt
 *   {first N chars + ... if longer}
 *
 * Outgoing / Incoming sections are omitted when empty. Body section is
 * omitted when the artifact has no body.
 */
export function buildMarkdownSummary(
  artifact: ArtifactDetail,
  outgoing: GraphEdge[],
  incoming: GraphEdge[],
): string {
  const lines: string[] = [];
  lines.push(`# ${displayId(artifact)} — ${artifact.title}`);
  lines.push("");
  const reff =
    artifact.r_eff !== undefined && artifact.r_eff !== null
      ? artifact.r_eff.toFixed(2)
      : "n/a";
  lines.push(
    `**Status**: ${artifact.status} · **Kind**: ${artifact.kind} · **R_eff**: ${reff}`,
  );
  lines.push("");
  if (outgoing.length > 0) {
    lines.push("## Outgoing");
    for (const e of outgoing) {
      lines.push(`- ${e.to} (${e.relation})`);
    }
    lines.push("");
  }
  if (incoming.length > 0) {
    lines.push("## Incoming");
    for (const e of incoming) {
      lines.push(`- ${e.from} (${e.relation})`);
    }
    lines.push("");
  }
  if (artifact.body) {
    lines.push("## Body excerpt");
    lines.push("");
    const body = artifact.body.trim();
    if (body.length > BODY_EXCERPT_LIMIT) {
      lines.push(body.slice(0, BODY_EXCERPT_LIMIT).trimEnd() + "...");
    } else {
      lines.push(body);
    }
    lines.push("");
  }
  return lines.join("\n");
}
