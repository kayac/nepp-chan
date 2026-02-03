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

## 環境変数（dotenvx）

dotenvx で暗号化。復号化には `.env.keys` が必要。

```text
/
├── .env.keys              ← 復号化キー
├── server/
│   ├── .env               ← 開発環境
│   └── .env.production    ← 本番環境
└── web/
    ├── .env               ← 開発環境
    └── .env.production    ← 本番環境
```

### 運用

```bash
# 新しい変数を追加（自動で暗号化）
npx dotenvx set NEW_VAR "value" -fk .env.keys -f server/.env

# 復号化して確認
npx dotenvx run -fk .env.keys -f server/.env -- printenv NEW_VAR

# CI/CD では環境変数で復号化キーを設定
export DOTENV_PRIVATE_KEY="<開発用キー>"
export DOTENV_PRIVATE_KEY_PRODUCTION="<本番用キー>"
```

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

## デプロイ環境

| 環境 | Web | API |
| ---- | --- | --- |
| ローカル | http://localhost:5173 | http://localhost:8787 |
| dev | https://dev-web.nepp-chan.ai | https://dev-api.nepp-chan.ai |
| prd | https://web.nepp-chan.ai | https://api.nepp-chan.ai |

## ブランチ

- メイン: `develop`
- 機能: `feature/*`
