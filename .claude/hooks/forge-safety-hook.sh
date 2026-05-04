#!/usr/bin/env bash
# Forgeplan-recommended safety hook — blocks dangerous commands.
# PreToolUse on Bash. Reads tool input JSON from stdin. Exit 2 = block.
set -uo pipefail

INPUT="$(cat)"

CMD=""
if command -v jq >/dev/null 2>&1; then
  CMD="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
else
  CMD="$(printf '%s' "$INPUT" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
fi

[ -z "$CMD" ] && exit 0

block() {
  printf '%s\n' "FORGE-SAFETY: blocked — $1" >&2
  exit 2
}

case "$CMD" in
  *"rm -rf /"*|*"rm -rf /*"*)                         block "rm -rf at filesystem root" ;;
  *"git push --force"*|*"git push -f "*)              block "force push (use --force-with-lease and ask first)" ;;
  *"git reset --hard origin/main"*)                   block "destructive reset against main; use a feature branch" ;;
  *"git branch -D main"*|*"git branch -D master"*)    block "deleting protected branch" ;;
  *"npm publish"*|*"pnpm publish"*|*"yarn publish"*)  block "package publish (release flow only — confirm with user)" ;;
  *":(){:|:&};:"*)                                    block "fork bomb" ;;
  *"chmod -R 777 /"*)                                 block "chmod 777 at root" ;;
  *"--no-verify"*)                                    block "bypassing git hooks (--no-verify)" ;;
esac

exit 0
