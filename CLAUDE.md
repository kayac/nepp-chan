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
│   │   ├── repository/
│   │   │   ├── persona-repository.ts
│   │   │   ├── emergency-repository.ts
│   │   │   └── migrations/
│   │   │       └── 001_init.sql
│   │   └── __tests__/
│   ├── knowledge/                       # ナレッジ Markdown ファイル
│   ├── scripts/
│   │   └── upload-knowledge.ts          # R2 アップロード + 同期スクリプト
│   ├── wrangler.jsonc
│   └── vitest.config.ts
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
│   │   ├── lib/
│   │   │   └── api/                 # API クライアント
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

| パス                        | メソッド | 説明                           |
| --------------------------- | -------- | ------------------------------ |
| `/health`                   | GET      | ヘルスチェック                 |
| `/chat`                     | POST     | チャットメッセージ送信（ストリーミング） |
| `/threads`                  | GET      | スレッド一覧取得（ページング対応） |
| `/threads`                  | POST     | スレッド作成                   |
| `/threads/:threadId`        | GET      | スレッド詳細取得               |
| `/threads/:threadId/messages` | GET    | メッセージ履歴取得             |
| `/weather`                  | GET      | 天気情報取得（ワークフロー経由） |
| `/admin/knowledge/sync`     | POST     | 全ナレッジ同期（R2 → Vectorize） |
| `/admin/knowledge/sync/:source` | POST | 特定ファイルのみ同期           |
| `/admin/knowledge`          | DELETE   | 全ナレッジ削除                 |
| `/swagger`                  | GET      | Swagger UI                     |
| `/doc`                      | GET      | OpenAPI スキーマ               |

## Mastra エージェント

| ID               | 説明                                   | モデル              |
| ---------------- | -------------------------------------- | ------------------- |
| `nep-chan`       | メインキャラクター（ねっぷちゃん）     | gemini-2.0-flash    |
| `weather-agent`  | 天気情報取得                           | gemini-2.0-flash    |
| `web-researcher` | Web 検索用サブエージェント             | gemini-2.0-flash    |
| `village-info`   | 村情報提供                             | gemini-2.0-flash    |
| `master`         | 村長モード専用データ分析               | gemini-2.0-flash    |
| `emergency`      | 緊急事態対応                           | gemini-2.0-flash    |
| `persona`        | ペルソナ（村の集合知）管理             | gemini-2.0-flash    |
| `knowledge`      | RAG ナレッジ検索                       | gemini-2.0-flash    |

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

# D1 マイグレーション
wrangler d1 execute aiss-nepch-dev --file=./server/src/repository/migrations/001_init.sql

# ナレッジ管理
pnpm knowledge:upload            # R2 にアップロード + Vectorize 同期
pnpm knowledge:upload --sync-only # 同期のみ（アップロードスキップ）
pnpm knowledge:clear             # 全ナレッジ削除して再同期
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

| 変数名                         | 説明                             |
| ------------------------------ | -------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI キー        |
| `GOOGLE_SEARCH_ENGINE_ID`      | Google Custom Search エンジン ID |
| `MASTER_PASSWORD`              | 村長モードのパスワード           |

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

## RAG ナレッジ機能

### 概要

村の情報を Markdown ファイルとして管理し、ベクトル検索で関連情報を取得する RAG（Retrieval-Augmented Generation）機能。

### アーキテクチャ

```text
server/knowledge/*.md → R2 バケット → Vectorize（embeddings）
                                    ↓
                           knowledgeSearchTool で検索
```

### ファイル構成

| パス | 説明 |
| ---- | ---- |
| `server/knowledge/` | ナレッジ Markdown ファイル |
| `server/src/mastra/knowledge/index.ts` | chunk 分割・embeddings 生成・同期処理 |
| `server/src/mastra/tools/knowledge-search-tool.ts` | ベクトル検索ツール |
| `server/src/routes/admin/knowledge.ts` | 管理 API |
| `server/scripts/upload-knowledge.ts` | アップロードスクリプト |

### 処理フロー

1. `pnpm knowledge:upload` で `server/knowledge/*.md` を R2 にアップロード（`--remote` フラグ必須）
2. 本番 API の `/admin/knowledge/sync` を呼び出し
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

## ブランチ戦略

- **メインブランチ**: `develop`
- **機能ブランチ**: `feature/*`
