# CLAUDE.md - aiss-nepch

## プロジェクト概要

音威子府村の AI キャラクター「ねっぷちゃん」チャットシステム。Mastra AI フレームワークを活用し、Cloudflare Workers（API）+ Cloudflare Pages（Web）で稼働するモノレポ構成。

### 主要機能

- **ねっぷちゃんチャット**: 音威子府村 17 歳の AI キャラクターとの会話
- **村長モード**: `/master` コマンドでパスワード認証後、データ分析機能を利用可能
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
- **AI SDK React** (@ai-sdk/react)

### データベース

- **Cloudflare D1** - SQLite ベースのエッジデータベース
- **D1Store** (@mastra/cloudflare-d1) - Mastra ストレージアダプタ

### 開発ツール

- **TypeScript** 5.9
- **Zod** 4 - スキーマバリデーション
- **Vitest** - テストフレームワーク
- **Biome** - フォーマッター/リンター
- **pnpm** - パッケージマネージャー（Node.js >= 22.13.0）

## プロジェクト構成

```
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
│   │   │   ├── agents/              # AI エージェント（5 個）
│   │   │   ├── tools/               # ツール（11 個）
│   │   │   ├── workflows/           # ワークフロー
│   │   │   ├── scorers/             # 評価スコアラー
│   │   │   ├── schemas/             # Zod スキーマ（persona 等）
│   │   │   ├── mcp/                 # MCP 設定
│   │   │   ├── factory.ts           # Mastra インスタンス生成
│   │   │   ├── request-context.ts   # RuntimeContext 管理
│   │   │   └── index.ts
│   │   ├── db/
│   │   │   ├── persona-repository.ts
│   │   │   ├── emergency-repository.ts
│   │   │   └── migrations/
│   │   │       ├── 001_emergency_reports.sql
│   │   │       └── 002_persona.sql
│   │   └── __tests__/
│   ├── wrangler.jsonc
│   └── vitest.config.ts
├── web/                             # フロントエンド（Cloudflare Pages）
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   └── lib/
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
| `/swagger`                  | GET      | Swagger UI                     |
| `/doc`                      | GET      | OpenAPI スキーマ               |

## Mastra エージェント

| ID              | 説明                                   | モデル              |
| --------------- | -------------------------------------- | ------------------- |
| `nep-chan`      | メインキャラクター（ねっぷちゃん）     | gemini-2.5-flash    |
| `weather-agent` | 天気情報取得                           | gemini-2.5-pro      |
| `web-researcher`| Web 検索用サブエージェント             | gemini-2.5-flash    |
| `village-info`  | 村情報提供                             | gemini-2.5-flash    |
| `master`        | 村長モード専用データ分析               | gemini-2.5-flash    |

## Mastra ツール

| ツール名              | 説明                                 |
| --------------------- | ------------------------------------ |
| `weatherTool`         | Open-Meteo API で天気取得            |
| `searchGoogleTool`    | Google Custom Search                 |
| `verifyPasswordTool`  | 村長モード認証                       |
| `devTool`             | Working Memory 表示（デバッグ用）    |
| `personaGetTool`      | 村の集合知検索                       |
| `personaSaveTool`     | ペルソナ保存                         |
| `personaUpdateTool`   | ペルソナ更新                         |
| `emergencyReportTool` | 緊急情報記録                         |
| `emergencyUpdateTool` | 緊急情報更新                         |
| `emergencyGetTool`    | 緊急情報取得                         |
| `villageSearchTool`   | 村検索                               |

## 開発コマンド

```bash
# ルートレベル
pnpm dev                     # web 開発サーバー
pnpm build                   # web 本番ビルド
pnpm server:dev              # server 開発サーバー
pnpm server:deploy           # server 本番デプロイ
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
wrangler d1 execute aiss-nepch-dev --file=./server/src/db/migrations/001_emergency_reports.sql
wrangler d1 execute aiss-nepch-dev --file=./server/src/db/migrations/002_persona.sql
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

| カラム     | 型      | 説明                               |
| ---------- | ------- | ---------------------------------- |
| id         | TEXT    | PRIMARY KEY                        |
| resourceId | TEXT    | リソース ID                        |
| status     | TEXT    | 状態（active/resolved/archived）   |
| severity   | TEXT    | 重要度（low/medium/high/critical） |
| location   | TEXT    | 場所                               |
| content    | TEXT    | 内容                               |
| createdAt  | TEXT    | 作成日時                           |
| updatedAt  | TEXT    | 更新日時                           |

### personas

村の集合知を管理するテーブル。

| カラム     | 型      | 説明                |
| ---------- | ------- | ------------------- |
| id         | TEXT    | PRIMARY KEY         |
| resourceId | TEXT    | リソース ID         |
| category   | TEXT    | カテゴリ            |
| tags       | TEXT    | タグ（JSON 配列）   |
| content    | TEXT    | 内容                |
| source     | TEXT    | 情報源              |
| confidence | REAL    | 信頼度（0-1）       |
| createdAt  | TEXT    | 作成日時            |
| updatedAt  | TEXT    | 更新日時            |

## ブランチ戦略

- **メインブランチ**: `develop`
- **機能ブランチ**: `feature/*`
