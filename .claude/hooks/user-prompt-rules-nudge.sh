#!/usr/bin/env bash
# UserPromptSubmit hook — when the user's prompt mentions risky keywords,
# inject a tiny nudge pointing to the relevant rule. Stays under 200 chars.
set -uo pipefail

INPUT="$(cat)"
PROMPT=""
if command -v jq >/dev/null 2>&1; then
  PROMPT="$(printf '%s' "$INPUT" | jq -r '.prompt // empty')"
fi

low="$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')"

NUDGE=""
case "$low" in
  *"publish"*|*"release"*|*"npm publish"*)
    NUDGE="Reminder: \`npm publish\` is deny-listed. Confirm with user; tag a release commit, then publish manually." ;;
  *"host project"*|*"user's project"*|*"package.json"*|*".gitignore"*)
    case "$low" in
      *"modify"*|*"edit"*|*"write"*|*"update"*|*"add"*)
        NUDGE="Reminder: rule 20 — \`init\` writes only to \`.forgeplan-web/\`; never touch host package.json or .gitignore." ;;
    esac ;;
  *"endpoint"*|*"/api/"*|*"sveltekit"*|*"+server"*)
    NUDGE="Reminder: rule 22 — /api/* endpoints are read-only proxies; no mutating forgeplan subcommands." ;;
  *"template/"*|*"scaffold"*)
    NUDGE="Reminder: rule 21 — template/ must be copy-safe (no symlinks, no absolute paths, no host references)." ;;
  *"forgeplan"*)
    NUDGE="Reminder: parse the \`Next:\`/\`Or:\`/\`Wait:\`/\`Done.\`/\`Fix:\` marker on every forgeplan output and run it verbatim." ;;
esac

[ -z "$NUDGE" ] && exit 0

printf '%s' "$(python3 -c "
import json,sys
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'UserPromptSubmit',
    'additionalContext': '$NUDGE'
  }
}))")"
