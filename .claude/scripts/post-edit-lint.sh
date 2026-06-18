#!/bin/zsh
# post-edit-lint.sh - PostToolUse hook: biome check on edited file

set -euo pipefail

input=$(cat)

file_path=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

[[ -z "$file_path" ]] && exit 0

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.astro)
    ;;
  *)
    exit 0
    ;;
esac

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

rel_path="${file_path#$PROJECT_ROOT/}"
[[ ! -f "$rel_path" ]] && exit 0

pnpm biome check --write "$rel_path" 2>&1 || true
