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
| 型定義           | 各ファイル内、または `mastra/schemas/` |

## ディレクトリ構成

```text
server/src/
├── index.ts                 # エントリーポイント・Hono アプリケーション
├── middleware/              # Hono ミドルウェア
├── routes/                  # API ルート定義
│   └── admin/               # 管理 API
├── mastra/                  # Mastra プリミティブ
│   ├── agents/              # AI エージェント
│   ├── tools/               # ツール
│   ├── workflows/           # ワークフロー
│   ├── scorers/             # 評価スコアラー
│   ├── schemas/             # Zod スキーマ
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
| `/threads/:threadId`               | GET      | スレッド詳細                   |
| `/threads/:threadId/messages`      | GET      | メッセージ履歴                 |
| `/feedback`                        | POST     | フィードバック送信             |
| `/admin/knowledge/sync`            | POST     | ナレッジ同期                   |
| `/admin/knowledge`                 | DELETE   | ナレッジ削除                   |
| `/admin/persona`                   | GET      | ペルソナ一覧                   |
| `/admin/persona/extract`           | POST     | ペルソナ抽出                   |
| `/admin/emergency`                 | GET      | 緊急情報一覧（認証必須）       |
| `/admin/feedback`                  | GET      | フィードバック一覧（認証必須） |
| `/admin/feedback/:id`              | GET      | フィードバック詳細             |
| `/admin/feedback/:id/resolve`      | PUT      | フィードバック解決             |
| `/admin/feedback`                  | DELETE   | 全フィードバック削除           |
| `/admin/invitations`               | GET/POST | 招待一覧・作成                 |
| `/admin/invitations/:id`           | DELETE   | 招待削除                       |
| `/auth/register/options`           | POST     | WebAuthn 登録オプション取得    |
| `/auth/register/verify`            | POST     | WebAuthn 登録検証              |
| `/auth/login/options`              | POST     | WebAuthn ログインオプション    |
| `/auth/login/verify`               | POST     | WebAuthn ログイン検証          |
| `/auth/me`                         | GET      | 認証状態確認                   |
| `/auth/logout`                     | POST     | ログアウト                     |
| `/swagger`                         | GET      | Swagger UI                     |
| `/doc`                             | GET      | OpenAPI スキーマ               |

## Mastra エージェント

### nep-chan（動的生成）

メインキャラクター「ねっぷちゃん」は `createNepChanAgent({ isAdmin })` で動的に生成される。

- **一般ユーザー**: 基本機能のみ（天気、Web検索、ナレッジ、緊急報告）
- **管理者**: 基本機能 + 管理者専用エージェント（emergency, feedback, persona-analyst）

```typescript
import { createNepChanAgent } from "~/mastra/agents/nepch-agent";

const agent = createNepChanAgent({ isAdmin: true });
```

### エージェント一覧

| ID                     | 説明                                   | モデル           |
| ---------------------- | -------------------------------------- | ---------------- |
| `nep-chan`             | メインキャラクター（ねっぷちゃん）     | gemini-2.5-flash |
| `weather-agent`        | 天気情報取得                           | gemini-2.5-flash |
| `web-researcher`       | Web 検索（Google Grounding）           | gemini-2.5-flash |
| `village-info`         | 村情報提供                             | gemini-2.5-flash |
| `emergency-reporter`   | 緊急事態報告（一般ユーザー）           | gemini-2.5-flash |
| `emergency`            | 緊急報告取得（管理者専用）             | gemini-2.5-flash |
| `feedback`             | フィードバック分析（管理者専用）       | gemini-2.5-flash |
| `persona`              | ペルソナ保存                           | gemini-2.5-flash |
| `persona-analyst`      | ペルソナ分析（管理者専用）             | gemini-2.5-flash |
| `knowledge-agent`      | RAG ナレッジ検索                       | gemini-2.5-flash |
| `document-converter`   | 画像/PDF → Markdown 変換               | gemini-2.5-pro   |

## Mastra ツール

| ツール名               | 説明                                   |
| ---------------------- | -------------------------------------- |
| `weatherTool`          | Open-Meteo API で天気取得              |
| `searchGoogleTool`     | Google Custom Search                   |
| `devTool`              | Working Memory 表示（デバッグ）        |
| `displayChartTool`     | グラフ表示（line/bar/pie）             |
| `displayTableTool`     | テーブル表示                           |
| `displayTimelineTool`  | タイムライン表示                       |
| `personaGetTool`       | 村の集合知検索（管理者専用）           |
| `personaSaveTool`      | ペルソナ保存                           |
| `personaUpdateTool`    | ペルソナ更新                           |
| `personaAggregateTool` | ペルソナ集計（管理者専用）             |
| `adminPersonaTool`     | ペルソナ一覧・統計取得（管理者専用）   |
| `emergencyReportTool`  | 緊急情報記録                           |
| `emergencyUpdateTool`  | 緊急情報更新                           |
| `emergencyGetTool`     | 緊急情報取得（管理者専用）             |
| `adminEmergencyTool`   | 緊急報告一覧取得（管理者専用）         |
| `adminFeedbackTool`    | フィードバック一覧・統計（管理者専用） |
| `villageSearchTool`    | 村検索                                 |
| `knowledgeSearchTool`  | RAG ナレッジ検索（Vectorize）          |

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
- スコアラーは `mastra/scorers/` に配置
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

### admins

| カラム     | 型   | 説明                             |
| ---------- | ---- | -------------------------------- |
| id         | TEXT | PRIMARY KEY                      |
| email      | TEXT | メールアドレス（UNIQUE NOT NULL）|
| role       | TEXT | 役割（admin/super_admin）        |
| created_at | TEXT | 作成日時（NOT NULL）             |
| updated_at | TEXT | 更新日時                         |

### admin_invitations

| カラム     | 型   | 説明                             |
| ---------- | ---- | -------------------------------- |
| id         | TEXT | PRIMARY KEY                      |
| email      | TEXT | メールアドレス（UNIQUE NOT NULL）|
| token      | TEXT | 招待トークン（UNIQUE NOT NULL）  |
| invited_by | TEXT | 招待者                           |
| role       | TEXT | 役割（admin/super_admin）        |
| expires_at | TEXT | 有効期限（NOT NULL）             |
| used_at    | TEXT | 使用日時                         |
| created_at | TEXT | 作成日時（NOT NULL）             |

### admin_sessions

| カラム     | 型   | 説明                 |
| ---------- | ---- | -------------------- |
| id         | TEXT | PRIMARY KEY          |
| admin_id   | TEXT | 管理者 ID（NOT NULL）|
| expires_at | TEXT | 有効期限（NOT NULL） |
| created_at | TEXT | 作成日時（NOT NULL） |

### admin_credentials

| カラム         | 型   | 説明                       |
| -------------- | ---- | -------------------------- |
| id             | TEXT | PRIMARY KEY                |
| admin_id       | TEXT | 管理者 ID（NOT NULL）      |
| credential_id  | TEXT | WebAuthn 資格情報 ID       |
| public_key     | TEXT | 公開鍵                     |
| counter        | INT  | 認証カウンター             |
| device_type    | TEXT | デバイス種別               |
| backed_up      | INT  | バックアップ済みフラグ     |
| transports     | TEXT | トランスポート情報（JSON） |
| created_at     | TEXT | 作成日時（NOT NULL）       |

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
| `services/knowledge/converter.ts`          | 画像/PDF → Markdown 変換     |
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

| バインディング     | リソース                          |
| ------------------ | --------------------------------- |
| `KNOWLEDGE_BUCKET` | R2 バケット `aiss-nepch-knowledge` |
| `VECTORIZE`        | Vectorize インデックス `knowledge` |

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

| スケジュール | ハンドラー           | 説明                          |
| ------------ | -------------------- | ----------------------------- |
| `0 18 * * *` | handlePersonaExtract | ペルソナ抽出（毎日03:00 JST） |

## 開発コマンド

```bash
pnpm dev      # 開発サーバー
pnpm test     # テスト実行
pnpm deploy   # 本番デプロイ
```
