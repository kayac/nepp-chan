#!/bin/zsh
# stop-check.sh - Stop hook: テスト不足・Plan 未完了を検出し、diff 状態ごとに1回だけ停止をブロックして指摘する
# 同一の diff 状態への再指摘はスタンプファイルで抑制する（対応不要と判断した場合は再停止でそのまま通る）

set -euo pipefail

input=$(cat)

# stop hook による継続中の再発火では何もしない（無限ループ防止）
stop_hook_active=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stop_hook_active', False))" 2>/dev/null || echo "False")
[[ "$stop_hook_active" == "True" ]] && exit 0

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

STAMP_FILE="/tmp/.claude-stop-check-$(echo "$PROJECT_ROOT" | md5 -q)"

current_hash=$(git diff HEAD -- 2>/dev/null | md5 -q 2>/dev/null || echo "")

if [[ -z "$current_hash" || "$current_hash" == "$(cat "$STAMP_FILE" 2>/dev/null || echo "")" ]]; then
  exit 0
fi

changed_files=$(git diff --name-only HEAD -- 2>/dev/null || true)

warnings=""

# ─── Test File Reminder ──────────────────────────────────────
missing_tests=()
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) continue ;;
    *.d.ts) continue ;;
    */__tests__/*|*/__mocks__/*|*/test/*) continue ;;
  esac
  case "$file" in
    server/src/*.ts|web/src/*.ts|web/src/*.tsx)
      test_file="${file%.*}.test.${file##*.}"
      [[ ! -f "$test_file" ]] && missing_tests+=("$file")
      ;;
  esac
done <<< "$changed_files"

if [[ ${#missing_tests[@]} -gt 0 ]]; then
  warnings+="TEST REMINDER: 以下の変更ファイルに co-located テストがありません:"$'\n'
  for f in "${missing_tests[@]}"; do
    warnings+="  - $f"$'\n'
  done
  warnings+="テストを追加するか、不要な理由（型定義のみ・coverage exclude 対象等）をユーザーに報告してください。"$'\n'
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
      warnings+="PLAN: $plan_file ($done_reqs/$total_reqs completed) 未完了項目:"$'\n'
      warnings+="$(grep -E '^\s*-\s*\[ \]' "$plan_file" 2>/dev/null | head -5)"$'\n'
      warnings+="進捗があればチェックを更新し、残項目は継続するかユーザーに報告してください。"$'\n'
    fi
  fi
fi

echo "$current_hash" > "$STAMP_FILE"

if [[ -n "$warnings" ]]; then
  printf '%s' "$warnings" >&2
  exit 2
fi
