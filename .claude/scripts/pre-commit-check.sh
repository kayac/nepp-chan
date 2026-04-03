#!/bin/zsh
# pre-commit-check.sh - PreToolUse hook: lint + build + doc update check before commit
#
# Runs before git commit to ensure code quality and documentation freshness.
# Exits non-zero to block the commit on failure.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

errors=()

# 1. Lint check (strict - no auto-fix)
echo "Running lint check..." >&2
if ! pnpm lint 2>&1; then
  errors+=("lint check failed")
fi

# 2. Format check (verify only, no write)
echo "Running format check..." >&2
if ! pnpm biome format . 2>&1; then
  errors+=("format check failed - run 'pnpm format' to fix")
fi

# 3. Web build check
echo "Running web build check..." >&2
if ! pnpm web:build 2>&1; then
  errors+=("web build failed")
fi

# 4. Documentation update reminder
# Check if staged changes affect areas that may require doc updates
staged_files=$(git diff --cached --name-only 2>/dev/null || true)
doc_reminder=false

while IFS= read -r file; do
  case "$file" in
    # New scripts or config changes
    package.json|*/package.json)
      doc_reminder=true ;;
    # Schema / DB changes
    */schema.ts|*/schema/*.ts|drizzle/*)
      doc_reminder=true ;;
    # New directories or structural changes
    server/src/mastra/*|server/src/services/*)
      doc_reminder=true ;;
    # Environment config
    *.env*|wrangler.toml|wrangler.jsonc)
      doc_reminder=true ;;
    # Knowledge files
    knowledge/*)
      doc_reminder=true ;;
  esac
done <<< "$staged_files"

if [[ "$doc_reminder" == "true" ]]; then
  echo "" >&2
  echo "=== DOCUMENTATION REMINDER ===" >&2
  echo "Staged changes may require documentation updates." >&2
  echo "Please check if CLAUDE.md or README.md need updating:" >&2
  echo "  - CLAUDE.md (project root)" >&2
  echo "  - server/CLAUDE.md" >&2
  echo "  - web/CLAUDE.md" >&2
  echo "===============================" >&2
fi

# Report errors
if [[ ${#errors[@]} -gt 0 ]]; then
  echo "" >&2
  echo "COMMIT BLOCKED: ${errors[*]}" >&2
  exit 1
fi

echo "All pre-commit checks passed." >&2
