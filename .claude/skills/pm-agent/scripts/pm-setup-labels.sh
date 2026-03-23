#!/bin/bash
# pm-setup-labels.sh - リポジトリ種別に応じたラベル作成
# Usage: pm-setup-labels.sh [owner/repo] [options]
#
# リポジトリ種別に応じてラベルを作成:
# - 個人リポジトリ: type:* ラベル（priority は Projects V2 フィールドで管理）
# - Organization リポジトリ: type ラベルなし（Issue Types を使用）、priority ラベルなし
#
# 冪等: 既存のラベルはスキップ。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
使い方: $0 [owner/repo] [オプション]

オプション:
  --force-labels         リポジトリ種別に関係なく全ラベルを作成（レガシーモード）
  --with-priority        priority:* ラベルも作成（非推奨）
  -h, --help             このヘルプを表示

リポジトリ種別ごとの動作:
  個人リポジトリ:       type:* ラベルのみ作成
  Organization リポジトリ: ラベル作成なし（代わりに Issue Types を使用）

priority は常に Projects V2 フィールドで管理し、ラベルは使用しません。
EOF
  exit 1
}

# デフォルト値
REPO=""
FORCE_LABELS=false
WITH_PRIORITY=false

# 引数の解析
while [[ $# -gt 0 ]]; do
  case $1 in
    --force-labels)
      FORCE_LABELS=true
      shift
      ;;
    --with-priority)
      WITH_PRIORITY=true
      shift
      ;;
    -h | --help) usage ;;
    -*)
      echo "不明なオプション: $1"
      usage
      ;;
    *)
      REPO="$1"
      shift
      ;;
  esac
done

REPO="${REPO:-$(get_repo)}"

# ラベル定義: 名前|色|説明
type_labels=(
  "type:epic|5319E7|マイルストーン"
  "type:feature|0052CC|機能要件"
  "type:story|00875A|ユーザーストーリー"
  "type:task|97A0AF|実装タスク"
  "type:bug|D73A4A|バグ修正"
)

priority_labels=(
  "priority:high|B60205|最優先"
  "priority:medium|FBCA04|通常"
  "priority:low|0E8A16|低優先度"
)

create_labels() {
  local created=0
  local skipped=0

  for item in "$@"; do
    IFS='|' read -r name color desc <<<"$item"
    if gh label create "$name" --color "$color" --description "$desc" --repo "$REPO" 2>/dev/null; then
      print_success "作成: $name"
      ((created++)) || true
    else
      print_skip "既存: $name"
      ((skipped++)) || true
    fi
  done

  echo "$created $skipped"
}

echo "═══════════════════════════════════════════════"
echo "📋 pm-setup-labels.sh"
echo "───────────────────────────────────────────────"
echo "  リポジトリ: $REPO"

# リポジトリ種別を判定
IS_ORG=false
if is_org_repo "$REPO"; then
  IS_ORG=true
  echo "  種別: 📋 Organization リポジトリ"
else
  echo "  種別: 👤 個人リポジトリ"
fi
echo "═══════════════════════════════════════════════"
echo ""

total_created=0
total_skipped=0

if [[ "$FORCE_LABELS" == true ]]; then
  # レガシーモード: すべてのラベルを作成
  echo "⚠️ 強制モード: すべてのラベルを作成します（レガシー動作）"
  echo ""

  echo "type:* ラベルを作成中..."
  read -r created skipped <<<"$(create_labels "${type_labels[@]}")"
  ((total_created += created))
  ((total_skipped += skipped))

  if [[ "$WITH_PRIORITY" == true ]]; then
    echo ""
    echo "priority:* ラベルを作成中..."
    read -r created skipped <<<"$(create_labels "${priority_labels[@]}")"
    ((total_created += created))
    ((total_skipped += skipped))
  fi

elif [[ "$IS_ORG" == true ]]; then
  # Organization リポジトリ
  echo "📋 Organization リポジトリを検出しました"
  echo ""
  echo "→ type:* ラベルは作成しません"
  echo "  代わりに GitHub Issue Types を使用してください:"
  echo "  Settings → Planning → Issue types"
  echo ""
  echo "→ priority は Projects V2 フィールドで管理します"
  echo ""

  # Issue Types の確認
  owner=$(get_repo_owner "$REPO")
  issue_types=$(get_org_issue_types "$owner")
  if [[ -n "$issue_types" ]]; then
    echo "✅ 利用可能な Issue Types:"
    echo "$issue_types" | while read -r t; do
      echo "   - $t"
    done
  else
    echo "⚠️ Issue Types が設定されていません"
    echo "   組織設定から Issue Types を作成してください"
  fi

  echo ""
  print_info "ラベル作成をスキップしました"

else
  # 個人リポジトリ
  echo "👤 個人リポジトリを検出しました"
  echo ""
  echo "→ type:* ラベルを作成します"
  echo "→ priority は Projects V2 フィールドで管理します"
  echo ""

  echo "type:* ラベルを作成中..."
  read -r created skipped <<<"$(create_labels "${type_labels[@]}")"
  ((total_created += created))
  ((total_skipped += skipped))

  if [[ "$WITH_PRIORITY" == true ]]; then
    echo ""
    echo "⚠️ --with-priority は非推奨です。代わりに Projects V2 フィールドを使用してください。"
    echo "priority:* ラベルを作成中..."
    read -r created skipped <<<"$(create_labels "${priority_labels[@]}")"
    ((total_created += created))
    ((total_skipped += skipped))
  fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "📊 結果サマリー"
echo "───────────────────────────────────────────────"
if [[ "$IS_ORG" == true ]] && [[ "$FORCE_LABELS" != true ]]; then
  echo "  モード: Organization（Issue Types 推奨）"
  echo "  作成したラベル: 0（スキップ）"
else
  echo "  作成したラベル: $total_created"
  echo "  スキップしたラベル: $total_skipped"
fi
echo "═══════════════════════════════════════════════"
