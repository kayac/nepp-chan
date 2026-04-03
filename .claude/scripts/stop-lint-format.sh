#!/bin/zsh
# stop-lint-format.sh - Stop hook: auto lint:fix & format on changed files
#
# Runs at the end of each Claude turn.
# Only executes if there are uncommitted file changes in the project.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Check for uncommitted changes (staged + unstaged, excluding untracked)
if git diff --quiet HEAD -- 2>/dev/null; then
  exit 0
fi

# Get changed file extensions to determine if lint/format is relevant
changed_files=$(git diff --name-only HEAD -- 2>/dev/null || true)
if [[ -z "$changed_files" ]]; then
  exit 0
fi

# Only run for code files
has_code_files=false
while IFS= read -r file; do
  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.astro|*.css)
      has_code_files=true
      break
      ;;
  esac
done <<< "$changed_files"

if [[ "$has_code_files" != "true" ]]; then
  exit 0
fi

echo "Running lint:fix & format on changed files..." >&2
pnpm lint:fix 2>/dev/null || true
pnpm format 2>/dev/null || true
