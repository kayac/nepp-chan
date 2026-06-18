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

# ─── Plan Compliance ─────────────────────────────────────────
current_branch=$(git branch --show-current 2>/dev/null || echo "")
if [[ -n "$current_branch" && -d ".brain/plans" ]]; then
  plan_slug=$(echo "$current_branch" | tr '/' '-')
  plan_file=$(find .brain/plans -maxdepth 1 -name "*${plan_slug}*" -type f 2>/dev/null | head -1)

  if [[ -n "$plan_file" ]]; then
    total_reqs=$(grep -cE '^\s*-\s*\[[ x]\]' "$plan_file" 2>/dev/null || echo "0")
    done_reqs=$(grep -cE '^\s*-\s*\[x\]' "$plan_file" 2>/dev/null || echo "0")

    if [[ "$total_reqs" -gt 0 && "$done_reqs" -lt "$total_reqs" ]]; then
      echo "" >&2
      echo "📋 PLAN: $plan_file ($done_reqs/$total_reqs completed)" >&2
      grep -E '^\s*-\s*\[ \]' "$plan_file" 2>/dev/null | head -5 | while IFS= read -r line; do
        echo "  $line" >&2
      done
    fi
  fi
fi

echo "$current_hash" > "$STAMP_FILE"
