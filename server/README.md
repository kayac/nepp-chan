# @aiss-nepch/server

ねっぷちゃんチャットシステムの API サーバー。Mastra AI フレームワークを活用し、Cloudflare Workers 上で動作。

## セットアップ

```bash
pnpm install
```

### 環境変数の設定

`.dev.vars` ファイルを作成：

```
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
GOOGLE_SEARCH_ENGINE_ID=your-engine-id
MASTER_PASSWORD=your-password
```

### D1 データベースの初期化

```bash
wrangler d1 execute aiss-nepch-dev --file=./src/db/migrations/001_emergency_reports.sql
wrangler d1 execute aiss-nepch-dev --file=./src/db/migrations/002_persona.sql
```

## 開発

```bash
pnpm dev
```

開発サーバー起動後、以下の URL でアクセス：

| URL                             | 説明                    |
| ------------------------------- | ----------------------- |
| http://localhost:8787/swagger   | Swagger UI（API 操作）  |
| http://localhost:8787/doc       | OpenAPI スキーマ (JSON) |
| http://localhost:8787/health    | ヘルスチェック          |

## API エンドポイント

| パス                          | メソッド | 説明                             |
| ----------------------------- | -------- | -------------------------------- |
| `/health`                     | GET      | ヘルスチェック                   |
| `/chat`                       | POST     | チャットメッセージ送信（ストリーミング） |
| `/threads`                    | GET      | スレッド一覧取得（ページング対応） |
| `/threads`                    | POST     | スレッド作成                     |
| `/threads/:threadId`          | GET      | スレッド詳細取得                 |
| `/threads/:threadId/messages` | GET      | メッセージ履歴取得               |
| `/weather`                    | GET      | 天気情報取得（ワークフロー経由） |

## API テスト（curl）

### ヘルスチェック

```bash
curl http://localhost:8787/health
```

### チャット

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "こんにちは！"}'
```

オプションパラメータ付き：

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "こんにちは！", "resourceId": "user-123", "threadId": "thread-abc"}'
```

### スレッド一覧取得

```bash
curl "http://localhost:8787/threads?resourceId=user-123&page=1&perPage=10"
```

### 天気情報取得

```bash
curl "http://localhost:8787/weather?city=tokyo"
```

## スクリプト

```bash
pnpm dev        # 開発サーバー起動
pnpm test       # テスト実行
pnpm deploy     # Cloudflare Workers へデプロイ
pnpm cf-typegen # Cloudflare 型生成
```

## 環境変数

| 変数名                         | 説明                             |
| ------------------------------ | -------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI キー        |
| `GOOGLE_SEARCH_ENGINE_ID`      | Google Custom Search エンジン ID |
| `MASTER_PASSWORD`              | 村長モードのパスワード           |

## Cloudflare 型生成

```bash
pnpm cf-typegen
```

`CloudflareBindings` を Hono インスタンス化時にジェネリクスとして渡す：

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
