#!/usr/bin/env bash
# PostToolUse for Write|Edit — best-effort format edited files in-place.
# Reads tool input JSON from stdin; non-blocking — never fails the tool call.
set -uo pipefail

INPUT="$(cat)"

FILE=""
if command -v jq >/dev/null 2>&1; then
  FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
else
  FILE="$(printf '%s' "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
fi

[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.svelte|*.json|*.md|*.css)
    if command -v npx >/dev/null 2>&1; then
      npx --no-install prettier --write "$FILE" >/dev/null 2>&1 || true
    fi
    ;;
  *.sh)
    if command -v shfmt >/dev/null 2>&1; then
      shfmt -w "$FILE" >/dev/null 2>&1 || true
    fi
    ;;
esac

exit 0
