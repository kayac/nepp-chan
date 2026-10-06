#!/bin/zsh
# post-edit-lint.sh - PostToolUse hook: 編集されたファイルに biome check --write
# Edit/Write は tool_input.file_path を、Bash は git の変更ファイル一覧を対象にする

set -euo pipefail

input=$(cat)

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

is_lintable() {
  case "$1" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.astro) return 0 ;;
    *) return 1 ;;
  esac
}

file_path=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")

targets=()
if [[ -n "$file_path" ]]; then
  [[ "$file_path" != "$PROJECT_ROOT"/* ]] && exit 0
  rel_path="${file_path#$PROJECT_ROOT/}"
  is_lintable "$rel_path" && [[ -f "$rel_path" ]] && targets+=("$rel_path")
else
  STAMP_FILE="/tmp/.claude-post-edit-lint-$(echo "$PROJECT_ROOT" | md5 -q)"
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    f="${line:3}"
    f="${f##* -> }"
    is_lintable "$f" && [[ -f "$f" ]] && targets+=("$f")
  done <<< "$(git status --porcelain --untracked-files=all 2>/dev/null || true)"
  [[ ${#targets[@]} -eq 0 ]] && exit 0
  state_hash() { stat -f '%m %z %N' "${targets[@]}" | md5 -q; }
  [[ "$(state_hash)" == "$(cat "$STAMP_FILE" 2>/dev/null || echo "")" ]] && exit 0
fi

[[ ${#targets[@]} -eq 0 ]] && exit 0

pnpm biome check --write "${targets[@]}" 2>&1 || true

[[ -n "${STAMP_FILE:-}" ]] && state_hash > "$STAMP_FILE"
exit 0
