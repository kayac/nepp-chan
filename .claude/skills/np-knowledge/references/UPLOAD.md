# Upload リファレンス - R2/Vectorize アップロード

## ナレッジ構造

```
knowledge/
├── villotoinep/    ← 音威子府村公式サイトデータ
├── otoko/          ← 音威子府高校データ
└── welcome-guide.md ← ウェルカムガイド
```

R2 キーはディレクトリ構造を保持する（例: `villotoinep/kurashi/gomi_kankyou/gomi_calendar.md`）。

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `pnpm knowledge:upload:local` | ローカル環境にアップロード |
| `pnpm knowledge:upload:dev` | dev 環境にアップロード |
| `pnpm knowledge:upload:prd` | prd 環境にアップロード |
| `pnpm knowledge:upload:<env> --file=foo.md` | 特定ファイルのみ |
| `pnpm knowledge:upload:<env> --clean` | Vectorize 全削除→再作成（R2/D1 に影響なし） |

## 管理API（ローカルDevサーバー経由）

| エンドポイント | 説明 |
|---------------|------|
| `POST /admin/knowledge/sync` | R2 バケット全体を Vectorize に再同期 |
| `DELETE /admin/knowledge` | Vectorize の全ナレッジを削除 |
| `PUT /admin/knowledge/files/{key}` | 単一ファイルをアップロード→同期 |
| `POST /admin/knowledge/convert` | PDF/画像 → Markdown 変換後アップロード |

## 環境の向き先

| 環境 | R2 バケット | Vectorize インデックス |
|------|-------------|----------------------|
| local | `nepp-chan-knowledge-local` | `nepp-chan-knowledge-local` |
| dev | `nepp-chan-knowledge-dev` | `nepp-chan-knowledge-dev` |
| prd | `nepp-chan-knowledge-prd` | `nepp-chan-knowledge-prd` |

**向き先は `--env` で決まり、バケット名とインデックス名は `scripts/upload-knowledge.ts` の定数。** `--clean` は Vectorize のみ影響（D1/会話履歴/ユーザーデータに影響なし）。

## 進捗追跡

R2 アップロード後、ベクタライズは非同期（Queue → Worker → Vectorize）で処理される。

### 追跡コマンド

| コマンド | 説明 |
|----------|------|
| `pnpm exec wrangler vectorize info nepp-chan-knowledge-<env>` | ベクター総数を確認 |
| `pnpm exec wrangler queues info nepp-chan-knowledge-sync-<env>` | Queue の残メッセージ数を確認 |
| `pnpm exec wrangler tail nepp-chan-server-<env>` | Worker ログをリアルタイム監視 |

### 処理フロー

```
1. pnpm knowledge:upload:<env>           ← R2 にアップロード
2. R2 Event Notifications → Queue        ← 自動でキュー投入
3. Queue → Worker → Embedding → Vectorize ← 非同期処理
```

### 確認ポイント

- Queue の `messages` が 0 → **完了**
- Queue の `messages` > 0 → **処理中**
- Vectorize の `vectorCount` が期待値に達しているか
- Worker ログに `VECTOR_UPSERT_ERROR` が出ていないか

### env 値の対応表

| 環境 | Vectorize インデックス名 | Queue 名 | Worker 名 |
|------|------------------------|----------|-----------|
| local | `nepp-chan-knowledge-local` | `nepp-chan-knowledge-sync-local` | `nepp-chan-server-local` |
| dev | `nepp-chan-knowledge-dev` | `nepp-chan-knowledge-sync-dev` | `nepp-chan-server-dev` |
| prd | `nepp-chan-knowledge-prd` | `nepp-chan-knowledge-sync-prd` | `nepp-chan-server-prd` |

## 主要ファイル

| ファイル | 役割 |
|----------|------|
| `scripts/upload-knowledge.ts` | CLI エントリポイント（ディレクトリ構造保持でR2アップロード） |
| `server/src/handlers/r2-event-handler.ts` | R2 イベント → チャンク→embedding |
| `server/src/services/knowledge/embedding.ts` | チャンク分割・embedding・Vectorize upsert |
| `server/src/services/knowledge/sync.ts` | R2 ↔ Vectorize 全同期 |
| `server/src/services/knowledge/search.ts` | RAG 検索（query → リランク） |

## ワークフロー

### upload
環境を確認し、`pnpm knowledge:upload:<env>` を実行。

### clean
環境を確認し、`pnpm knowledge:upload:<env> --clean` → `pnpm knowledge:upload:<env>` を順に実行。

### progress
1. Vectorize ベクター数を確認
2. Queue 残メッセージ数を確認
3. サマリーテーブルを表示

## 制約

- prd 環境への操作は必ずユーザーに確認する
- `--clean` 実行前は必ず確認する（Vectorize 全削除のため）
- .env の中身は表示しない（環境変数名のみ案内）

## 典型的な運用フロー

```
1. knowledge/ に MD ファイルを追加・編集
2. pnpm knowledge:upload:dev --clean   ← Vectorize リセット
3. pnpm knowledge:upload:dev           ← 全ファイル再登録
4. pnpm server:dev → チャットで検索結果を確認
5. OK なら prd 向けに同じ手順を実行
```
