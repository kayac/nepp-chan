---
name: branch-start
description: >
  作業概要や PR/Issue 番号からブランチを作成する。
  ベースブランチの最新化・ブランチ命名・チェックアウトまでを一括で行う。
---

# Branch Start

作業概要や PR/Issue 番号をもとに、命名規則に沿ったブランチを作成する。

## 引数

| Args | Action |
|------|--------|
| テキスト | 作業概要からブランチ名を生成 |
| `#123` | PR #123 の情報を取得してブランチ名を生成 |
| `issue #45` | Issue #45 の情報を取得してブランチ名を生成 |

## 手順

### 1. ベースブランチの検出と最新化

```bash
BASE_BRANCH=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')
git fetch origin "$BASE_BRANCH"
git checkout "$BASE_BRANCH"
git pull origin "$BASE_BRANCH"
```

### 2. 入力の解析

#### テキスト（作業概要）の場合

入力テキストの内容からタイプとブランチ名を判断する。

| タイプ | 判断基準 |
|--------|----------|
| `feat` | 新しい機能の追加、実装 |
| `fix` | バグ修正、不具合対応 |
| `refactor` | リファクタリング、構造変更 |
| `docs` | ドキュメントの追加・修正 |
| `chore` | 設定変更、依存更新、CI 等 |
| `test` | テストの追加・修正 |
| `perf` | パフォーマンス改善 |

#### PR/Issue 番号の場合

```bash
gh pr view 123 --json title,body,labels
gh issue view 45 --json title,body,labels
```

PR/Issue のタイトルと内容からタイプとブランチ名を判断する。

### 3. ブランチ名の生成

**命名規則**: `{type}/{slug}`

- `slug` は英語のケバブケースで、作業内容を簡潔に表す（3〜5 単語）
- 日本語の入力は英語に変換する
- PR/Issue 番号がある場合: `{type}/{number}-{slug}`

**例**:

```
入力: ユーザー認証のAPIを追加 → feat/add-user-auth-api
入力: #123（ログイン画面のレイアウト崩れ） → fix/123-login-layout-broken
```

### 4. ユーザーに提案

以下の形式で提案し、承認を求める:

```
ブランチ名: feat/add-user-auth-api
ベース: develop

このブランチを作成しますか？
```

ユーザーが修正を指示した場合はブランチ名を調整する。

### 5. ブランチ作成・チェックアウト

```bash
git checkout -b "{branch_name}"
git status
```
