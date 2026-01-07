# CLAUDE.md - aiss-nepch

## プロジェクト概要

音威子府村の AI キャラクター「ねっぷちゃん」チャットシステム。Mastra AI フレームワークを活用し、Cloudflare Workers（API）+ Cloudflare Pages（Web）で稼働するモノレポ構成。

### 主要機能

- **ねっぷちゃんチャット**: 音威子府村 17 歳の AI キャラクターとの会話
- **村長モード**: `/master` コマンドでパスワード認証後、データ分析機能を利用可能
- **RAG ナレッジ検索**: Markdown ファイルをベクトル化し、村の情報を検索・参照
- **村の集合知（ペルソナ）**: 会話から抽出した情報を蓄積・参照
- **緊急情報管理**: 緊急報告の記録・更新・取得
- **天気情報**: Open-Meteo API 経由で天気取得（ワークフロー）
- **Web 検索**: Google Custom Search API 経由

## 技術スタック

### フレームワーク・ランタイム

- **Hono** 4.10 - Web フレームワーク（OpenAPIHono で OpenAPI 統合）
- **Cloudflare Workers** - API サーバーレスランタイム
- **Cloudflare Pages** - フロントエンドホスティング
- **Mastra** 1.0.0-beta - AI エージェントフレームワーク

### AI/LLM

- **Google Generative AI** (@ai-sdk/google)
  - Gemini 2.5 Flash（メインエージェント）
  - Gemini 2.5 Pro（天気エージェント）

### フロントエンド

- **React** 19
- **Vite** 7
- **TailwindCSS** 4
- **TanStack Query** 5 - データフェッチング・キャッシング
- **AI SDK React** (@ai-sdk/react)

### データベース・ストレージ

- **Cloudflare D1** - SQLite ベースのエッジデータベース
- **Drizzle ORM** - 型安全な SQL クエリビルダー
- **D1Store** (@mastra/cloudflare-d1) - Mastra ストレージアダプタ
- **Cloudflare R2** - ナレッジファイル（Markdown）のオブジェクトストレージ
- **Cloudflare Vectorize** - ベクトルデータベース（RAG 用 embeddings 格納）

### 開発ツール

- **TypeScript** 5.9
- **Zod** 4 - スキーマバリデーション
- **Vitest** - テストフレームワーク
- **Biome** - フォーマッター/リンター
- **pnpm** - パッケージマネージャー（Node.js >= 22.13.0）

## プロジェクト構成

```text
aiss-nepch/
├── server/                          # バックエンド API（Cloudflare Workers）
│   ├── src/
│   │   ├── index.ts                 # エントリーポイント・Hono アプリケーション
│   │   ├── middleware/
│   │   │   ├── cors.ts              # CORS 設定
│   │   │   ├── error-handler.ts     # グローバルエラーハンドラー
│   │   │   └── index.ts
│   │   ├── routes/
│   │   │   ├── health.ts            # GET /health
│   │   │   ├── chat.ts              # POST /chat（ねっぷちゃん）
│   │   │   ├── threads.ts           # スレッド管理 API
│   │   │   ├── weather.ts           # GET /weather（ワークフロー）
│   │   │   └── index.ts
│   │   ├── mastra/
│   │   │   ├── agents/              # AI エージェント（8 個）
│   │   │   ├── tools/               # ツール（13 個）
│   │   │   ├── knowledge/           # RAG ナレッジ処理（chunk, embeddings, sync）
│   │   │   ├── workflows/           # ワークフロー
│   │   │   ├── scorers/             # 評価スコアラー
│   │   │   ├── schemas/             # Zod スキーマ（persona 等）
│   │   │   ├── mcp/                 # MCP 設定
│   │   │   ├── factory.ts           # Mastra インスタンス生成
│   │   │   ├── request-context.ts   # RuntimeContext 管理
│   │   │   └── index.ts
│   │   ├── routes/
│   │   │   ├── admin/               # 管理 API
│   │   │   │   └── knowledge.ts     # ナレッジ同期 API
│   │   ├── db/
│   │   │   ├── schema.ts            # Drizzle スキーマ定義
│   │   │   ├── client.ts            # DB クライアント生成
│   │   │   └── index.ts             # エクスポート
│   │   ├── repository/
│   │   │   ├── persona-repository.ts
│   │   │   ├── emergency-repository.ts
│   │   │   └── migrations/
│   │   │       └── 001_init.sql
│   │   └── __tests__/
│   ├── drizzle.config.ts                # Drizzle Kit 設定
│   ├── wrangler.jsonc
│   └── vitest.config.ts
├── knowledge/                           # ナレッジ Markdown ファイル
├── scripts/
│   └── upload-knowledge.ts              # R2 アップロードスクリプト
├── web/                             # フロントエンド（Cloudflare Pages・MPA構成）
│   ├── index.html                   # チャット画面エントリー（/）
│   ├── dashboard.html               # ダッシュボード画面エントリー（/dashboard）
│   ├── src/
│   │   ├── pages/
│   │   │   ├── chat/                # チャット画面
│   │   │   │   ├── App.tsx
│   │   │   │   ├── main.tsx
│   │   │   │   └── components/
│   │   │   └── dashboard/           # ダッシュボード画面（管理画面）
│   │   │       ├── App.tsx
│   │   │       ├── main.tsx
│   │   │       └── components/
│   │   ├── hooks/                   # 共有フック
│   │   ├── repository/              # API クライアント（Repository パターン）
│   │   │   ├── thread-repository.ts
│   │   │   ├── knowledge-repository.ts
│   │   │   ├── persona-repository.ts
│   │   │   ├── emergency-repository.ts
│   │   │   └── index.ts
│   │   ├── lib/
│   │   │   └── api/
│   │   │       └── client.ts        # 共通 API クライアント
│   │   ├── types/                   # 共有型定義
│   │   ├── providers/               # React Providers
│   │   └── index.css
│   ├── functions/
│   │   └── _middleware.ts           # Basic 認証
│   ├── wrangler.jsonc
│   └── vite.config.ts
├── package.json                     # ルート（モノレポ）
├── pnpm-workspace.yaml
├── biome.json
└── tsconfig.json
```

## API エンドポイント

| パス                               | メソッド | 説明                                     |
| ---------------------------------- | -------- | ---------------------------------------- |
| `/health`                          | GET      | ヘルスチェック                           |
| `/chat`                            | POST     | チャットメッセージ送信（ストリーミング） |
| `/threads`                         | GET      | スレッド一覧取得（ページング対応）       |
| `/threads`                         | POST     | スレッド作成                             |
| `/threads/:threadId`               | GET      | スレッド詳細取得                         |
| `/threads/:threadId/messages`      | GET      | メッセージ履歴取得                       |
| `/weather`                         | GET      | 天気情報取得（ワークフロー経由）         |
| `/admin/knowledge/sync`            | POST     | 全ナレッジ同期（R2 → Vectorize）         |
| `/admin/knowledge/sync/:source`    | POST     | 特定ファイルのみ同期                     |
| `/admin/knowledge`                 | DELETE   | 全ナレッジ削除                           |
| `/admin/persona`                   | GET      | ペルソナ一覧取得                         |
| `/admin/persona/extract`           | POST     | 全スレッドからペルソナ抽出               |
| `/admin/persona/extract/:threadId` | POST     | 特定スレッドからペルソナ抽出             |
| `/admin/persona`                   | DELETE   | 全ペルソナ削除                           |
| `/swagger`                         | GET      | Swagger UI                               |
| `/doc`                             | GET      | OpenAPI スキーマ                         |

## Mastra エージェント

| ID               | 説明                                   | モデル              |
| ---------------- | -------------------------------------- | ------------------- |
| `nep-chan`       | メインキャラクター（ねっぷちゃん）     | gemini-2.5-flash    |
| `weather-agent`  | 天気情報取得                           | gemini-2.5-flash    |
| `web-researcher` | Web 検索用サブエージェント             | gemini-2.5-flash    |
| `village-info`   | 村情報提供                             | gemini-2.5-flash    |
| `master`         | 村長モード専用データ分析               | gemini-2.5-flash    |
| `emergency`      | 緊急事態対応                           | gemini-2.5-flash    |
| `persona`        | ペルソナ（村の集合知）管理             | gemini-2.5-flash    |
| `knowledge`      | RAG ナレッジ検索                       | gemini-2.5-flash    |

## Mastra ツール

| ツール名                 | 説明                                 |
| ------------------------ | ------------------------------------ |
| `weatherTool`            | Open-Meteo API で天気取得            |
| `searchGoogleTool`       | Google Custom Search                 |
| `verifyPasswordTool`     | 村長モード認証                       |
| `devTool`                | Working Memory 表示（デバッグ用）    |
| `personaGetTool`         | 村の集合知検索                       |
| `personaSaveTool`        | ペルソナ保存                         |
| `personaUpdateTool`      | ペルソナ更新                         |
| `personaAggregateTool`   | ペルソナ集計                         |
| `emergencyReportTool`    | 緊急情報記録                         |
| `emergencyUpdateTool`    | 緊急情報更新                         |
| `emergencyGetTool`       | 緊急情報取得                         |
| `villageSearchTool`      | 村検索                               |
| `knowledgeSearchTool`    | RAG ナレッジ検索（Vectorize）        |

## 開発コマンド

```bash
# ルートレベル
pnpm server:dev              # server 開発サーバー
pnpm server:deploy           # server 本番デプロイ
pnpm web:dev                 # web 開発サーバー
pnpm web:build               # web 本番ビルド
pnpm web:deploy              # web 本番デプロイ
pnpm mastra:dev              # Mastra Playground
pnpm lint                    # Biome + TypeScript 型チェック
pnpm lint:fix                # Biome 自動修正
pnpm format                  # Biome フォーマット

# server パッケージ
pnpm --filter @aiss-nepch/server dev      # 開発サーバー
pnpm --filter @aiss-nepch/server test     # テスト実行
pnpm --filter @aiss-nepch/server deploy   # デプロイ

# Drizzle ORM / D1 マイグレーション
pnpm db:generate             # スキーマから SQL 生成 → server/migrations/
pnpm db:migrate              # リモート D1 (aiss-nepch-dev) に適用
pnpm db:migrate:local        # ローカル D1 に適用
pnpm db:studio               # Drizzle Studio（DB GUI）起動
pnpm db:push                 # スキーマを直接 DB に反映（開発用）
pnpm db:check                # スキーマとマイグレーションの整合性チェック

# ナレッジ管理
pnpm knowledge:upload              # 全ファイルを R2 にアップロード（自動同期）
pnpm knowledge:upload --file=x.md  # 特定ファイルのみアップロード
pnpm knowledge:upload --clean      # 全ナレッジを削除
```

## パス別名

```typescript
// ~ は src/ を指す
import { something } from "~/middleware";
```

## コーディング規約

### ルート定義

- `@hono/zod-openapi` の `createRoute` でルートを定義
- スキーマは Zod で定義し、OpenAPI 自動生成に活用

### Mastra 関連

- エージェントは `mastra/agents/` に配置
- ツールは `mastra/tools/` に配置
- ワークフローは `mastra/workflows/` に配置
- スコアラーは `mastra/scorers/` に配置
- スキーマは `mastra/schemas/` に配置
- **重要**: Mastra v1.0.0-beta を使用中。ドキュメント参照時は v1 の API を確認すること
  - MCP ツール (`mcp__mastra__mastraDocs`) を使用して最新のドキュメントを取得可能
  - `createTool` の `execute` シグネチャ: `execute: async (inputData, context) => { ... }`
    - `inputData`: inputSchema で定義したフィールドを直接受け取る
    - `context?.requestContext`: RuntimeContext へのアクセス（storage, db など）

### D1Store 初期化パターン

```typescript
const storage = new D1Store({ id: "mastra-storage", binding: db });
await storage.init(); // 重要：初期化必須
```

### エラーハンドリング

- HTTP エラーは `HTTPException` をスロー
- グローバルエラーハンドラーで一元的に処理

## 環境変数（シークレット）

API キーなどの機密情報は Cloudflare Workers のシークレットとして管理する。
`wrangler.jsonc` の `vars` には含めないこと。

### シークレット一覧

#### Cloudflare Workers（server）

| 変数名                         | 説明                             |
| ------------------------------ | -------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI キー        |
| `GOOGLE_SEARCH_ENGINE_ID`      | Google Custom Search エンジン ID |
| `MASTER_PASSWORD`              | 村長モードのパスワード           |

#### Cloudflare Pages（web）

| 変数名                | 説明                       |
| --------------------- | -------------------------- |
| `BASIC_AUTH_USER`     | Basic 認証のユーザー名     |
| `BASIC_AUTH_PASSWORD` | Basic 認証のパスワード     |

### シークレットの登録方法

```bash
# 開発環境（ローカル）
# .dev.vars ファイルを作成し、環境変数を設定
echo "GOOGLE_GENERATIVE_AI_API_KEY=your-api-key" >> ./server/.dev.vars
echo "GOOGLE_SEARCH_ENGINE_ID=your-engine-id" >> ./server/.dev.vars
echo "MASTER_PASSWORD=your-password" >> ./server/.dev.vars

# 本番環境（Cloudflare Workers）
cd server
wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
wrangler secret put GOOGLE_SEARCH_ENGINE_ID
wrangler secret put MASTER_PASSWORD

# 本番環境（Cloudflare Pages）
cd web
wrangler pages secret put BASIC_AUTH_USER
wrangler pages secret put BASIC_AUTH_PASSWORD
```

### コードでのアクセス方法

```typescript
// ルートハンドラ
const env = c.env;
const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;

// Mastra ツール内
execute: async (inputData, context) => {
  const env = context?.requestContext?.get("env") as CloudflareBindings | undefined;
  const apiKey = env?.GOOGLE_GENERATIVE_AI_API_KEY;
};
```

## データベーステーブル

### emergency_reports

緊急報告を管理するテーブル。

| カラム      | 型   | 説明           |
| ----------- | ---- | -------------- |
| id          | TEXT | PRIMARY KEY    |
| type        | TEXT | 種別（NOT NULL） |
| description | TEXT | 説明           |
| location    | TEXT | 場所           |
| reported_at | TEXT | 報告日時（NOT NULL） |
| updated_at  | TEXT | 更新日時       |

### persona

村の集合知を管理するテーブル。

| カラム              | 型   | 説明                 |
| ------------------- | ---- | -------------------- |
| id                  | TEXT | PRIMARY KEY          |
| resource_id         | TEXT | リソース ID（NOT NULL） |
| category            | TEXT | カテゴリ（NOT NULL） |
| tags                | TEXT | タグ（JSON 配列）    |
| content             | TEXT | 内容（NOT NULL）     |
| source              | TEXT | 情報源               |
| topic               | TEXT | トピック             |
| sentiment           | TEXT | 感情（default: neutral） |
| demographic_summary | TEXT | 属性サマリー         |
| created_at          | TEXT | 作成日時（NOT NULL） |
| updated_at          | TEXT | 更新日時             |

### thread_persona_status

ペルソナ抽出の処理状態を管理するテーブル。

| カラム             | 型      | 説明                   |
| ------------------ | ------- | ---------------------- |
| thread_id          | TEXT    | PRIMARY KEY            |
| last_extracted_at  | TEXT    | 最終抽出日時           |
| last_message_count | INTEGER | 処理済みメッセージ数   |

## Cron Trigger

| スケジュール | ハンドラー           | 説明                          |
| ------------ | -------------------- | ----------------------------- |
| `0 18 * * *` | handlePersonaExtract | ペルソナ抽出（毎日03:00 JST） |

## ペルソナ抽出バッチ処理

### 概要

会話履歴から村の集合知（ペルソナ）を抽出するバッチ処理。`personaAgent` が会話を分析し、意見・関心事・困りごとなどを匿名化して蓄積する。

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

### ファイル構成

| パス | 説明 |
| ---- | ---- |
| `server/src/services/persona-extractor.ts` | 抽出ロジック |
| `server/src/routes/admin/persona.ts` | 管理 API |
| `server/src/handlers/persona-extract-handler.ts` | Cron ハンドラー |
| `server/src/repository/thread-persona-status-repository.ts` | 処理状態管理 |

### 抽出結果タイプ

| タイプ    | reason             | 説明                       |
| --------- | ------------------ | -------------------------- |
| extracted | -                  | ペルソナが抽出・保存された |
| skipped   | no_new_messages    | 新しいメッセージがない     |
| skipped   | empty_conversation | 空の会話                   |
| skipped   | no_persona_found   | ペルソナ保存不要の会話     |
| skipped   | extraction_error   | 抽出処理でエラー発生       |

### 差分処理

`thread_persona_status.last_message_count` を記録し、前回処理以降の新しいメッセージのみを抽出対象とする。これにより同じ会話の重複抽出を防止。

`extracted` と `skipped`（`messageCount` あり）の両方で `thread_persona_status` を更新し、再処理を防ぐ。

### 重複登録の考え方

| ケース | 動作 |
| ------ | ---- |
| 異なるスレッドで同じ意見 | 別々に登録OK（複数人の声 = 重要） |
| 同じスレッドの同じ会話を再処理 | スキップ（差分処理で防止） |
| 同じスレッドに新しい会話追加 | 新しい部分のみ抽出・登録 |
| 1つのスレッドに複数トピック | 複数のペルソナとして登録OK |

## RAG ナレッジ機能

### 概要

村の情報を Markdown ファイルとして管理し、ベクトル検索で関連情報を取得する RAG（Retrieval-Augmented Generation）機能。

### アーキテクチャ

```text
knowledge/*.md → R2 バケット → Vectorize（embeddings）
                                ↓
                       knowledgeSearchTool で検索
```

### ファイル構成

| パス | 説明 |
| ---- | ---- |
| `knowledge/` | ナレッジ Markdown ファイル |
| `scripts/upload-knowledge.ts` | アップロードスクリプト |
| `server/src/mastra/knowledge/index.ts` | chunk 分割・embeddings 生成・同期処理 |
| `server/src/mastra/tools/knowledge-search-tool.ts` | ベクトル検索ツール |
| `server/src/routes/admin/knowledge.ts` | 管理 API |

### 処理フロー

1. `pnpm knowledge:upload` で `knowledge/*.md` を R2 にアップロード
2. R2 Event Notifications により自動的に Vectorize 同期が実行
3. Workers 内で R2 からファイルを読み込み
4. `MDocument.fromMarkdown()` で chunk 分割（Mastra RAG）
5. 短いチャンク（100文字未満）をフィルタリング
6. `embedMany()` で embeddings 生成（Google gemini-embedding-001, 1536次元）
7. Vectorize に upsert

### チャンクフィルタリング

短すぎるチャンク（見出しのみ、短い導入文など）は汎用的な embedding を生成し、検索精度を低下させる。これを防ぐため、100文字未満のチャンクは同期時に除外される。

```typescript
const MIN_CHUNK_LENGTH = 100;
```

### Embedding モデル

| 用途 | モデル | 次元数 | taskType |
| ---- | ------ | ------ | -------- |
| ドキュメント登録 | gemini-embedding-001 | 1536 | RETRIEVAL_DOCUMENT |
| 検索クエリ | gemini-embedding-001 | 1536 | RETRIEVAL_QUERY |

`gemini-embedding-001` は Google の多言語対応 embedding モデルで、日本語を含む100以上の言語をサポート。MTEB 多言語ランキング1位。Matryoshka Representation Learning により、3072次元から1536次元に削減して使用。

### Cloudflare バインディング

| バインディング | リソース |
| -------------- | -------- |
| `KNOWLEDGE_BUCKET` | R2 バケット `aiss-nepch-knowledge` |
| `VECTORIZE` | Vectorize インデックス `knowledge` |

## Drizzle ORM

### 概要

Cloudflare D1 に対する型安全なクエリビルダー。生 SQL の代わりに Drizzle ORM を使用し、SQL インジェクションを防止しつつ型安全性を確保。

### ファイル構成

| パス | 説明 |
| ---- | ---- |
| `server/src/db/schema.ts` | テーブルスキーマ定義 |
| `server/src/db/client.ts` | DB クライアント生成関数 |
| `server/src/db/index.ts` | エクスポート |
| `server/drizzle.config.ts` | Drizzle Kit 設定 |

### スキーマ定義

```typescript
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const persona = sqliteTable("persona", {
  id: text("id").primaryKey(),
  resourceId: text("resource_id").notNull(),
  category: text("category").notNull(),
  // ...
});

// 型推論
export type Persona = typeof persona.$inferSelect;
export type NewPersona = typeof persona.$inferInsert;
```

### DB クライアント使用方法

```typescript
import { createDb, persona } from "~/db";
import { eq, desc } from "drizzle-orm";

// D1Database から Drizzle クライアント生成
const db = createDb(c.env.DB);

// SELECT
const result = await db
  .select()
  .from(persona)
  .where(eq(persona.id, "xxx"))
  .get();

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

### D1 マイグレーションフロー

```bash
# 1. スキーマを変更（server/src/db/schema.ts）

# 2. マイグレーションファイル生成
pnpm db:generate   # → server/migrations/ に SQL 生成

# 3. D1 に適用
pnpm db:migrate        # リモート D1 (aiss-nepch-dev)
pnpm db:migrate:local  # ローカル D1
```

### テスト用 DB

`@libsql/client` のインメモリ SQLite を使用。

```typescript
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({ url: ":memory:" });
const db = drizzle(client, { schema });
```

## ブランチ戦略

- **メインブランチ**: `develop`
- **機能ブランチ**: `feature/*`
