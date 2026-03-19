# GitHub Projects 初期セットアップガイド

セットアップのワークフローは COMMAND.md (Phase 3B) を参照。
このファイルは GraphQL ミューテーションとトラブルシューティングの詳細リファレンス。

## 前提条件

```bash
# 認証状態確認
gh auth status

# project スコープが必要な場合
gh auth refresh -s project
```

必要なスコープ: `repo`（Issue作成・編集）、`project`（Projects操作）

## GraphQL ミューテーション

フィールド作成・ビュー作成の GraphQL は `GRAPHQL.md` を参照。

## トラブルシューティング

| エラー | 原因 | 解決方法 |
|--------|------|----------|
| HTTP 401: Bad credentials | 認証切れ | `gh auth refresh -s project` |
| Resource not accessible | スコープ不足 | `gh auth refresh -s repo,project` |
| API rate limit exceeded | レート制限 | 待機後リトライ、バッチサイズ削減 |
| Field already exists | フィールド重複 | 既存フィールドを確認して使用 |

## 確認コマンド

```bash
# プロジェクト詳細確認
gh project view PROJECT_NUMBER --owner @me

# フィールド一覧（pm-project-fields.sh 使用推奨）
.claude/skills/pm-agent/scripts/pm-project-fields.sh \
  --project 1 --owner @me --list-fields
```
