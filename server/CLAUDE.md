# CLAUDE.md - server

Cloudflare Workers で動作するバックエンド API。Hono + Mastra AI フレームワーク。

## ファイル探索ガイド

| 探したいもの     | 場所                                   |
| ---------------- | -------------------------------------- |
| API ルート       | `routes/*.ts`, `routes/admin/*.ts`     |
| エージェント     | `mastra/agents/*-agent.ts`             |
| ツール           | `mastra/tools/*-tool.ts`               |
| DB スキーマ      | `db/schema.ts`                         |
| ビジネスロジック | `services/`                            |
| 型定義           | 各ファイル内、または `schemas/`        |

## ディレクトリ構成

```text
server/src/
├── index.ts                 # エントリーポイント・Hono アプリケーション
├── middleware/              # Hono ミドルウェア
├── routes/                  # API ルート定義
│   ├── threads/             # スレッド・チャット API
│   └── admin/               # 管理 API
├── schemas/                 # 共有 Zod スキーマ（ツール・ルート共通）
├── mastra/                  # Mastra プリミティブ
│   ├── agents/              # AI エージェント
│   ├── tools/               # ツール
│   ├── workflows/           # ワークフロー
│   └── mcp/                 # MCP 設定
├── services/                # ビジネスロジック
│   ├── analytics/           # 分析（usage 記録・集計・週次レポート）
│   ├── auth/                # 認証
│   ├── knowledge/           # RAG ナレッジ処理
│   └── persona-extractor.ts # ペルソナ抽出
├── repository/              # データアクセス層
├── handlers/                # Cron/Queue ハンドラー
├── db/                      # Drizzle ORM
│   ├── schema.ts            # テーブルスキーマ
│   ├── client.ts            # DB クライアント
│   └── migrations/          # マイグレーションファイル
├── __tests__/
│   └── helpers/             # test-app / test-db / tool-context などの共通ヘルパ
└── *.test.ts                # 単体テストは対象ファイルと co-located
```

## コーディング規約

### ルート定義

```typescript
// @hono/zod-openapi の createRoute でルートを定義
const route = createRoute({
  method: "get",
  path: "/example",
  request: { query: QuerySchema },
  responses: { 200: { content: { "application/json": { schema: ResponseSchema } } } },
});

app.openapi(route, async (c) => { ... });
```

### エラーハンドリング

```typescript
import { HTTPException } from "hono/http-exception";

// HTTP エラーは HTTPException をスロー
throw new HTTPException(404, { message: "Not found" });

// グローバルエラーハンドラーで一元的に処理
```

### ツール命名規約

| 項目 | 規約 | 例 |
|------|------|-----|
| ファイル名 | `{domain}-{action}-tool.ts` (kebab-case) | `emergency-get-tool.ts` |
| 変数名 | `{domain}{Action}Tool` (camelCase) | `emergencyGetTool` |
| Tool ID | `{domain}-{action}` (kebab-case) | `emergency-get` |
| description | 日本語、句点で終わる | `"緊急報告の一覧を取得します。"` |
| inputSchema.describe | 日本語 | `"取得する最大件数"` |
| 管理者専用 | description に `【管理者専用】` プレフィックス | `"【管理者専用】緊急報告の一覧を取得します。"` |
| 共通スキーマ | `schemas/` から import | `import { ... } from "~/schemas/emergency-schema"` |

### エージェント規約

- instructions: 日本語で記述、セクションは `##` で区分
- model: デフォルト `GEMINI_FLASH`、推論精度重視なら `GEMINI_PRO`
- 動的 instructions: 現在日時が必要な場合のみ関数化（`lib/date.ts` の `getCurrentDateInfo()` を使用）

### ルート規約

- エラー: `throw new HTTPException(code, { message })` でスロー（グローバルエラーハンドラーが `{ error: { code, message } }` 形式に変換）
- OpenAPI エラーレスポンス: `lib/openapi-errors.ts` の `errorResponse(code)` を使用
- 認証主体: `resolvePrincipal` がグローバルに適用（opaque session → anonymous JWT の順で `principal` を解決）
- 管理者認可: `requireRole("admin")` 等で admin principal + ロールレベルをチェック（未認証は 401、権限不足は 403）
- 一般認証: `requireAuth` で `principal` の存在を保証（anonymous + admin 共通ルート用）
- スレッドアクセス: `requireThreadAccess` ミドルウェアで所有権検証（`principal` + `threadId` → `thread`）
- 共通スキーマ: `schemas/` から import（インライン定義を避ける）

### middleware の適用方法

- route ごとに必要な middleware が異なる、または handler 内で `c.get(...)` を non-optional に narrow させたい場合
  → `createRoute({ middleware: [requireAuth, ...] as const })` で route 定義に紐付ける
  - 例: `routes/threads/{chat,index}.ts` の `requireAuth` のみ vs `requireAuth + requireThreadAccess`
- sub-app の全 route に同じ middleware を blanket でかける場合
  → `app.use("*", mw)` で sub-app 入口にまとめる
  - 例: `routes/admin/*` の `requireRole("staff")`、`routes/line.ts` の署名検証

## Cron Trigger

| スケジュール   | ハンドラー                              | 説明                                                              |
| -------------- | --------------------------------------- | ----------------------------------------------------------------- |
| `*/5 * * * *`  | handleBroadcastCheck                    | 配信予約チェック（5分ごと）                                        |
| `*/5 * * * *`  | handlePollCheck                         | 投票予約配信チェック（5分ごと）                                    |
| `0 18 * * *`   | handlePersonaExtract → handleDataRetention | ペルソナ抽出 + 保管期間自動削除（毎日03:00 JST、順次実行。retention は Sentry Cron Monitor で不起動検知） |
| `0 20 * * 1`   | handleWeeklyReport                      | 週次レポート生成（毎週火曜05:00 JST、前週月〜日が対象。Sentry Cron Monitor で不起動検知） |

### 保管期間自動削除

`handleDataRetention` は以下のテーブルを期限超過行で削除する。実行結果は `data_retention_logs` に記録される。

| 対象テーブル              | 保管期間 | 判定キー                                                                  |
| ------------------------- | -------- | ------------------------------------------------------------------------- |
| `mastra_messages`         | 30日     | `createdAt`                                                               |
| `mastra_threads`          | 30日     | 紐づくメッセージが無い AND `createdAt` 経過（空スレッドへの猶予）         |
| `thread_persona_status`   | -        | 紐づく `mastra_threads` が無くなった孤立分                                |
| `mastra_resources`        | 180日    | `updatedAt`（working memory の最終更新）                                  |
| `message_feedback`        | 180日    | `created_at`                                                              |
| `llm_usage`               | 180日    | `created_at`（週次レポートに集計が恒久保存されるため raw は短期）         |
| `poll_submissions`        | 365日    | `created_at`                                                              |
| `data_retention_logs`     | 1095日   | `executed_at`                                                             |

`mastra_messages` 削除後は `thread_persona_status.last_message_count` を残メッセージ数に再計算する（persona-extractor が新規メッセージを取りこぼさないように）。

## デプロイ環境

| 環境 | URL | Worker 名 |
| ---- | --- | --------- |
| ローカル | http://localhost:8787 | - |
| dev | https://dev-api.nepp-chan.ai | nepp-chan-server-dev |
| prd | https://api.nepp-chan.ai | nepp-chan-server-prd |

## Cloudflare 側のレート制限

`/threads/{threadId}/chat`（web・widget 共通、LLM 呼び出しが発生する唯一のエンドポイント）に対して、
`nepp-chan.ai` zone の WAF Rate limiting rules（`api-chat-rate-limit`）で IP ベースの制限をかけている。
コードには残らない設定のためここに記録する。

| 項目 | 値 |
| ---- | -- |
| マッチ条件 | `http.request.uri.path wildcard r"*/threads/*/chat"` |
| 特性 | IP |
| しきい値 | 10 秒に 20 リクエスト超 |
| アクション | Block（10 秒） |

## 開発コマンド

```bash
pnpm dev               # 開発サーバー（http://localhost:8787）
pnpm test              # vitest 実行（istanbul provider）
pnpm test --coverage   # カバレッジ計測
pnpm deploy            # dev 環境にデプロイ
pnpm deploy:prd        # prd 環境にデプロイ
```

## テスト

- ランナー: vitest + libsql（テスト DB）+ msw
- 配置: 対象ファイルの隣に `*.test.ts` を置く co-located 方式
- 共通ヘルパ: `__tests__/helpers/`
  - `test-db.ts`: in-memory libsql + DDL（`broadcast_messages` / `polls` 等を含む）
  - `test-app.ts`: `resolvePrincipal` + `errorHandler` 込みの Hono アプリを返す
  - `tool-context.ts`: Mastra tool の `execute` を実行するための `buildToolContext` / `callTool`
- ルート/サービス/リポジトリ/Mastra tools/ハンドラーの単体・統合テストを揃える
- カバレッジ閾値は `vitest.config.ts` で管理。`mastra/public/` 等は除外
