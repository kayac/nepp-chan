---
name: create-pr
description: "現在のブランチからプルリクエストを作成する。ベースブランチを最新化してから変更内容を確認し、PRを作成する。"
---

# Create Pull Request

現在のブランチからプルリクエストを作成する。

## 手順

### 0. ベースブランチの特定

```bash
BASE_BRANCH=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')
```

### 1. ベースブランチを最新化

```bash
git fetch origin "$BASE_BRANCH"
git rebase "origin/$BASE_BRANCH"
```

※ コンフリクトがあれば解決してから続行

### 2. 変更内容の確認

```bash
git status
git log "origin/$BASE_BRANCH..HEAD" --oneline
git diff "origin/$BASE_BRANCH...HEAD"
```

### 3. rebase 後の再検証

```bash
pnpm lint
pnpm web:build
```

rebase でベースブランチのコードが入るため、統合後の状態で再検証する。
失敗した場合は修正してコミットしてから続行。

### 4. ドキュメントの更新

変更内容に応じて CLAUDE.md / README.md の更新が必要か確認する。
変更があればコミットしてプッシュ。

### 5. プッシュ

```bash
git push
# rebase した場合は --force-with-lease を使用
git push --force-with-lease
```

### 6. PR作成

```bash
gh pr create --base "$BASE_BRANCH"
```

## PR テンプレート

```markdown
## Summary
- <変更内容の要約を箇条書きで記述>

## 主な変更内容
<技術的な詳細を記述>

## Test plan
- [ ] <テスト項目1>
- [ ] <テスト項目2>
```

## 注意事項

- タイトルは変更内容を簡潔に表現する（70文字以内）
- ベースブランチはリモートのデフォルトブランチを自動検出する
- PR 説明文に「Generated with Claude Code」は入れない
