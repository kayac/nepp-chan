# CLAUDE.md - aiss-nepch

## プロジェクト概要

Mastra フレームワークを活用した AI-powered Weather Assistant API。Cloudflare Workers 上で動作する。

## 技術スタック

### フレームワーク・ランタイム

- **Hono** - Web フレームワーク（OpenAPIHono で OpenAPI 統合）
- **Cloudflare Workers** - サーバーレスランタイム
- **Mastra** - AI エージェントフレームワーク（beta）

### AI/LLM

- **Google Generative AI** - Gemini 2.5 Pro

### データベース

- **Cloudflare D1** - SQLite ベースのエッジデータベース

### 開発ツール

- **TypeScript** (5.9)
- **Zod** - スキーマバリデーション
- **Vitest** - テストフレームワーク
- **Biome** - フォーマッター/リンター
- **pnpm** - パッケージマネージャー

## プロジェクト構成

```
aiss-nepch/
├── server/                          # バックエンド API サーバー
│   ├── src/
│   │   ├── index.ts                 # エントリーポイント・Hono アプリケーション設定
│   │   ├── middleware/              # ミドルウェア
│   │   │   ├── cors.ts              # CORS
│   │   │   └── error-handler.ts     # グローバルエラーハンドラー
│   │   ├── routes/                  # API ルート
│   │   │   ├── health.ts            # ヘルスチェック
│   │   │   ├── chat.ts              # チャット機能
│   │   │   └── weather.ts           # 天気情報取得
│   │   ├── mastra/                  # Mastra 関連
│   │   │   ├── agents/              # AI エージェント定義
│   │   │   ├── tools/               # ツール定義
│   │   │   ├── workflows/           # ワークフロー定義
│   │   │   └── scorers/             # 評価スコアラー
│   │   └── __tests__/               # テストファイル
│   ├── wrangler.jsonc               # Cloudflare Workers 設定
│   └── vitest.config.ts             # Vitest 設定
├── pnpm-workspace.yaml              # pnpm モノレポ設定
├── biome.json                       # Biome 設定
└── tsconfig.json                    # TypeScript 共通設定
```

## API エンドポイント

| パス       | メソッド | 説明                           |
| ---------- | -------- | ------------------------------ |
| `/health`  | GET      | ヘルスチェック                 |
| `/chat`    | POST     | チャットメッセージ送信         |
| `/weather` | GET      | 天気情報取得（ワークフロー経由） |
| `/swagger` | GET      | Swagger UI                     |
| `/doc`     | GET      | OpenAPI スキーマ               |

## 開発コマンド

```bash
# 開発サーバー起動
pnpm --filter @aiss-nepch/server dev

# テスト実行
pnpm --filter @aiss-nepch/server test

# リント
pnpm --filter @aiss-nepch/server lint

# フォーマット
pnpm --filter @aiss-nepch/server format

# 型チェック
pnpm --filter @aiss-nepch/server check

# デプロイ
pnpm --filter @aiss-nepch/server deploy

# D1 マイグレーション（開発環境）
wrangler d1 execute aiss-nepch-dev --file=./server/src/db/migrations/<migration-file>.sql

# D1 マイグレーション（本番環境）
wrangler d1 execute aiss-nepch --file=./server/src/db/migrations/<migration-file>.sql
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
- **重要**: Mastra v1.0.0-beta を使用中。ドキュメント参照時は v1 の API を確認すること
  - MCP ツール (`mcp__mastra__mastraDocs`) を使用して最新のドキュメントを取得可能
  - `createTool` の `execute` シグネチャ: `execute: async (inputData, context) => { ... }`
    - `inputData`: inputSchema で定義したフィールドを直接受け取る
    - `context?.requestContext`: RuntimeContext へのアクセス（storage, db など）

### エラーハンドリング

- HTTP エラーは `HTTPException` をスロー
- グローバルエラーハンドラーで一元的に処理

## 環境変数（シークレット）

API キーなどの機密情報は Cloudflare Workers のシークレットとして管理する。
`wrangler.jsonc` の `vars` には含めないこと。

### シークレット一覧

| 変数名                         | 説明                        |
| ------------------------------ | --------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI キー   |
| `GOOGLE_SEARCH_ENGINE_ID`      | Google Custom Search エンジン ID |
| `MASTER_PASSWORD`              | 村長モードのパスワード      |

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

シークレットは `RuntimeContext` 経由で `c.env` から取得する。

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

## ブランチ戦略

- **メインブランチ**: `develop`
- **機能ブランチ**: `feature/*`
