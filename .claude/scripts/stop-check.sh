#!/bin/zsh
# stop-check.sh - Stop hook: warnings only (lint/format is handled per-edit by PostToolUse)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

STAMP_FILE="/tmp/.claude-stop-check-$(echo "$PROJECT_ROOT" | md5 -q)"

current_hash=$(git diff HEAD -- 2>/dev/null | md5 -q 2>/dev/null || echo "")

if [[ -z "$current_hash" || "$current_hash" == "$(cat "$STAMP_FILE" 2>/dev/null || echo "")" ]]; then
  exit 0
fi

changed_files=$(git diff --name-only HEAD -- 2>/dev/null || true)

# ─── Test File Reminder ──────────────────────────────────────
missing_tests=()
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) continue ;;
    *.d.ts) continue ;;
    */__tests__/*|*/test/*) continue ;;
  esac
  case "$file" in
    server/src/*.ts|web/src/*.ts|web/src/*.tsx)
      test_file="${file%.*}.test.${file##*.}"
      [[ ! -f "$test_file" ]] && missing_tests+=("$file")
      ;;
  esac
done <<< "$changed_files"

if [[ ${#missing_tests[@]} -gt 0 ]]; then
  echo "" >&2
  echo "⚠ TEST REMINDER: The following changed files have no co-located test:" >&2
  for f in "${missing_tests[@]}"; do
    echo "  - $f" >&2
  done
fi

echo "$current_hash" > "$STAMP_FILE"
