---
description: ナレッジRAG管理 - アップロード・リセット・同期・進捗追跡
argument-hint: [upload|clean|progress|status]
---

Use Skill tool to reference `np-knowledge` for the full knowledge management pipeline.
For detailed upload commands, environment config, progress tracking, and server-side files, see @references/UPLOAD.md in the np-knowledge skill.

## Quick Reference

| コマンド | 説明 |
|----------|------|
| `pnpm knowledge:upload:local` | ローカル環境にアップロード |
| `pnpm knowledge:upload:dev` | dev 環境にアップロード |
| `pnpm knowledge:upload:prd` | prd 環境にアップロード（要確認） |
| `pnpm knowledge:upload:<env> --clean` | Vectorize 全削除→再作成 |

## Workflow

### upload
環境を AskUserQuestion で確認 → `pnpm knowledge:upload:<env>` 実行。

### clean
環境を確認 → `pnpm knowledge:upload:<env> --clean` → `pnpm knowledge:upload:<env>` を順に実行。

### progress
1. `pnpm exec wrangler vectorize info nepp-chan-knowledge-<env>` — ベクター数
2. `pnpm exec wrangler queues info nepp-chan-knowledge-sync-<env>` — Queue 残量
3. Queue 0 → 完了、> 0 → 処理中

## Constraints

- prd は必ずユーザー確認
- `--clean` 実行前は必ず確認（Vectorize 全削除）
- .env の中身は表示しない
