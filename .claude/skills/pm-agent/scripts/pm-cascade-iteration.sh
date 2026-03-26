#!/bin/bash
# pm-cascade-iteration.sh - 親 Issue から子 Issue へイテレーションを伝播
# Usage: pm-cascade-iteration.sh <parent_issue_number> [options]
#
# 親 Issue のイテレーションをすべての子 Issue に自動設定する。
# Projects V2 の GraphQL API と REST API（子 Issue 取得）を使用。
#
# 参考: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
使い方: $0 <parent_issue_number> [オプション]

親 Issue のイテレーションを子 Issue に伝播する。

オプション:
  --repo <owner/repo>      リポジトリ（デフォルト: git remote から自動検出）
  --project <number>       プロジェクト番号（必須）
  --owner <login>          プロジェクトオーナー（@me でユーザー、または組織名）
  --recursive              直接の子だけでなく全子孫に伝播
  --max-depth <N>          再帰モードの最大深度（デフォルト: 10）
  --dry-run                実行せずに予定内容を表示
  -h, --help               このヘルプを表示

使用例:
  # 直接の子 Issue のみに伝播
  $0 10 --project 1 --owner @me

  # 全子孫に伝播（Epic → Feature → Story → Task）
  $0 10 --project 1 --owner @me --recursive

  # 再帰モードでドライラン
  $0 10 --project 1 --owner @me --recursive --dry-run
EOF
  exit 1
}

# デフォルト値
PARENT_ISSUE=""
REPO=""
PROJECT_NUMBER=""
PROJECT_OWNER=""
RECURSIVE=false
MAX_DEPTH=10
DRY_RUN=false

# 引数の解析
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --project)
      PROJECT_NUMBER="$2"
      shift 2
      ;;
    --owner)
      PROJECT_OWNER="$2"
      shift 2
      ;;
    --recursive)
      RECURSIVE=true
      shift
      ;;
    --max-depth)
      MAX_DEPTH="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h | --help) usage ;;
    -*)
      echo "不明なオプション: $1"
      usage
      ;;
    *)
      PARENT_ISSUE="$1"
      shift
      ;;
  esac
done

# 必須引数の検証
[[ -z "$PARENT_ISSUE" ]] && {
  echo "エラー: parent_issue_number は必須です"
  usage
}
[[ -z "$PROJECT_NUMBER" ]] && {
  echo "エラー: --project は必須です"
  usage
}
[[ -z "$PROJECT_OWNER" ]] && {
  echo "エラー: --owner は必須です"
  usage
}

REPO="${REPO:-$(get_repo)}"

# 注: GraphQL 関数は pm-utils.sh に集約済み（DRY リファクタリング）
# 利用可能: get_project_id, get_project_fields, get_issue_iteration,
#            get_issue_node_id, add_issue_to_project, update_iteration_field,
#            find_iteration_field_id, get_child_issues, get_all_descendants

# ============================================================
# メイン処理
# ============================================================

echo ""
echo "═══════════════════════════════════════════════"
echo "📋 pm-cascade-iteration.sh"
echo "───────────────────────────────────────────────"
echo "  リポジトリ: $REPO"
echo "  プロジェクト: #$PROJECT_NUMBER"
echo "  親 Issue: #$PARENT_ISSUE"
[[ "$RECURSIVE" == true ]] && echo "  モード: 再帰（最大深度: $MAX_DEPTH）"
[[ "$DRY_RUN" == true ]] && echo "  モード: ドライラン"
echo "═══════════════════════════════════════════════"
echo ""

# ステップ 1: プロジェクト ID を取得
echo "プロジェクト情報を取得中..."
PROJECT_ID=$(get_project_id "$PROJECT_OWNER" "$PROJECT_NUMBER")

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "エラー: オーナー $PROJECT_OWNER のプロジェクト #$PROJECT_NUMBER が見つかりません" >&2
  exit 1
fi

# ステップ 2: プロジェクトフィールドを取得
FIELDS_JSON=$(get_project_fields "$PROJECT_ID")
ITERATION_FIELD_ID=$(find_iteration_field_id "$FIELDS_JSON")

if [[ -z "$ITERATION_FIELD_ID" || "$ITERATION_FIELD_ID" == "null" ]]; then
  echo "エラー: プロジェクト #$PROJECT_NUMBER に Iteration フィールドがありません" >&2
  exit 1
fi

# ステップ 3: 親 Issue のイテレーションを取得
echo "親 Issue #$PARENT_ISSUE のイテレーションを取得中..."
PARENT_ITERATION_JSON=$(get_issue_iteration "$REPO" "$PARENT_ISSUE" "$PROJECT_NUMBER")

PARENT_ITERATION_ID=$(echo "$PARENT_ITERATION_JSON" | jq -r '.iterationId // empty')
PARENT_ITERATION_TITLE=$(echo "$PARENT_ITERATION_JSON" | jq -r '.title // empty')
PARENT_ISSUE_TITLE=$(echo "$PARENT_ITERATION_JSON" | jq -r '.issueTitle // empty')

if [[ -z "$PARENT_ITERATION_ID" || "$PARENT_ITERATION_ID" == "null" ]]; then
  echo ""
  echo "エラー: 親 Issue #$PARENT_ISSUE にイテレーションが設定されていません" >&2
  echo "先に親 Issue のイテレーションを設定してください:" >&2
  echo "  pm-project-fields.sh $PARENT_ISSUE --project $PROJECT_NUMBER --owner $PROJECT_OWNER --iteration \"スプリント名\"" >&2
  exit 1
fi

echo "  親: #$PARENT_ISSUE - $PARENT_ISSUE_TITLE"
echo "  イテレーション: $PARENT_ITERATION_TITLE"
echo ""

# ステップ 4: 子 Issue を取得（直接 or 再帰）
if [[ "$RECURSIVE" == true ]]; then
  echo "全子孫を取得中（再帰）..."
  DESCENDANTS_JSON=$(get_all_descendants "$REPO" "$PARENT_ISSUE" "$MAX_DEPTH")
  TOTAL_COUNT=$(echo "$DESCENDANTS_JSON" | jq 'length')
else
  echo "子 Issue に伝播中..."
  DESCENDANTS_JSON=$(get_child_issues "$REPO" "$PARENT_ISSUE")
  TOTAL_COUNT=$(echo "$DESCENDANTS_JSON" | jq 'length')
fi

if [[ "$TOTAL_COUNT" -eq 0 ]]; then
  print_warn "#$PARENT_ISSUE の子 Issue が見つかりません"
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📊 結果サマリー"
  echo "───────────────────────────────────────────────"
  echo "  親: #$PARENT_ISSUE ($PARENT_ITERATION_TITLE)"
  echo "  子 Issue: 0 件"
  echo "═══════════════════════════════════════════════"
  exit 0
fi

echo "  処理対象: $TOTAL_COUNT 件"
echo ""

# ステップ 5: 各子 Issue を処理
updated_count=0
skipped_count=0
max_depth_reached=0

# 子 Issue 1件のイテレーション更新処理
process_child_iteration() {
  local item="$1"
  [[ -z "$item" ]] && return

  local sub_issue sub_issue_title
  sub_issue=$(echo "$item" | jq -r '.number')
  sub_issue_title=$(echo "$item" | jq -r '.title')

  # 子 Issue の現在のイテレーションを取得
  local sub_iteration_json sub_iteration_id sub_item_id
  sub_iteration_json=$(get_issue_iteration "$REPO" "$sub_issue" "$PROJECT_NUMBER")
  sub_iteration_id=$(echo "$sub_iteration_json" | jq -r '.iterationId // empty')
  sub_item_id=$(echo "$sub_iteration_json" | jq -r '.itemId // empty')

  # 同じイテレーションが既に設定されているか確認
  if [[ "$sub_iteration_id" == "$PARENT_ITERATION_ID" ]]; then
    print_skip "#$sub_issue: $sub_issue_title（既に $PARENT_ITERATION_TITLE）"
    ((skipped_count++)) || true
    return
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "  更新予定 #$sub_issue: $sub_issue_title → $PARENT_ITERATION_TITLE"
    ((updated_count++)) || true
    return
  fi

  # プロジェクトに未追加の場合は追加してからイテレーションを更新
  if [[ -z "$sub_item_id" || "$sub_item_id" == "null" ]]; then
    sub_item_id=$(ensure_project_item "$REPO" "$sub_issue" "$PROJECT_ID" "$PROJECT_NUMBER") || {
      print_warn "#$sub_issue のプロジェクトへの追加に失敗しました"
      return
    }
  fi

  if update_iteration_field "$PROJECT_ID" "$sub_item_id" "$ITERATION_FIELD_ID" "$PARENT_ITERATION_ID" >/dev/null 2>&1; then
    print_success "#$sub_issue: $sub_issue_title → $PARENT_ITERATION_TITLE"
    ((updated_count++)) || true
  else
    print_warn "#$sub_issue の更新に失敗しました"
  fi
}

# 深さレベルごとに処理（出力を見やすくするため）
if [[ "$RECURSIVE" == true ]]; then
  for depth in $(echo "$DESCENDANTS_JSON" | jq -r '.[].depth' | sort -u); do
    echo "レベル $depth:"
    max_depth_reached=$depth
    while IFS= read -r item; do
      process_child_iteration "$item"
    done < <(echo "$DESCENDANTS_JSON" | jq -c --argjson d "$depth" '.[] | select(.depth == $d)')
    echo ""
  done
else
  while IFS= read -r item; do
    process_child_iteration "$item"
  done < <(echo "$DESCENDANTS_JSON" | jq -c '.[]')
fi

# ステップ 6: サマリー
echo "═══════════════════════════════════════════════"
echo "📊 結果サマリー"
echo "───────────────────────────────────────────────"
echo "  親: #$PARENT_ISSUE ($PARENT_ITERATION_TITLE)"
echo "  更新: $updated_count 件"
echo "  スキップ: $skipped_count 件"
[[ "$RECURSIVE" == true ]] && echo "  到達した最大深度: $max_depth_reached"
echo "═══════════════════════════════════════════════"
