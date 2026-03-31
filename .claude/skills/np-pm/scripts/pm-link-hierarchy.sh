#!/bin/bash
# pm-link-hierarchy.sh - 子 Issue 関係の設定
# Usage: pm-link-hierarchy.sh <hierarchy.json> [--repo owner/repo]
#
# GitHub Issue 間の親子（子 Issue）関係を設定する。
# REST API を使用: POST /repos/{owner}/{repo}/issues/{parent}/sub_issues
#
# 参考: https://docs.github.com/en/rest/issues/sub-issues

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/pm-utils.sh"

usage() {
  cat <<EOF
使い方: $0 <hierarchy.json> [オプション]

オプション:
  --repo <owner/repo>    リポジトリ（デフォルト: 自動検出）
  --dry-run              関係を作成せずにプレビュー
  --force                新しい親を設定する前に既存の親を削除
  --verbose              詳細なエラーメッセージを表示
  -h, --help             このヘルプを表示

入力 JSON 形式:
[
  {"parent": 10, "children": [7, 8, 9]},
  {"parent": 11, "children": [10]}
]

階層の例（ボトムアップ）:
  Epic #12
  └── Feature #11
      └── Story #10
          ├── Task #7
          ├── Task #8
          └── Task #9

上記の JSON:
[
  {"parent": 10, "children": [7, 8, 9]},
  {"parent": 11, "children": [10]},
  {"parent": 12, "children": [11]}
]

動作:
  デフォルト: 既に親がある Issue はスキップ（安全）
  --force: 既存の親を削除して新しい親を設定（上書き）
EOF
  exit 1
}

# デフォルト値
HIERARCHY_FILE=""
REPO=""
DRY_RUN=false
FORCE=false
VERBOSE=false

# 引数の解析
while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --verbose | -v)
      VERBOSE=true
      shift
      ;;
    -h | --help) usage ;;
    -*)
      echo "不明なオプション: $1"
      usage
      ;;
    *)
      HIERARCHY_FILE="$1"
      shift
      ;;
  esac
done

# 入力の検証
[[ -z "$HIERARCHY_FILE" ]] && {
  echo "エラー: hierarchy.json は必須です"
  usage
}
[[ ! -f "$HIERARCHY_FILE" ]] && {
  echo "エラー: ファイルが見つかりません: $HIERARCHY_FILE"
  exit 1
}

# リポジトリを取得
REPO="${REPO:-$(get_repo)}"

echo "$REPO の Issue 階層を設定中..."
[[ "$DRY_RUN" == true ]] && echo "🔍 ドライランモード - 関係は作成されません"
[[ "$FORCE" == true ]] && echo "⚡ 強制モード - 既存の親は置き換えられます"
echo ""

success_count=0
skip_count=0
fail_count=0

while IFS= read -r relation; do
  parent=$(echo "$relation" | jq -r '.parent')
  children=$(echo "$relation" | jq -r '.children[]')

  for child in $children; do
    # 子 Issue に既に親があるか確認
    existing_parent=$(get_parent_issue "$REPO" "$child")

    if [[ "$DRY_RUN" == true ]]; then
      if [[ -n "$existing_parent" ]]; then
        echo "リンク予定: #$parent ← #$child（親 #$existing_parent あり）"
      else
        echo "リンク予定: #$parent ← #$child（子 Issue）"
      fi
      continue
    fi

    # 既存の親の処理
    if [[ -n "$existing_parent" ]]; then
      if [[ "$existing_parent" == "$parent" ]]; then
        # 同じ親に既にリンク済み - スキップ
        print_skip "#$child は既に #$parent にリンク済み"
        ((skip_count++)) || true
        continue
      elif [[ "$FORCE" == true ]]; then
        # 既存の親を削除して新しい親を設定
        print_info "#$child を親 #$existing_parent から削除中..."
        if remove_sub_issue "$REPO" "$existing_parent" "$child" 2>/dev/null; then
          print_success "#$child を #$existing_parent から削除しました"
        else
          print_warn "#$child の #$existing_parent からの削除に失敗しました"
          ((fail_count++)) || true
          continue
        fi
      else
        # デフォルト: 既に親がある Issue はスキップ
        print_skip "#$child（既に親 #$existing_parent あり）"
        ((skip_count++)) || true
        continue
      fi
    fi

    # 子 Issue 関係を設定
    error_output=""
    if error_output=$(add_sub_issue "$REPO" "$parent" "$child" 2>&1); then
      print_success "#$parent ← #$child（子 Issue）"
      ((success_count++)) || true
    else
      print_warn "失敗: #$parent ← #$child"
      if [[ "$VERBOSE" == true ]]; then
        echo "   └─ エラー: $error_output" >&2
      fi
      ((fail_count++)) || true
    fi
  done
done < <(jq -c '.[]' "$HIERARCHY_FILE")

echo ""
echo "═══════════════════════════════════════════════"
echo "📊 結果サマリー"
echo "───────────────────────────────────────────────"
if [[ "$DRY_RUN" == true ]]; then
  echo "  モード: ドライラン（関係は作成されていません）"
else
  echo "  成功: $success_count 件"
  [[ $skip_count -gt 0 ]] && echo "  スキップ: $skip_count 件（--force で上書き可能）"
  [[ $fail_count -gt 0 ]] && echo "  失敗: $fail_count 件"
fi
echo "═══════════════════════════════════════════════"

# GitHub Projects 向けのヒント
if [[ "$DRY_RUN" != true ]] && ((success_count > 0)); then
  echo ""
  print_info "ヒント: GitHub Projects で「Parent issue」と「Sub-issue progress」フィールドを有効にすると可視化できます"
fi

# スキップではなく実際の失敗がある場合のみエラー終了
if [[ $fail_count -gt 0 ]]; then
  if [[ "$VERBOSE" != true ]]; then
    echo ""
    print_info "ヒント: --verbose で詳細なエラーメッセージを表示できます"
  fi
  exit 1
fi
exit 0
