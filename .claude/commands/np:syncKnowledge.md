---
description: ナレッジRAG管理 - アップロード・リセット・同期・進捗追跡のコマンドリファレンスと実行
argument-hint: [upload|clean|sync|status|progress]
---

<role>
You are a knowledge management assistant for the nepp-chan RAG system.
You help users upload, reset, and sync knowledge files to Cloudflare R2 + Vectorize.
</role>

<language>
- Communicate: 日本語
</language>

<reference>

## ナレッジ構造

```
knowledge/
├── villotoinep/    ← 音威子府村公式サイトデータ（264ファイル）
├── otoko/          ← 音威子府高校データ（60+ファイル）
└── welcome-guide.md ← ウェルカムガイド
```

R2 キーはディレクトリ構造を保持する（例: `villotoinep/kurashi/gomi_kankyou/gomi_calendar.md`）。

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `pnpm knowledge:upload:local` | `.env.local` を使用してローカルD1にアップロード |
| `pnpm knowledge:upload:dev` | `.env.development` を使用して dev 環境にアップロード |
| `pnpm knowledge:upload:prd` | `.env.production` を使用して prd 環境にアップロード |
| `pnpm knowledge:upload:<env> --file=foo.md` | 特定ファイルのみアップロード |
| `pnpm knowledge:upload:<env> --clean` | Vectorize インデックスを全削除→再作成（R2/D1 に影響なし） |

## 管理API（ローカルDevサーバー経由）

| エンドポイント | 説明 |
|---------------|------|
| `POST /admin/knowledge/sync` | R2 バケット全体を Vectorize に再同期 |
| `DELETE /admin/knowledge` | Vectorize の全ナレッジを削除 |
| `PUT /admin/knowledge/files/{key}` | 単一ファイルをアップロード→同期 |
| `POST /admin/knowledge/convert` | PDF/画像 → Markdown 変換後アップロード |

## 環境の向き先

| 環境 | env ファイル | R2 バケット | Vectorize インデックス |
|------|-------------|-------------|----------------------|
| local | `.env.local` | `nepp-chan-knowledge-local` | `nepp-chan-knowledge-local` |
| dev | `.env.development` | `nepp-chan-knowledge-dev` | `nepp-chan-knowledge-dev` |
| prd | `.env.production` | `nepp-chan-knowledge-prd` | `nepp-chan-knowledge-prd` |

**向き先は各 `.env.*` ファイルの値で決まる。** `--clean` は Vectorize のみ影響（D1/会話履歴/ユーザーデータに影響なし）。

## 進捗追跡コマンド

R2 アップロード後、ベクタライズは非同期（Queue → Worker → Vectorize）で処理される。
以下のコマンドで進捗を監視する。

| コマンド | 説明 |
|----------|------|
| `pnpm exec wrangler vectorize info nepp-chan-knowledge-<env>` | ベクター総数を確認 |
| `pnpm exec wrangler queues info nepp-chan-knowledge-sync-<env>` | Queue の残メッセージ数を確認 |
| `pnpm exec wrangler tail nepp-chan-server-<env>` | Worker ログをリアルタイム監視（VECTOR_UPSERT_ERROR 等） |

### 進捗追跡の流れ

```
1. pnpm knowledge:upload:<env>           ← R2 にアップロード
2. R2 Event Notifications → Queue        ← 自動でキュー投入
3. Queue → Worker → Embedding → Vectorize ← 非同期処理
```

**確認ポイント:**
- Queue の `messages` が 0 になれば全件処理完了
- Vectorize の `vectorCount` が期待値に達しているか（1ファイル ≒ 複数チャンク = 複数ベクター）
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

## 典型的な運用フロー

```
1. knowledge/ に MD ファイルを追加・編集
2. pnpm knowledge:upload:dev --clean   ← Vectorize リセット
3. pnpm knowledge:upload:dev           ← 全ファイル再登録
4. pnpm server:dev → チャットで検索結果を確認
5. OK なら prd 向けに同じ手順を実行
```

</reference>

<workflow>

### If NO argument provided:

Show the reference above, then use AskUserQuestion:

```yaml
AskUserQuestion:
  questions:
    - question: "何をしますか？"
      header: "操作"
      multiSelect: false
      options:
        - label: "全ファイルアップロード"
          description: "knowledge/**/*.md を全件 R2 にアップロード"
        - label: "Vectorize リセット→再アップロード"
          description: "--clean で全削除後、全ファイル再登録"
        - label: "進捗追跡（progress）"
          description: "Vectorize ベクター数・Queue 残量を確認"
        - label: "コマンド確認のみ"
          description: "リファレンスを表示して終了"
    - question: "対象環境は？"
      header: "環境"
      multiSelect: false
      options:
        - label: "local"
          description: ".env.local を使用"
        - label: "dev (推奨)"
          description: ".env.development を使用"
        - label: "prd"
          description: ".env.production を使用（要確認）"
```

### If argument is "upload":
Ask target environment, then run `pnpm knowledge:upload:<env>` and report results.

### If argument is "clean":
Ask target environment, confirm with user, then run `pnpm knowledge:upload:<env> --clean` followed by `pnpm knowledge:upload:<env>`.

### If argument is "sync":
Explain that `POST /admin/knowledge/sync` should be called against the local dev server (`http://localhost:8787`).

### If argument is "status":
Show the reference table and current .env.* file existence.

### If argument is "progress":

アップロード後のベクタライズ進捗を追跡する。

1. Ask target environment (AskUserQuestion)
2. Run the following commands **sequentially** and report results:

```bash
# Step 1: Vectorize ベクター数を確認
pnpm exec wrangler vectorize info nepp-chan-knowledge-<env>

# Step 2: Queue 残メッセージ数を確認
pnpm exec wrangler queues info nepp-chan-knowledge-sync-<env>
```

3. Report a summary table:

```markdown
| 指標 | 値 |
|------|-----|
| ベクター総数 | N vectors |
| Queue 残メッセージ | N messages |
| 状態 | 処理中 / 完了 |
```

- Queue messages が 0 → **完了**
- Queue messages > 0 → **処理中**（再度 `progress` で確認を促す）
- `VECTOR_UPSERT_ERROR` の有無を確認したい場合は `pnpm exec wrangler tail nepp-chan-server-<env>` を案内する（リアルタイム監視のため自動実行しない）

</workflow>

<constraints>
- prd 環境への操作は必ずユーザーに確認する
- `--clean` 実行前は必ず確認する（Vectorize 全削除のため）
- .env の中身は表示しない（環境変数名のみ案内）
</constraints>
