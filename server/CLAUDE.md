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
│   └── admin/               # 管理 API
├── schemas/                 # 共有 Zod スキーマ（ツール・ルート共通）
├── mastra/                  # Mastra プリミティブ
│   ├── agents/              # AI エージェント
│   ├── tools/               # ツール
│   ├── workflows/           # ワークフロー
│   └── mcp/                 # MCP 設定
├── services/                # ビジネスロジック
│   ├── knowledge/           # RAG ナレッジ処理
│   └── persona-extractor.ts # ペルソナ抽出
├── repository/              # データアクセス層
├── handlers/                # Cron/Queue ハンドラー
├── db/                      # Drizzle ORM
│   ├── schema.ts            # テーブルスキーマ
│   ├── client.ts            # DB クライアント
│   └── migrations/          # マイグレーションファイル
└── __tests__/               # テスト
```

## API エンドポイント

| パス                               | メソッド | 説明                           |
| ---------------------------------- | -------- | ------------------------------ |
| `/health`                          | GET      | ヘルスチェック                 |
| `/chat`                            | POST     | チャット（ストリーミング）     |
| `/threads`                         | GET/POST | スレッド一覧・作成             |
| `/threads/:threadId`               | GET/DELETE | スレッド詳細・削除           |
| `/threads/:threadId/messages`      | GET      | メッセージ履歴                 |
| `/feedback`                        | POST     | フィードバック送信             |
| `/admin/knowledge/sync`            | POST     | ナレッジ同期                   |
| `/admin/knowledge`                 | DELETE   | ナレッジ削除                   |
| `/admin/persona`                   | GET/DELETE | ペルソナ一覧・全削除         |
| `/admin/persona/extract`           | POST     | ペルソナ抽出                   |
| `/admin/persona/extract/:threadId` | POST     | 特定スレッドのペルソナ抽出     |
| `/admin/emergency`                 | GET      | 緊急情報一覧（認証必須）       |
| `/admin/feedback`                  | GET      | フィードバック一覧（認証必須） |
| `/admin/feedback/:id`              | GET      | フィードバック詳細             |
| `/admin/feedback/:id/resolve`      | PUT/DELETE | フィードバック解決・未解決に戻す |
| `/admin/feedback`                  | DELETE   | 全フィードバック削除           |
| `/admin/broadcast`                 | GET/POST | 配信一覧・作成                 |
| `/admin/broadcast/:id`             | GET/PUT/DELETE | 配信詳細・更新・削除     |
| `/admin/broadcast/:id/send`        | POST     | 配信即時送信                   |
| `/admin/broadcast/upload-image`    | POST     | 配信用画像アップロード         |
| `/broadcast/media/:key`            | GET      | 配信画像取得                   |
| `/admin/questionnaires`            | GET/POST | アンケート一覧・作成           |
| `/admin/questionnaires/:id`        | GET/PUT/DELETE | アンケート詳細・更新・削除 |
| `/admin/questionnaires/:id/send`   | POST     | アンケートLINE配信             |
| `/admin/questionnaires/:id/results`| GET      | アンケート回答結果             |
| `/admin/questionnaires/:id/close`  | POST     | アンケート締切                 |
| `/admin/invitations`               | GET/POST | 招待一覧・作成                 |
| `/admin/invitations/:id`           | DELETE   | 招待削除                       |
| `/auth/register`                   | POST     | ユーザー登録（招待トークン+パスワード） |
| `/auth/login`                      | POST     | ログイン（ユーザー名+パスワード）      |
| `/auth/me`                         | GET      | 認証状態確認                   |
| `/auth/logout`                     | POST     | ログアウト                     |
| `/line/webhook`                    | POST     | LINE Webhook 受信              |
| `/swagger`                         | GET      | Swagger UI                     |
| `/doc`                             | GET      | OpenAPI スキーマ               |

## Mastra エージェント

### nep-chan（動的生成）

メインキャラクター「ねっぷちゃん」は `createNeppChanAgent({ isAdmin, platform, modelConfig })` で動的に生成される。
`modelConfig` は `resolveModelTier()` で Intent（casual/normal/thinking）× プラットフォーム × 管理者フラグから決定する。

- **一般ユーザー**: 基本機能のみ（天気、Web検索、ナレッジ、緊急報告）
- **管理者**: 基本機能 + 管理者専用エージェント（emergency, feedback, persona-analyst）

```typescript
import { classifyIntent } from "~/lib/classify-intent";
import { resolveModelTier } from "~/lib/llm-models";
import { createNeppChanAgent } from "~/mastra/agents/nepp-chan-agent";

const intent = await classifyIntent(userText);
const modelConfig = resolveModelTier({ intent, platform: "web", isAdmin: false });
const agent = createNeppChanAgent({ modelConfig });
```

### エージェント一覧

| ID                         | 説明                               |
| -------------------------- | ---------------------------------- |
| `nep-chan`                 | メインキャラクター（ねっぷちゃん） |
| `intent-router`            | Intent 分類（モデルティア決定用）   |
| `web-researcher`           | Web 検索（Google Grounding）       |
| `emergency-reporter-agent` | 緊急事態報告（一般ユーザー）       |
| `emergency-agent`          | 緊急報告取得（管理者専用）         |
| `feedback-agent`           | フィードバック分析（管理者専用）   |
| `persona-agent`            | ペルソナ保存                       |
| `persona-analyst-agent`    | ペルソナ分析（管理者専用）         |
| `knowledge-agent`          | RAG ナレッジ検索                   |
| `document-converter`       | 画像/PDF → Markdown 変換           |

## Mastra ツール

| ツール名（変数名）       | ツール ID            | 説明                                   |
| ------------------------ | -------------------- | -------------------------------------- |
| `searchGoogleTool`       | `google-search`      | Google Custom Search                   |
| `devTool`                | `dev-tool`           | Working Memory 表示（デバッグ）        |
| `displayChartTool`       | `display-chart`      | グラフ表示（line/bar/pie）             |
| `displayTableTool`       | `display-table`      | テーブル表示                           |
| `displayTimelineTool`    | `display-timeline`   | タイムライン表示                       |
| `personaGetTool`         | `persona-get`        | 村の集合知検索（管理者専用）           |
| `personaSaveTool`        | `persona-save`       | ペルソナ保存                           |
| `personaUpdateTool`      | `persona-update`     | ペルソナ更新                           |
| `personaAggregateTool`   | `persona-aggregate`  | ペルソナ集計（管理者専用）             |
| `adminPersonaTool`       | `admin-persona`      | ペルソナ一覧・統計取得（管理者専用）   |
| `emergencyReportTool`    | `emergency-report`   | 緊急情報記録                           |
| `emergencyUpdateTool`    | `emergency-update`   | 緊急情報更新                           |
| `emergencyGetTool`       | `emergency-get`      | 緊急情報取得（管理者専用）             |
| `adminEmergencyTool`     | `admin-emergency`    | 緊急報告一覧取得（管理者専用）         |
| `adminFeedbackTool`      | `admin-feedback`     | フィードバック一覧・統計（管理者専用） |
| `villageSearchTool`      | `village-search`     | 村検索                                 |
| `knowledgeSearchTool`    | `knowledge-search`   | RAG ナレッジ検索（Vectorize）          |
| `broadcastGetTool`       | `broadcast-get`      | 過去の配信メッセージ取得               |

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

### Mastra 関連

- エージェントは `mastra/agents/` に配置
- ツールは `mastra/tools/` に配置
- ワークフローは `mastra/workflows/` に配置
- **サービスロジックは `services/` に配置**（`mastra/` には Mastra プリミティブのみ）

### createTool の execute シグネチャ

```typescript
createTool({
  id: "tool-name",
  inputSchema: z.object({ ... }),
  execute: async (inputData, context) => {
    // inputData: inputSchema で定義したフィールドを直接受け取る
    // context?.requestContext: RuntimeContext へのアクセス
    const env = context?.requestContext?.get("env") as CloudflareBindings;
    return { ... };
  },
});
```

### D1Store 初期化パターン

```typescript
const storage = new D1Store({ id: "mastra-storage", binding: db });
await storage.init(); // 重要：初期化必須
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
- 認証必須ルート: `requireAuth` ミドルウェアを適用
- ロール制限ルート: `requireRole("admin")` 等を `requireAuth` の後に適用（`middleware/require-role.ts`）
- 共通スキーマ: `schemas/` から import（インライン定義を避ける）

## データベーステーブル

### emergency_reports

| カラム      | 型   | 説明                 |
| ----------- | ---- | -------------------- |
| id          | TEXT | PRIMARY KEY          |
| type        | TEXT | 種別（NOT NULL）     |
| description | TEXT | 説明                 |
| location    | TEXT | 場所                 |
| reported_at | TEXT | 報告日時（NOT NULL） |
| updated_at  | TEXT | 更新日時             |

### admin_users

| カラム        | 型   | 説明                               |
| ------------- | ---- | ---------------------------------- |
| id            | TEXT | PRIMARY KEY                        |
| username      | TEXT | ユーザー名（UNIQUE NOT NULL）      |
| name          | TEXT | 表示名                             |
| role          | TEXT | 役割（super_admin/admin/staff）    |
| password_hash | TEXT | パスワードハッシュ（NOT NULL）      |
| created_at    | TEXT | 作成日時（NOT NULL）               |
| updated_at    | TEXT | 更新日時                           |

### admin_invitations

| カラム     | 型   | 説明                               |
| ---------- | ---- | ---------------------------------- |
| id         | TEXT | PRIMARY KEY                        |
| username   | TEXT | ユーザー名（UNIQUE NOT NULL）      |
| token      | TEXT | 招待トークン（UNIQUE NOT NULL）    |
| invited_by | TEXT | 招待者                             |
| role       | TEXT | 役割（admin/super_admin）          |
| expires_at | TEXT | 有効期限（NOT NULL）               |
| used_at    | TEXT | 使用日時                           |
| created_at | TEXT | 作成日時（NOT NULL）               |

### persona

| カラム                | 型   | 説明                     |
| --------------------- | ---- | ------------------------ |
| id                    | TEXT | PRIMARY KEY              |
| resource_id           | TEXT | リソース ID（NOT NULL）  |
| category              | TEXT | カテゴリ（NOT NULL）     |
| tags                  | TEXT | タグ（JSON 配列）        |
| content               | TEXT | 内容（NOT NULL）         |
| source                | TEXT | 情報源                   |
| topic                 | TEXT | トピック                 |
| sentiment             | TEXT | 感情（default: neutral） |
| demographic_summary   | TEXT | 属性サマリー             |
| created_at            | TEXT | 作成日時（NOT NULL）     |
| updated_at            | TEXT | 更新日時                 |
| conversation_ended_at | TEXT | 会話終了日時             |

### thread_persona_status

| カラム             | 型      | 説明                 |
| ------------------ | ------- | -------------------- |
| thread_id          | TEXT    | PRIMARY KEY          |
| last_extracted_at  | TEXT    | 最終抽出日時         |
| last_message_count | INTEGER | 処理済みメッセージ数 |

### message_feedback

| カラム               | 型   | 説明                           |
| -------------------- | ---- | ------------------------------ |
| id                   | TEXT | PRIMARY KEY                    |
| thread_id            | TEXT | スレッド ID（NOT NULL）        |
| message_id           | TEXT | メッセージ ID（NOT NULL）      |
| rating               | TEXT | 評価（good/bad）（NOT NULL）   |
| category             | TEXT | カテゴリ                       |
| comment              | TEXT | コメント                       |
| conversation_context | TEXT | 会話コンテキスト（JSON）       |
| tool_executions      | TEXT | ツール実行履歴（JSON）         |
| created_at           | TEXT | 作成日時（NOT NULL）           |
| resolved_at          | TEXT | 解決日時                       |

### broadcast_messages

| カラム        | 型   | 説明                                        |
| ------------- | ---- | ------------------------------------------- |
| id            | TEXT | PRIMARY KEY                                 |
| title         | TEXT | タイトル（本文先頭50文字、NOT NULL）         |
| body          | TEXT | 本文（最初のテキストパーツから自動生成、NOT NULL） |
| parts         | TEXT | メッセージパーツ（JSON配列）                |
| status        | TEXT | ステータス（draft/scheduled/sent/failed）   |
| scheduled_at  | TEXT | 予約送信日時                                |
| sent_at       | TEXT | 送信日時                                    |
| error_message | TEXT | エラーメッセージ                            |
| created_by    | TEXT | 作成者 admin ID（NOT NULL）                 |
| created_at    | TEXT | 作成日時（NOT NULL）                        |
| updated_at    | TEXT | 更新日時                                    |

### questionnaires

| カラム        | 型      | 説明                                          |
| ------------- | ------- | --------------------------------------------- |
| id            | TEXT    | PRIMARY KEY                                   |
| title         | TEXT    | タイトル（NOT NULL）                          |
| description   | TEXT    | 説明                                          |
| is_anonymous  | INTEGER | 無記名フラグ（1=無記名, 0=記名、NOT NULL）    |
| status        | TEXT    | ステータス（draft/scheduled/sent/closed）     |
| created_by    | TEXT    | 作成者 admin ID（NOT NULL）                   |
| created_at    | TEXT    | 作成日時（NOT NULL）                          |
| updated_at    | TEXT    | 更新日時                                      |
| scheduled_at  | TEXT    | 予約配信日時                                  |
| sent_at       | TEXT    | 配信日時                                      |
| closed_at     | TEXT    | 締切日時                                      |

### questionnaire_questions

| カラム           | 型      | 説明                                              |
| ---------------- | ------- | ------------------------------------------------- |
| id               | TEXT    | PRIMARY KEY                                       |
| questionnaire_id | TEXT    | アンケートID（NOT NULL）                          |
| order            | INTEGER | 表示順（NOT NULL）                                |
| text             | TEXT    | 質問文（NOT NULL）                                |
| type             | TEXT    | 種別（single_choice/multiple_choice/free_text/rating） |
| required         | INTEGER | 必須フラグ（1=必須, 0=任意、NOT NULL）            |
| choices          | TEXT    | 選択肢（JSON配列）                                |
| created_at       | TEXT    | 作成日時（NOT NULL）                              |

### questionnaire_submissions

| カラム                 | 型      | 説明                        |
| ---------------------- | ------- | --------------------------- |
| id                     | TEXT    | PRIMARY KEY                 |
| questionnaire_id       | TEXT    | アンケートID（NOT NULL）    |
| user_id                | TEXT    | LINE ユーザーID（NOT NULL） |
| current_question_order | INTEGER | 現在の設問番号（NOT NULL）  |
| completed_at           | TEXT    | 回答完了日時                |
| created_at             | TEXT    | 作成日時（NOT NULL）        |

UNIQUE INDEX: `(questionnaire_id, user_id)` で重複回答を防止

### questionnaire_answers

| カラム           | 型      | 説明                     |
| ---------------- | ------- | ------------------------ |
| id               | TEXT    | PRIMARY KEY              |
| submission_id    | TEXT    | 提出ID（NOT NULL）       |
| question_id      | TEXT    | 設問ID（NOT NULL）       |
| answer_text      | TEXT    | 自由記述の回答           |
| answer_number    | INTEGER | 評価の回答（1-5）        |
| selected_choices | TEXT    | 選択肢の回答（JSON配列） |
| created_at       | TEXT    | 作成日時（NOT NULL）     |

## Drizzle ORM

### スキーマ定義

```typescript
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const persona = sqliteTable("persona", {
  id: text("id").primaryKey(),
  resourceId: text("resource_id").notNull(),
  // ...
});

// 型推論
export type Persona = typeof persona.$inferSelect;
export type NewPersona = typeof persona.$inferInsert;
```

### 使用方法

```typescript
import { createDb, persona } from "~/db";
import { eq } from "drizzle-orm";

const db = createDb(c.env.DB);

// SELECT
const result = await db.select().from(persona).where(eq(persona.id, "xxx")).get();

// INSERT
await db.insert(persona).values({ id: "xxx", ... });

// UPDATE
await db.update(persona).set({ content: "新しい内容" }).where(eq(persona.id, "xxx"));

// DELETE
await db.delete(persona).where(eq(persona.id, "xxx"));
```

### Mastra テーブルの扱い

`mastra_threads` は Mastra が管理するテーブル。読み取り専用のスキーマとして定義し、マイグレーション対象から除外。

```typescript
// drizzle.config.ts
export default defineConfig({
  tablesFilter: ["!mastra_*"],  // Mastra テーブルを除外
});
```

## RAG ナレッジ機能

### アーキテクチャ

```text
knowledge/*.md → R2 バケット → Vectorize（embeddings）
                                ↓
                       knowledgeSearchTool で検索
```

### ファイル構成

| パス                                       | 説明                         |
| ------------------------------------------ | ---------------------------- |
| `services/knowledge/embedding.ts`          | chunk 分割・embeddings 生成  |
| `lib/image-converter.ts`                   | 画像/PDF → Markdown 変換     |
| `services/knowledge/sync.ts`               | R2 → Vectorize 同期処理      |
| `services/knowledge/files.ts`              | R2 ファイル操作              |
| `services/knowledge/upload.ts`             | アップロード処理             |
| `mastra/tools/knowledge-search-tool.ts`    | ベクトル検索ツール           |

### Embedding モデル

| 用途           | モデル              | 次元数 | taskType           |
| -------------- | ------------------- | ------ | ------------------ |
| ドキュメント登録 | gemini-embedding-001 | 1536   | RETRIEVAL_DOCUMENT |
| 検索クエリ     | gemini-embedding-001 | 1536   | RETRIEVAL_QUERY    |

### Cloudflare バインディング

| バインディング     | dev                          | prd                          |
| ------------------ | ---------------------------- | ---------------------------- |
| `KNOWLEDGE_BUCKET` | `nepp-chan-knowledge-dev`    | `nepp-chan-knowledge-prd`    |
| `VECTORIZE`        | `nepp-chan-knowledge-dev`    | `nepp-chan-knowledge-prd`    |
| `DB`               | `nepp-chan-db-dev`           | `nepp-chan-db-prd`           |

## ペルソナ抽出バッチ処理

### アーキテクチャ

```text
[Cron Trigger / 管理API]
       ↓
mastra_threads から全スレッド取得
       ↓
thread_persona_status と比較（差分検出）
       ↓
新しいメッセージのみ抽出
       ↓
personaAgent で分析・保存
       ↓
thread_persona_status 更新
```

### Cron Trigger

| スケジュール   | ハンドラー           | 説明                          |
| -------------- | -------------------- | ----------------------------- |
| `*/5 * * * *`  | handleBroadcastCheck | 配信予約チェック（5分ごと）        |
| `*/5 * * * *`  | handleQuestionnaireCheck | アンケート予約配信チェック（5分ごと） |
| `0 18 * * *`   | handlePersonaExtract | ペルソナ抽出（毎日03:00 JST）      |

## デプロイ環境

| 環境 | URL | Worker 名 |
| ---- | --- | --------- |
| ローカル | http://localhost:8787 | - |
| dev | https://dev-api.nepp-chan.ai | nepp-chan-server-dev |
| prd | https://api.nepp-chan.ai | nepp-chan-server-prd |

## 開発コマンド

```bash
pnpm dev               # 開発サーバー（http://localhost:8787）
pnpm test              # テスト実行
pnpm deploy            # dev 環境にデプロイ
pnpm deploy:prd        # prd 環境にデプロイ
```
