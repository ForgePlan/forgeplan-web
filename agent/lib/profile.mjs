// RFC-034 (Pillar C, Phase 2) / ADR-010 — the read-only Agent SDK profile.
// This is the ONLY place the onboarding session's permission surface is
// defined: Read/Glob/Grep + the in-process `show_on_map` tool are allowed;
// Write/Edit/Bash are explicitly denied. `mcpServers` is intentionally NOT
// set here — the daemon (bin/agent.mjs) owns the per-connection `onboard`
// MCP server instance (it needs a reference to that connection's socket) and
// merges it into the options object returned by `buildOptions`.

export const ALLOWED_TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "mcp__onboard__show_on_map",
];

export const DISALLOWED_TOOLS = ["Write", "Edit", "Bash"];

export const SYSTEM_PROMPT =
  "You are an onboarding guide for this software project. You have " +
  "READ-ONLY access to the repo, its .forgeplan/ workspace, and " +
  ".forgeplan/map/map.json (a forgeplan.map/v1 document describing the " +
  "project as zones/nodes/edges/flows). Answer the newcomer concisely, in " +
  "the language they ask in. Whenever you reference a zone, module, or " +
  "flow, CALL the show_on_map tool so the map camera moves to it. Never " +
  "invent — use Read/Glob/Grep to check. Prefer map.json + .forgeplan/ for " +
  "the big picture.";

/**
 * Builds the Agent SDK `options` object for a persistent onboarding session
 * rooted at `cwd` (the project root). Callers (bin/agent.mjs) MUST merge in
 * `mcpServers: { onboard: <per-connection server> }` before passing this to
 * `query()` — this module has no socket to relay tool calls through.
 */
export function buildOptions({ cwd }) {
  if (!cwd || typeof cwd !== "string") {
    throw new TypeError(
      "buildOptions({ cwd }) requires a non-empty string cwd",
    );
  }
  return {
    cwd,
    permissionMode: "default",
    allowedTools: [...ALLOWED_TOOLS],
    disallowedTools: [...DISALLOWED_TOOLS],
    systemPrompt: SYSTEM_PROMPT,
    // Token-level streaming: without this the SDK only yields a complete
    // `assistant` message per turn (one big text block), so the chat renders
    // in paragraph chunks instead of a live typewriter stream. With it,
    // `query()` also yields `stream_event` messages carrying Anthropic's raw
    // `content_block_delta` events — see bin/agent.mjs's message loop.
    includePartialMessages: true,
  };
}
