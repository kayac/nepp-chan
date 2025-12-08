# @aiss-nepch/server

Mastra フレームワークを活用した AI-powered Weather Assistant API。

## セットアップ

```bash
pnpm install
```

## 開発

```bash
pnpm dev
```

開発サーバー起動後、以下の URL でアクセスできます：

| URL                                                    | 説明                    |
| ------------------------------------------------------ | ----------------------- |
| <http://localhost:8787/swagger>                        | Swagger UI（API 操作）  |
| <http://localhost:8787/doc>                            | OpenAPI スキーマ (JSON) |
| <http://localhost:8787/health>                         | ヘルスチェック          |

## API エンドポイント

| パス       | メソッド | 説明                             |
| ---------- | -------- | -------------------------------- |
| `/health`  | GET      | ヘルスチェック                   |
| `/chat`    | POST     | チャットメッセージ送信           |
| `/weather` | GET      | 天気情報取得（ワークフロー経由） |

## API テスト（curl）

### ヘルスチェック

```bash
curl http://localhost:8787/health
```

### チャット

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "東京の天気を教えて"}'
```

オプションパラメータ付き：

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "東京の天気を教えて", "resourceId": "user-123", "threadId": "thread-abc"}'
```

### 天気情報取得

```bash
curl "http://localhost:8787/weather?city=tokyo"
```

別の都市：

```bash
curl "http://localhost:8787/weather?city=osaka"
```

## スクリプト

```bash
pnpm dev        # 開発サーバー起動
pnpm test       # テスト実行
pnpm lint       # リント
pnpm format     # フォーマット
pnpm check      # 型チェック
pnpm deploy     # Cloudflare Workers へデプロイ
pnpm cf-typegen # Cloudflare 型生成
```

## 環境変数

| 変数名                         | 説明                      |
| ------------------------------ | ------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI キー |

## Cloudflare 型生成

[Workers の設定に基づいて型を生成/同期するには](https://developers.cloudflare.com/workers/wrangler/commands/#types)：

```bash
pnpm cf-typegen
```

`CloudflareBindings` を Hono インスタンス化時にジェネリクスとして渡します：

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
