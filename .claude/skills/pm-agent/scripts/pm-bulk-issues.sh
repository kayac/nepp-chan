#!/bin/bash
# pm-bulk-issues.sh - Issue の一括作成（チェックポイント付き）
# Usage: pm-bulk-issues.sh <issues.json> [--repo owner/repo] [--milestone N] [--dry-run]
#
# JSON ファイルから複数の GitHub Issue を一括作成する。
# 機能:
#   - エラー復旧用チェックポイント（冪等性）
#   - ドライランモードでプレビュー
#   - レート制限対策付きバッチ処理
#   - REST API によるマイルストーン割り当て

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
使い方: $0 <issues.json> [オプション]

オプション:
  --repo <owner/repo>    リポジトリ（デフォルト: 自動検出）
  --milestone <N>        割り当てるマイルストーン番号
  --dry-run              Issue を作成せずにプレビュー
  --checkpoint <file>    チェックポイントファイルのパス（デフォルト: /tmp/claude/pm-checkpoint.json）
  --batch-size <N>       バッチあたりの Issue 数（デフォルト: 20）
  --delay <sec>          バッチ間の待機秒数（デフォルト: 1）
  -h, --help             このヘルプを表示

入力 JSON 形式:
[
  {"title": "タスク名", "body": "説明", "type": "task", "labels": ["other-label"]}
]

タイプの扱い（リポジトリ種別に応じた動作）:
  - Organization リポジトリ: "type" フィールドで Issue Type を API 経由で設定
  - 個人リポジトリ: "type" フィールドを "type:<value>" ラベルとして付与
  - "labels" 配列のラベルは常に適用される
EOF
  exit 1
}

# デフォルト値
ISSUES_FILE=""
REPO=""
MILESTONE=""
DRY_RUN=false
BATCH_SIZE=20
DELAY_SEC=1
CHECKPOINT_FILE="/tmp/claude/pm-checkpoint.json"

# 引数の解析
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --milestone)
      MILESTONE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --checkpoint)
      CHECKPOINT_FILE="$2"
      shift 2
      ;;
    --batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    --delay)
      DELAY_SEC="$2"
      shift 2
      ;;
    -h | --help) usage ;;
    -*)
      echo "不明なオプション: $1"
      usage
      ;;
    *)
      ISSUES_FILE="$1"
      shift
      ;;
  esac
done

# 入力の検証
[[ -z "$ISSUES_FILE" ]] && {
  echo "エラー: issues.json は必須です"
  usage
}
[[ ! -f "$ISSUES_FILE" ]] && {
  echo "エラー: ファイルが見つかりません: $ISSUES_FILE"
  exit 1
}

# リポジトリを取得
REPO="${REPO:-$(get_repo)}"

# チェックポイントディレクトリの確保
mkdir -p "$(dirname "$CHECKPOINT_FILE")"

echo "═══════════════════════════════════════════════"
echo "📋 pm-bulk-issues.sh"
echo "───────────────────────────────────────────────"
echo "  リポジトリ: $REPO"

# リポジトリ種別の検出
IS_ORG=false
if is_org_repo "$REPO"; then
  IS_ORG=true
  echo "  種別: 📋 Organization（API 経由で Issue Type を設定）"
else
  echo "  種別: 👤 個人リポジトリ（type:* ラベル）"
fi
echo "═══════════════════════════════════════════════"
echo ""

[[ "$DRY_RUN" == true ]] && echo "🔍 ドライランモード - Issue は作成されません"
echo ""

created_issues=()
skipped_count=0
count=0

while IFS= read -r issue; do
  # JSON から値を取得
  raw_title=$(echo "$issue" | jq -r '.title')
  raw_body=$(echo "$issue" | jq -r '.body // ""')
  issue_type=$(echo "$issue" | jq -r '.type // ""')
  raw_labels=$(echo "$issue" | jq -r '.labels // [] | join(",")')

  # 入力の検証とサニタイズ
  if [[ -z "$raw_title" ]] || [[ "$raw_title" == "null" ]]; then
    print_warn "タイトルが空の Issue をスキップします"
    continue
  fi
  title=$(sanitize_string "$raw_title" 256)
  if [[ -z "$title" ]]; then
    print_warn "タイトルが無効な Issue をスキップします"
    continue
  fi

  body=""
  if [[ -n "$raw_body" ]] && [[ "$raw_body" != "null" ]]; then
    body=$(sanitize_markdown "$raw_body" 65536)
  fi

  labels=""
  if [[ -n "$raw_labels" ]] && validate_labels "$raw_labels"; then
    labels="$raw_labels"
  elif [[ -n "$raw_labels" ]]; then
    print_warn "ラベル形式が不正です。ラベルをスキップします"
  fi

  if [[ -n "$issue_type" ]] && ! validate_issue_type "$issue_type"; then
    print_warn "無効な Issue タイプ: $issue_type"
    issue_type=""
  fi

  # チェックポイント確認（冪等性）
  if is_already_created "$CHECKPOINT_FILE" "$title"; then
    print_skip "スキップ（作成済み）: $title"
    ((skipped_count++)) || true
    continue
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "作成予定: $title"
    [[ -n "$labels" ]] && echo "  └─ ラベル: $labels"
    [[ -n "$MILESTONE" ]] && echo "  └─ マイルストーン: #$MILESTONE"
    continue
  fi

  # gh issue create の引数を構築
  args=(--repo "$REPO" --title "$title")
  [[ -n "$body" ]] && args+=(--body "$body")

  # リポジトリ種別に応じた type フィールドの処理
  final_labels="$labels"
  if [[ -n "$issue_type" ]] && [[ "$IS_ORG" == false ]]; then
    # 個人リポジトリ: type をラベルとして追加
    if [[ -n "$final_labels" ]]; then
      final_labels="type:$issue_type,$final_labels"
    else
      final_labels="type:$issue_type"
    fi
  fi
  [[ -n "$final_labels" ]] && args+=(--label "$final_labels")

  # Issue を作成
  if url=$(gh issue create "${args[@]}"); then
    number=$(extract_issue_number "$url")

    print_success "作成 #$number: $title"
    created_issues+=("$number")

    # チェックポイントに保存
    save_checkpoint "$CHECKPOINT_FILE" "$number" "$title"

    # Organization リポジトリの場合、REST API で Issue Type を設定
    if [[ -n "$issue_type" ]] && [[ "$IS_ORG" == true ]]; then
      if set_issue_type "$REPO" "$number" "$issue_type" 2>/dev/null; then
        echo "   ↳ Issue Type: $issue_type"
      else
        print_warn "#$number の Issue Type '$issue_type' の設定に失敗しました"
      fi
    fi

    # マイルストーンの割り当て（指定時）
    if [[ -n "$MILESTONE" ]]; then
      if assign_milestone "$REPO" "$number" "$MILESTONE" 2>/dev/null; then
        echo "   ↳ マイルストーン #$MILESTONE に割り当て済み"
      else
        print_warn "#$number へのマイルストーン #$MILESTONE の割り当てに失敗しました"
      fi
    fi
  else
    print_warn "作成失敗: $title"
  fi

  # レート制限対策のバッチ遅延
  ((count++)) || true
  if ((count % BATCH_SIZE == 0)); then
    print_wait "バッチ完了（$count 件）、${DELAY_SEC}秒待機中..."
    sleep "$DELAY_SEC"
  fi
done < <(jq -c '.[]' "$ISSUES_FILE")

echo ""
echo "═══════════════════════════════════════════════"
echo "📊 結果サマリー"
echo "───────────────────────────────────────────────"
if [[ "$DRY_RUN" == true ]]; then
  echo "  モード: ドライラン（Issue は作成されていません）"
else
  echo "  作成: ${#created_issues[@]} 件"
  echo "  スキップ: $skipped_count 件"
  echo "  チェックポイント: $CHECKPOINT_FILE"
fi
echo "═══════════════════════════════════════════════"

# 後続処理用に作成した Issue 番号を出力
if [[ ${#created_issues[@]} -gt 0 ]]; then
  echo ""
  print_info "作成した Issue 番号: ${created_issues[*]}"
fi
