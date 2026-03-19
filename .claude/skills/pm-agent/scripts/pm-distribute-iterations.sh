#!/bin/bash
# pm-distribute-iterations.sh - 子 Issue を複数イテレーションに振り分け
# 使い方: pm-distribute-iterations.sh <parent_issue_number> [オプション]
#
# 子 Issue（例: Epic 配下の Feature）を複数のイテレーションに振り分ける。
# オプションで子孫への伝播も可能。
#
# 参考: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
使い方: $0 <parent_issue_number> [オプション]

子 Issue を複数のイテレーションに振り分ける。

オプション:
  --repo <owner/repo>        リポジトリ（デフォルト: git remote から自動検出）
  --project <number>         プロジェクト番号（必須）
  --owner <login>            プロジェクトオーナー（@me でユーザー、または組織名）
  --iterations <list>        カンマ区切りのイテレーション名（必須）
                             例: "Sprint 1,Sprint 2,Sprint 3"
  --order <issue_numbers>    Issue の順序を指定（カンマ区切り）
                             例: "15,12,18,14,16,13"
  --cascade                  各 Issue の子孫にもイテレーションを伝播
  --list                     子 Issue を一覧表示して終了（計画用）
  --dry-run                  実行せずに予定内容を表示
  -h, --help                 このヘルプを表示

使用例:
  # Epic #10 配下の Feature を一覧表示
  $0 10 --project 1 --owner @me --list

  # Feature を 3 つのスプリントに振り分け
  $0 10 --project 1 --owner @me --iterations "Sprint 1,Sprint 2,Sprint 3"

  # カスタム順序で振り分け + 子孫にも伝播
  $0 10 --project 1 --owner @me \\
    --iterations "Sprint 1,Sprint 2,Sprint 3" \\
    --order "15,12,18,14,16,13" \\
    --cascade
EOF
  exit 1
}

# デフォルト値
PARENT_ISSUE=""
REPO=""
PROJECT_NUMBER=""
PROJECT_OWNER=""
ITERATIONS=""
CUSTOM_ORDER=""
CASCADE=false
LIST_ONLY=false
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
    --iterations)
      ITERATIONS="$2"
      shift 2
      ;;
    --order)
      CUSTOM_ORDER="$2"
      shift 2
      ;;
    --cascade)
      CASCADE=true
      shift
      ;;
    --list)
      LIST_ONLY=true
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

# ============================================================
# メイン処理
# ============================================================

echo ""
echo "═══════════════════════════════════════════════"
echo "📋 pm-distribute-iterations.sh"
echo "───────────────────────────────────────────────"
echo "  リポジトリ: $REPO"
echo "  プロジェクト: #$PROJECT_NUMBER"
echo "  親 Issue: #$PARENT_ISSUE"
[[ "$CASCADE" == true ]] && echo "  子孫への伝播: 有効"
[[ "$DRY_RUN" == true ]] && echo "  モード: ドライラン"
echo "═══════════════════════════════════════════════"
echo ""

# ステップ 1: プロジェクト ID とフィールドを取得
echo "プロジェクト情報を取得中..."
PROJECT_ID=$(get_project_id "$PROJECT_OWNER" "$PROJECT_NUMBER")

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "エラー: オーナー $PROJECT_OWNER のプロジェクト #$PROJECT_NUMBER が見つかりません" >&2
  exit 1
fi

FIELDS_JSON=$(get_project_fields "$PROJECT_ID")
ITERATION_FIELD_ID=$(find_iteration_field_id "$FIELDS_JSON")

if [[ -z "$ITERATION_FIELD_ID" || "$ITERATION_FIELD_ID" == "null" ]]; then
  echo "エラー: プロジェクト #$PROJECT_NUMBER に Iteration フィールドがありません" >&2
  exit 1
fi

# ステップ 2: 親 Issue の情報を取得
PARENT_TITLE=$(gh api "repos/$REPO/issues/$PARENT_ISSUE" --jq '.title' 2>/dev/null || echo "不明")
echo "  親: #$PARENT_ISSUE - $PARENT_TITLE"
echo ""

# ステップ 3: 子 Issue を取得
CHILDREN_JSON=$(get_child_issues "$REPO" "$PARENT_ISSUE")
CHILD_COUNT=$(echo "$CHILDREN_JSON" | jq 'length')

if [[ "$CHILD_COUNT" -eq 0 ]]; then
  echo "エラー: #$PARENT_ISSUE の子 Issue が見つかりません" >&2
  exit 1
fi

echo "$CHILD_COUNT 件の子 Issue が見つかりました:"
echo ""

# 子 Issue を表示
idx=1
while IFS= read -r item; do
  num=$(echo "$item" | jq -r '.number')
  title=$(echo "$item" | jq -r '.title')
  echo "  $idx. #$num - $title"
  ((idx++)) || true
done < <(echo "$CHILDREN_JSON" | jq -c 'sort_by(.number) | .[]')

echo ""

# 一覧表示のみモード
if [[ "$LIST_ONLY" == true ]]; then
  echo "--order でカスタム順序を指定できます。例:"
  echo "  --order \"$(echo "$CHILDREN_JSON" | jq -r '[.[].number] | join(",")')\""
  exit 0
fi

# イテレーションの検証
if [[ -z "$ITERATIONS" ]]; then
  echo "エラー: --iterations は必須です" >&2
  echo ""
  echo "利用可能なイテレーション:"
  get_available_iterations "$FIELDS_JSON" | while read -r iter; do
    echo "  - $iter"
  done
  exit 1
fi

# イテレーションを配列にパース
IFS=',' read -ra ITERATION_NAMES <<<"$ITERATIONS"
ITERATION_COUNT=${#ITERATION_NAMES[@]}

echo "振り分け計画:"
echo "  $CHILD_COUNT 件の Issue → $ITERATION_COUNT 個のイテレーション"
echo ""

# Issue の順序リストを構築
if [[ -n "$CUSTOM_ORDER" ]]; then
  IFS=',' read -ra ORDERED_ISSUES <<<"$CUSTOM_ORDER"
  echo "カスタム順序を使用: $CUSTOM_ORDER"
else
  # デフォルト: Issue 番号でソート
  # 注: macOS bash 3.x 互換性のため mapfile ではなく while ループを使用
  ORDERED_ISSUES=()
  while IFS= read -r num; do
    ORDERED_ISSUES+=("$num")
  done < <(echo "$CHILDREN_JSON" | jq -r '.[].number' | sort -n)
  echo "デフォルト順序を使用（Issue 番号順）"
fi

echo ""

# 振り分けの計算
CHUNK_SIZE=$(((${#ORDERED_ISSUES[@]} + ITERATION_COUNT - 1) / ITERATION_COUNT))

# イテレーションの存在確認 + ID キャッシュ
declare -a ITERATION_IDS=()
for iter_name in "${ITERATION_NAMES[@]}"; do
  iter_name=$(echo "$iter_name" | xargs) # 前後の空白を除去
  iter_id=$(find_iteration_id_by_title "$FIELDS_JSON" "$iter_name")
  if [[ -z "$iter_id" || "$iter_id" == "null" ]]; then
    echo "エラー: イテレーション '$iter_name' がプロジェクトに見つかりません" >&2
    echo ""
    echo "利用可能なイテレーション:"
    get_available_iterations "$FIELDS_JSON" | while read -r iter; do
      echo "  - $iter"
    done
    exit 1
  fi
  ITERATION_IDS+=("$iter_id")
done

# 振り分け計画を表示
echo "振り分け内容:"
for ((i = 0; i < ITERATION_COUNT; i++)); do
  iter_name=$(echo "${ITERATION_NAMES[$i]}" | xargs)
  start=$((i * CHUNK_SIZE))
  end=$((start + CHUNK_SIZE))
  if [[ $end -gt ${#ORDERED_ISSUES[@]} ]]; then
    end=${#ORDERED_ISSUES[@]}
  fi

  if [[ $start -lt ${#ORDERED_ISSUES[@]} ]]; then
    issues_in_iter=("${ORDERED_ISSUES[@]:$start:$((end - start))}")
    echo "  $iter_name: ${issues_in_iter[*]}"
  else
    echo "  $iter_name: (なし)"
  fi
done

echo ""

# ドライランモード
if [[ "$DRY_RUN" == true ]]; then
  echo "ドライラン - 変更は行われていません"
  exit 0
fi

# 振り分けを実行
echo "振り分けを実行中..."
echo ""

updated_count=0
cascade_count=0

for ((i = 0; i < ITERATION_COUNT; i++)); do
  iter_name=$(echo "${ITERATION_NAMES[$i]}" | xargs)
  iter_id="${ITERATION_IDS[$i]}"

  start=$((i * CHUNK_SIZE))
  end=$((start + CHUNK_SIZE))
  if [[ $end -gt ${#ORDERED_ISSUES[@]} ]]; then
    end=${#ORDERED_ISSUES[@]}
  fi

  for ((j = start; j < end; j++)); do
    issue_num="${ORDERED_ISSUES[$j]}"
    issue_title=$(echo "$CHILDREN_JSON" | jq -r --argjson n "$issue_num" '.[] | select(.number == $n) | .title')

    # プロジェクトへの追加を保証し、イテレーションを更新
    if ensure_and_update_iteration "$REPO" "$issue_num" "$PROJECT_ID" "$PROJECT_NUMBER" "$ITERATION_FIELD_ID" "$iter_id"; then
      print_success "#$issue_num: $issue_title → $iter_name"
      ((updated_count++)) || true
    else
      print_warn "#$issue_num のイテレーション設定に失敗しました"
      continue
    fi

    # 子孫への伝播（有効な場合）
    if [[ "$CASCADE" == true ]]; then
      descendants=$(get_all_descendants "$REPO" "$issue_num" 10)
      desc_count=$(echo "$descendants" | jq 'length')

      if [[ "$desc_count" -gt 0 ]]; then
        while IFS= read -r desc; do
          [[ -z "$desc" ]] && continue

          desc_num=$(echo "$desc" | jq -r '.number')
          desc_title=$(echo "$desc" | jq -r '.title')

          if ensure_and_update_iteration "$REPO" "$desc_num" "$PROJECT_ID" "$PROJECT_NUMBER" "$ITERATION_FIELD_ID" "$iter_id"; then
            echo "    └── #$desc_num: $desc_title → $iter_name"
            ((cascade_count++)) || true
          fi
        done < <(echo "$descendants" | jq -c '.[]')
      fi
    fi
  done
done

# 結果サマリー
echo ""
echo "═══════════════════════════════════════════════"
echo "📊 結果サマリー"
echo "───────────────────────────────────────────────"
echo "  親: #$PARENT_ISSUE"
echo "  振り分け済み: $updated_count 件"
[[ "$CASCADE" == true ]] && echo "  子孫への伝播: $cascade_count 件"
echo "  使用イテレーション数: $ITERATION_COUNT"
echo "═══════════════════════════════════════════════"
