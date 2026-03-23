---
description: ナレッジ frontmatter 管理 - 付与・抽出・レビュー・適用
argument-hint: [add|extract|review|apply]
---

Use Skill tool to reference `np-knowledge` for detailed frontmatter field definitions, date_type rules, and workflow details.

## Quick Reference

| サブコマンド | 実行内容 |
|-------------|---------|
| `add` | `pnpm frontmatter:add` — title/category/subcategory/url を一括付与 |
| `extract` | `pnpm frontmatter:extract` — LLM 2パスで date/contact/date_type を抽出→TSV |
| `review` | 要レビューファイルを1件ずつエディタで確認（code + AskUserQuestion） |
| `apply` | `pnpm frontmatter:apply` — 抽出・レビュー結果を frontmatter に書き込み |

## Workflow

### add
1. `pnpm frontmatter:add -- --dry-run` でプレビュー
2. 確認後 `pnpm frontmatter:add` で実行
3. `--target=dataset` で dataset にも適用

### extract
1. `pnpm frontmatter:extract -- --dry-run` で10件サンプル
2. 確認後 `pnpm frontmatter:extract` で全件実行（バックグラウンド推奨）
3. サマリー（exact/estimated/observed/evergreen 分布）を表示

### review
要レビューファイル（`review/date-contact-needs-review.tsv`）を1件ずつ:

1. `code -r {ファイルパス}` でエディタに開く
2. AskUserQuestion で判定:
   - 承認（候補の日付で記録）
   - observed に変更（スクレイピング日を付与）
   - 日付を修正して承認
3. 次のファイルへ

### apply
1. `pnpm frontmatter:apply -- --dry-run` でプレビュー
2. 確認後 `pnpm frontmatter:apply -- --target=both` で実行
3. `git diff` で本文未変更を確認
