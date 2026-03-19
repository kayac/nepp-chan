#!/bin/bash
# pm-security.sh - PM Agent 用セキュリティバリデーション関数
#
# .claude/scripts/security-utils.sh から必要な関数をスキル内にバンドル。
# pm-agent スクリプトが使用する関数のみ含む。
#
# 使用方法: source pm-security.sh

set -euo pipefail

# ============================================================
# 入力サニタイズ
# ============================================================

# シェル安全な文字列にサニタイズ（タイトル、ラベル等）
# シェルメタ文字を除去: $ ` ; | & ( ) { } [ ] < > \ " '
# 保持: 英数字、スペース、改行、一般的な記号
# 使用方法: safe=$(sanitize_string "$input" [最大長])
sanitize_string() {
  local input="$1"
  local max_length="${2:-4096}"

  [[ -z "$input" ]] && return 0

  if [[ ${#input} -gt $max_length ]]; then
    input="${input:0:$max_length}"
  fi

  printf '%s' "$input" | tr -cd '[:alnum:] _.,:/@#\n-'
}

# Markdown コンテンツのサニタイズ（Issue body 用）
# Markdown 書式文字を保持: ()[]{}*!~>+=|#_`$\n 等
# ANSI エスケープとヌルバイトのみ除去
# 使用方法: safe_body=$(sanitize_markdown "$input" [最大長])
sanitize_markdown() {
  local input="$1"
  local max_length="${2:-65536}"

  [[ -z "$input" ]] && return 0

  if [[ ${#input} -gt $max_length ]]; then
    input="${input:0:$max_length}"
  fi

  # ANSI エスケープシーケンスとヌルバイトを除去、Markdown 書式はすべて保持
  printf '%s' "$input" | sed $'s/\x1b\\[[0-9;]*[a-zA-Z]//g' | tr -d '\000'
}

# ============================================================
# 入力バリデーション
# ============================================================

# GitHub リポジトリ形式を検証（owner/repo）
# 使用方法: validate_repo "owner/repo" && echo "有効"
validate_repo() {
  local repo="$1"
  [[ "$repo" =~ ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$ ]]
}

# 正の整数を検証
# 使用方法: validate_number "123" && echo "有効"
validate_number() {
  local num="$1"
  [[ "$num" =~ ^[0-9]+$ ]]
}

# ISO8601 日付を検証（YYYY-MM-DD）
# 使用方法: validate_date "2025-12-28" && echo "有効"
validate_date() {
  local date="$1"
  [[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]
}

# ラベル形式を検証（英数字、ハイフン、アンダースコア、コロン、カンマ）
# 使用方法: validate_labels "bug,priority:high" && echo "有効"
validate_labels() {
  local labels="$1"
  [[ -z "$labels" ]] && return 0
  [[ "$labels" =~ ^[a-zA-Z0-9_:,\ -]+$ ]]
}

# Issue タイプを許可値に対して検証
# 使用方法: validate_issue_type "task" && echo "有効"
validate_issue_type() {
  local type="$1"
  [[ -z "$type" ]] && return 0
  [[ "$type" =~ ^(task|bug|feature|epic|story|enhancement|documentation)$ ]]
}
