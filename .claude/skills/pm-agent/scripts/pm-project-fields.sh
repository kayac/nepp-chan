#!/bin/bash
# pm-project-fields.sh - GitHub Projects カスタムフィールド値の更新
# Usage: pm-project-fields.sh <issue_number> [options]
#
# Issue を GitHub Project に追加し、カスタムフィールド値を更新する。
# Projects V2 の GraphQL API を使用。
#
# 参考: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
使い方: $0 <issue_number> [オプション]
       $0 --bulk <json_file> [オプション]

オプション:
  --repo <owner/repo>      リポジトリ（デフォルト: git remote から自動検出）
  --project <number>       プロジェクト番号（必須）
  --owner <login>          プロジェクトオーナー（@me でユーザー、または組織名）
  --status <value>         Status フィールドを設定
  --priority <value>       Priority フィールドを設定
  --size <value>           Size フィールドを設定
  --estimate <number>      Estimate フィールドを設定（数値）
  --iteration <name>       Iteration フィールドを設定
  --start-date <YYYY-MM-DD>   開始日を設定
  --target-date <YYYY-MM-DD>  目標日を設定
  --bulk <json_file>       JSON ファイルから一括更新
  --list-fields            利用可能なフィールドと選択肢を表示して終了
  --dry-run                実行せずに予定内容を表示
  -h, --help               このヘルプを表示

使用例:
  # 利用可能なフィールドを一覧表示
  $0 --project 1 --owner @me --list-fields

  # Issue をプロジェクトに追加してフィールドを設定
  $0 123 --project 1 --owner @me --status "In Progress" --priority "High"

  # 複数フィールドを設定
  $0 123 --project 1 --owner @me \\
    --status "Todo" --priority "Medium" --estimate 3 --start-date 2025-01-15

  # JSON ファイルから一括更新
  $0 --bulk issues-fields.json --project 1 --owner @me

一括更新 JSON 形式:
[
  {"issue": 123, "status": "Todo", "priority": "High", "estimate": 3},
  {"issue": 124, "status": "In Progress", "priority": "Medium"}
]
EOF
  exit 1
}

# デフォルト値
ISSUE_NUMBER=""
REPO=""
PROJECT_NUMBER=""
PROJECT_OWNER=""
STATUS_VALUE=""
PRIORITY_VALUE=""
SIZE_VALUE=""
ESTIMATE_VALUE=""
ITERATION_VALUE=""
START_DATE=""
TARGET_DATE=""
BULK_FILE=""
LIST_FIELDS=false
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
    --status)
      STATUS_VALUE="$2"
      shift 2
      ;;
    --priority)
      PRIORITY_VALUE="$2"
      shift 2
      ;;
    --size)
      SIZE_VALUE="$2"
      shift 2
      ;;
    --estimate)
      ESTIMATE_VALUE="$2"
      shift 2
      ;;
    --iteration)
      ITERATION_VALUE="$2"
      shift 2
      ;;
    --start-date)
      START_DATE="$2"
      shift 2
      ;;
    --target-date)
      TARGET_DATE="$2"
      shift 2
      ;;
    --bulk)
      BULK_FILE="$2"
      shift 2
      ;;
    --list-fields)
      LIST_FIELDS=true
      shift
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
      ISSUE_NUMBER="$1"
      shift
      ;;
  esac
done

# 必須引数の検証
[[ -z "$PROJECT_NUMBER" ]] && {
  echo "エラー: --project は必須です"
  usage
}
[[ -z "$PROJECT_OWNER" ]] && {
  echo "エラー: --owner は必須です"
  usage
}

REPO="${REPO:-$(get_repo)}"

# 単一選択フィールドを更新
update_single_select_field() {
  local project_id="$1" item_id="$2" field_id="$3" option_id="$4"
  local mutation='mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: {
        singleSelectOptionId: $optionId
      }
    }) {
      projectV2Item {
        id
      }
    }
  }'

  gh api graphql -f projectId="$project_id" -f itemId="$item_id" -f fieldId="$field_id" \
    -f optionId="$option_id" -f query="$mutation" --jq '.data.updateProjectV2ItemFieldValue.projectV2Item.id'
}

# 数値フィールドを更新
update_number_field() {
  local project_id="$1" item_id="$2" field_id="$3" value="$4"
  local mutation='mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: Float!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: {
        number: $value
      }
    }) {
      projectV2Item {
        id
      }
    }
  }'

  gh api graphql -f projectId="$project_id" -f itemId="$item_id" -f fieldId="$field_id" \
    -F value="$value" -f query="$mutation" --jq '.data.updateProjectV2ItemFieldValue.projectV2Item.id'
}

# 日付フィールドを更新
update_date_field() {
  local project_id="$1" item_id="$2" field_id="$3" date_value="$4"
  local mutation='mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: {
        date: $date
      }
    }) {
      projectV2Item {
        id
      }
    }
  }'

  gh api graphql -f projectId="$project_id" -f itemId="$item_id" -f fieldId="$field_id" \
    -f date="$date_value" -f query="$mutation" --jq '.data.updateProjectV2ItemFieldValue.projectV2Item.id'
}

find_field_id() {
  local fields_json="$1" field_name="$2"
  echo "$fields_json" | jq -r --arg fn "$field_name" '.[] | select(.name == $fn) | .id'
}

find_option_id() {
  local fields_json="$1" field_name="$2" option_name="$3"
  echo "$fields_json" | jq -r --arg fn "$field_name" --arg on "$option_name" '
    .[] | select(.name == $fn) | .options[]? | select(.name == $on) | .id
  '
}

# タイトルからイテレーション ID を検索（field_name 指定版）
find_iteration_id() {
  local fields_json="$1" field_name="$2" iteration_title="$3"
  echo "$fields_json" | jq -r --arg fn "$field_name" --arg it "$iteration_title" '
    .[] | select(.name == $fn) | .configuration.iterations[]? | select(.title == $it) | .id
  '
}

# メイン処理
echo "プロジェクト情報を取得中..."
PROJECT_ID=$(get_project_id "$PROJECT_OWNER" "$PROJECT_NUMBER")

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "エラー: オーナー $PROJECT_OWNER のプロジェクト #$PROJECT_NUMBER が見つかりません" >&2
  exit 1
fi

echo "  プロジェクト ID: $PROJECT_ID"

# フィールドを取得
FIELDS_JSON=$(get_project_fields "$PROJECT_ID")

# フィールド一覧モード
if [[ "$LIST_FIELDS" == true ]]; then
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📋 プロジェクト #$PROJECT_NUMBER の利用可能なフィールド"
  echo "═══════════════════════════════════════════════"
  echo ""
  echo "$FIELDS_JSON" | jq -r '
    .[] |
    "フィールド: \(.name)\n  ID: \(.id)\n  タイプ: \(.dataType)" +
    (if .options then "\n  選択肢:\n" + (.options | map("    - \(.name) (\(.id))") | join("\n")) else "" end) +
    (if .configuration.iterations then "\n  イテレーション:\n" + (.configuration.iterations | map("    - \(.title) (\(.id))") | join("\n")) else "" end) +
    "\n"
  '
  exit 0
fi

# フィールド ID を事前キャッシュ（Issue に依存しないため一度だけ検索）
FID_STATUS=$(find_field_id "$FIELDS_JSON" "Status")
FID_PRIORITY=$(find_field_id "$FIELDS_JSON" "Priority")
FID_SIZE=$(find_field_id "$FIELDS_JSON" "Size")
FID_ESTIMATE=$(find_field_id "$FIELDS_JSON" "Estimate")
FID_ITERATION=$(find_field_id "$FIELDS_JSON" "Iteration")
FID_START_DATE=$(find_field_id "$FIELDS_JSON" "Start date")
FID_TARGET_DATE=$(find_field_id "$FIELDS_JSON" "Target date")

# 単一 Issue のフィールド更新処理
# 引数: issue_number status priority size estimate iteration start_date target_date
process_issue() {
  local issue_num="$1"
  local p_status="$2"
  local p_priority="$3"
  local p_size="$4"
  local p_estimate="$5"
  local p_iteration="$6"
  local p_start="$7"
  local p_target="$8"

  local issue_node_id item_id option_id iteration_id

  # Issue のノード ID を取得
  issue_node_id=$(get_issue_node_id "$REPO" "$issue_num") || {
    print_warn "#$issue_num のノード ID の取得に失敗しました"
    return 1
  }

  # Issue をプロジェクトに追加
  item_id=$(add_issue_to_project "$PROJECT_ID" "$issue_node_id") || {
    print_warn "#$issue_num のプロジェクトへの追加に失敗しました"
    return 1
  }

  if [[ -z "$item_id" || "$item_id" == "null" ]]; then
    print_warn "#$issue_num のプロジェクトへの追加に失敗しました"
    return 1
  fi

  echo "  #$issue_num → プロジェクト（アイテム: ${item_id:0:20}...）"

  # Status を更新
  if [[ -n "$p_status" && -n "$FID_STATUS" ]]; then
    option_id=$(find_option_id "$FIELDS_JSON" "Status" "$p_status")
    if [[ -n "$option_id" ]]; then
      update_single_select_field "$PROJECT_ID" "$item_id" "$FID_STATUS" "$option_id" >/dev/null && \
        echo "    ↳ Status = $p_status"
    fi
  fi

  # Priority を更新
  if [[ -n "$p_priority" && -n "$FID_PRIORITY" ]]; then
    option_id=$(find_option_id "$FIELDS_JSON" "Priority" "$p_priority")
    if [[ -n "$option_id" ]]; then
      update_single_select_field "$PROJECT_ID" "$item_id" "$FID_PRIORITY" "$option_id" >/dev/null && \
        echo "    ↳ Priority = $p_priority"
    fi
  fi

  # Size を更新
  if [[ -n "$p_size" && -n "$FID_SIZE" ]]; then
    option_id=$(find_option_id "$FIELDS_JSON" "Size" "$p_size")
    if [[ -n "$option_id" ]]; then
      update_single_select_field "$PROJECT_ID" "$item_id" "$FID_SIZE" "$option_id" >/dev/null && \
        echo "    ↳ Size = $p_size"
    fi
  fi

  # Estimate を更新
  if [[ -n "$p_estimate" && -n "$FID_ESTIMATE" ]]; then
    update_number_field "$PROJECT_ID" "$item_id" "$FID_ESTIMATE" "$p_estimate" >/dev/null && \
      echo "    ↳ Estimate = $p_estimate"
  fi

  # Iteration を更新
  if [[ -n "$p_iteration" && -n "$FID_ITERATION" ]]; then
    iteration_id=$(find_iteration_id "$FIELDS_JSON" "Iteration" "$p_iteration")
    if [[ -n "$iteration_id" ]]; then
      update_iteration_field "$PROJECT_ID" "$item_id" "$FID_ITERATION" "$iteration_id" >/dev/null && \
        echo "    ↳ Iteration = $p_iteration"
    fi
  fi

  # 開始日を更新
  if [[ -n "$p_start" && -n "$FID_START_DATE" ]]; then
    update_date_field "$PROJECT_ID" "$item_id" "$FID_START_DATE" "$p_start" >/dev/null && \
      echo "    ↳ 開始日 = $p_start"
  fi

  # 目標日を更新
  if [[ -n "$p_target" && -n "$FID_TARGET_DATE" ]]; then
    update_date_field "$PROJECT_ID" "$item_id" "$FID_TARGET_DATE" "$p_target" >/dev/null && \
      echo "    ↳ 目標日 = $p_target"
  fi

  return 0
}

# 一括更新モード
if [[ -n "$BULK_FILE" ]]; then
  [[ ! -f "$BULK_FILE" ]] && {
    echo "エラー: 一括更新ファイルが見つかりません: $BULK_FILE"
    exit 1
  }

  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📋 一括更新モード"
  echo "───────────────────────────────────────────────"
  echo "  リポジトリ: $REPO"
  echo "  プロジェクト: #$PROJECT_NUMBER"
  echo "  入力ファイル: $BULK_FILE"
  [[ "$DRY_RUN" == true ]] && echo "  モード: ドライラン"
  echo "═══════════════════════════════════════════════"
  echo ""

  total_count=$(jq 'length' "$BULK_FILE")
  success_count=0
  fail_count=0

  if [[ "$DRY_RUN" == true ]]; then
    echo "$total_count 件の Issue を処理予定:"
    jq -r '.[] | "  #\(.issue): status=\(.status // "-"), priority=\(.priority // "-"), estimate=\(.estimate // "-")"' "$BULK_FILE"
    exit 0
  fi

  while IFS= read -r entry; do
    issue_num=$(echo "$entry" | jq -r '.issue')
    status=$(echo "$entry" | jq -r '.status // ""')
    priority=$(echo "$entry" | jq -r '.priority // ""')
    size=$(echo "$entry" | jq -r '.size // ""')
    estimate=$(echo "$entry" | jq -r '.estimate // ""')
    iteration=$(echo "$entry" | jq -r '.iteration // ""')
    start_date=$(echo "$entry" | jq -r '.start_date // .startDate // ""')
    target_date=$(echo "$entry" | jq -r '.target_date // .targetDate // ""')

    if process_issue "$issue_num" "$status" "$priority" "$size" "$estimate" "$iteration" "$start_date" "$target_date"; then
      ((success_count++)) || true
    else
      ((fail_count++)) || true
    fi
  done < <(jq -c '.[]' "$BULK_FILE")

  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📊 一括更新サマリー"
  echo "───────────────────────────────────────────────"
  echo "  合計: $total_count"
  echo "  成功: $success_count"
  echo "  失敗: $fail_count"
  echo "═══════════════════════════════════════════════"
  exit 0
fi

# 単一 Issue モード - Issue 番号の検証
[[ -z "$ISSUE_NUMBER" ]] && {
  echo "エラー: issue_number は必須です"
  usage
}

echo "  リポジトリ: $REPO"
echo "  Issue: #$ISSUE_NUMBER"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "🔍 ドライランモード - 変更は行われません"
  echo ""
  echo "実行予定:"
  echo "  1. Issue #$ISSUE_NUMBER をプロジェクトに追加"
  [[ -n "$STATUS_VALUE" ]] && echo "  2. Status = $STATUS_VALUE を設定"
  [[ -n "$PRIORITY_VALUE" ]] && echo "  3. Priority = $PRIORITY_VALUE を設定"
  [[ -n "$SIZE_VALUE" ]] && echo "  4. Size = $SIZE_VALUE を設定"
  [[ -n "$ESTIMATE_VALUE" ]] && echo "  5. Estimate = $ESTIMATE_VALUE を設定"
  [[ -n "$ITERATION_VALUE" ]] && echo "  6. Iteration = $ITERATION_VALUE を設定"
  [[ -n "$START_DATE" ]] && echo "  7. 開始日 = $START_DATE を設定"
  [[ -n "$TARGET_DATE" ]] && echo "  8. 目標日 = $TARGET_DATE を設定"
  exit 0
fi

if process_issue "$ISSUE_NUMBER" "$STATUS_VALUE" "$PRIORITY_VALUE" "$SIZE_VALUE" "$ESTIMATE_VALUE" "$ITERATION_VALUE" "$START_DATE" "$TARGET_DATE"; then
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "📊 結果サマリー"
  echo "───────────────────────────────────────────────"
  echo "  Issue #$ISSUE_NUMBER をプロジェクト #$PROJECT_NUMBER に追加しました"
  echo "═══════════════════════════════════════════════"
else
  echo ""
  echo "エラー: Issue #$ISSUE_NUMBER の処理に失敗しました" >&2
  exit 1
fi
