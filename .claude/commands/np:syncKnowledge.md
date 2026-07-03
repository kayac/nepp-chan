---
description: ナレッジ同期 - dataset/<version>/src/ → knowledge/ を rsync でミラーリング
argument-hint: [version]
---

Use Skill tool to reference `np-knowledge` for the full knowledge management pipeline.
For detailed sync workflow, rsync options, and itemize format, read `.claude/skills/np-knowledge/references/SYNC.md`.

## Quick Reference

```bash
# dry-run
rsync -rcn --delete --itemize-changes dataset/<version>/src/ knowledge/

# 実行
rsync -rc --delete dataset/<version>/src/ knowledge/
```

## Workflow

1. バージョン検出（引数 or AskUserQuestion）
2. dry-run で差分プレビュー（新規/更新/削除のサマリー）
3. ユーザー確認 → 実行
4. 結果報告（ファイル数、次のステップ案内）

## Constraints

- 必ず dry-run → 確認 → 実行の順
- 差分なしは「同期不要」で終了
- dataset 側は読み取り専用
