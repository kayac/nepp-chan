# CLAUDE.md - nepp-chan

音威子府村 AI キャラクター「ねっぷちゃん」チャットシステム。
Cloudflare Workers（API）+ Pages（Web）のモノレポ構成。

## クイックリファレンス

```bash
# 開発
pnpm server:dev          # API 開発サーバー（8787）
pnpm web:dev             # Web 開発サーバー（5173）

# 品質チェック
pnpm lint                # Biome + tsc
pnpm format              # Biome フォーマット

# DB マイグレーション
pnpm db:generate            # スキーマ → SQL 生成
pnpm db:migrate:local       # ローカル D1 適用
pnpm db:migrate             # dev 環境 D1 適用
pnpm db:migrate:production  # prd 環境 D1 適用

# ナレッジ
pnpm knowledge:upload    # R2 アップロード → Vectorize 同期
```

## プロジェクト構造

```text
server/              → API（詳細: server/CLAUDE.md）
web/                 → フロントエンド（詳細: web/CLAUDE.md）
knowledge/           → RAG 用 Markdown ファイル
```

## 重要な規約

### パス別名

```typescript
import { something } from "~/middleware"; // ~ = src/
```

### Mastra 配置ルール

- `mastra/agents/` - Agent のみ
- `mastra/tools/` - Tool のみ
- `mastra/workflows/` - Workflow のみ
- `services/` - ビジネスロジック（Mastra プリミティブ以外）

### createTool シグネチャ

```typescript
execute: async (inputData, context) => {
  const env = context?.requestContext?.get("env") as CloudflareBindings;
  // inputData は inputSchema のフィールドを直接持つ
};
```

### D1Store 初期化

```typescript
const storage = new D1Store({ id: "mastra-storage", binding: db });
await storage.init(); // 必須
```

## 環境変数

`.env.example` をコピーして `.env` を作成。

```bash
# ルート
cp .env.example .env
cp .env.production.example .env.production  # 本番ナレッジアップロード用（任意）

# server
cp server/.env.example server/.env
cp server/.dev.vars.example server/.dev.vars
cp server/wrangler.jsonc.example server/wrangler.jsonc

# web
cp web/.env.example web/.env
```

### ルート環境変数

| 変数名                 | 用途                           |
| ---------------------- | ------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID`| Cloudflare アカウント ID       |
| `R2_BUCKET_NAME`       | R2 バケット名                  |
| `VECTORIZE_INDEX_NAME` | Vectorize インデックス名       |
| `API_URL`              | API エンドポイント URL         |
| `ADMIN_KEY`            | 管理 API 認証キー              |

### server 環境変数

| 変数名                         | 用途              |
| ------------------------------ | ----------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API        |
| `GOOGLE_SEARCH_ENGINE_ID`      | Custom Search     |
| `WEB_URL`                      | Web URL           |

### web 環境変数

| 変数名         | 用途    |
| -------------- | ------- |
| `VITE_API_URL` | API URL |

### 本番環境

本番環境の機密情報は Cloudflare の環境変数で管理。

```bash
# Workers シークレット
wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY

# Pages 環境変数は Cloudflare Dashboard で設定
```

## デプロイ環境

| 環境 | Web | API |
| ---- | --- | --- |
| ローカル | http://localhost:5173 | http://localhost:8787 |
| dev | https://dev-web.nepp-chan.ai | https://dev-api.nepp-chan.ai |
| prd | https://web.nepp-chan.ai | https://api.nepp-chan.ai |

## ブランチ

- メイン: `develop`
- 機能: `feature/*`
