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
│   │   ├── index.ts                 # エントリーポイント
│   │   ├── app.ts                   # Hono アプリケーション設定
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

### エラーハンドリング

- HTTP エラーは `HTTPException` をスロー
- グローバルエラーハンドラーで一元的に処理

## 環境変数

| 変数名                         | 説明                      |
| ------------------------------ | ------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI キー |

## ブランチ戦略

- **メインブランチ**: `develop`
- **機能ブランチ**: `feature/*`
