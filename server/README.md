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
pnpm dev              # 開発サーバー起動
pnpm test             # テスト実行
pnpm deploy           # Cloudflare Workers へデプロイ
pnpm cf-typegen       # Cloudflare 型生成
pnpm knowledge:upload # ナレッジアップロード
pnpm knowledge:clear  # ナレッジ全削除して再アップロード
```

## ナレッジ機能（RAG）

音威子府村の情報をベクトルDBに保存し、チャット時に検索できる機能。

### セットアップ

1. **Vectorize インデックス作成**（初回のみ）

```bash
wrangler vectorize create knowledge --dimensions=768 --metric=cosine
```

2. **ADMIN_KEY シークレット設定**

```bash
# ローカル開発（.dev.varsに追記）
echo "ADMIN_KEY=your-admin-key" >> .dev.vars

# 本番環境
wrangler secret put ADMIN_KEY
```

### ナレッジファイルの配置

`knowledge/` ディレクトリにMarkdownファイルを配置：

```
knowledge/
├── mayor-interview.md    # 村長インタビュー
├── village-info.md       # 村の基本情報
├── tourist-spots.md      # 観光スポット
└── history.md            # 村の歴史
```

**Markdownの書き方**

```markdown
# 村長インタビュー

## 村長の政策について

### 移住促進

移住者向けの支援制度があります...

### 観光振興

音威子府そばを中心とした...
```

- `#` (H1): ドキュメントタイトル
- `##` (H2): セクション（検索時のフィルタに使用）
- `###` (H3): サブセクション（チャンク分割の単位）

### アップロード

```bash
# 全ファイルアップロード
pnpm knowledge:upload

# クリーンアップして再アップロード（全削除→再登録）
pnpm knowledge:upload --clean

# 特定ファイルのみアップロード
pnpm knowledge:upload --file=mayor-interview.md

# 特定ファイルをクリーンアップして再アップロード
pnpm knowledge:upload --clean --file=mayor-interview.md
```

**必要な環境変数**

```bash
export ADMIN_KEY=your-admin-key
export GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
export API_URL=http://localhost:8787  # デフォルト
```

### 管理API

| パス                           | メソッド | 説明                     |
| ------------------------------ | -------- | ------------------------ |
| `/admin/knowledge/upsert`      | POST     | ベクトルデータをupsert   |
| `/admin/knowledge`             | DELETE   | 全ナレッジを削除         |
| `/admin/knowledge/:source`     | DELETE   | 特定ソース（ファイル）を削除 |

**認証**: `X-Admin-Key` ヘッダーが必要

```bash
# 全削除
curl -X DELETE \
  -H "X-Admin-Key: your-admin-key" \
  http://localhost:8787/admin/knowledge

# 特定ファイルのみ削除
curl -X DELETE \
  -H "X-Admin-Key: your-admin-key" \
  "http://localhost:8787/admin/knowledge/mayor-interview.md"
```

### 動作確認

チャットで村に関する質問をすると、ナレッジベースから検索されます：

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "村長の政策について教えて"}'
```

## 環境変数

| 変数名                         | 説明                             |
| ------------------------------ | -------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI キー        |
| `GOOGLE_SEARCH_ENGINE_ID`      | Google Custom Search エンジン ID |
| `MASTER_PASSWORD`              | 村長モードのパスワード           |
| `ADMIN_KEY`                    | 管理API認証キー（ナレッジ管理用）|

## Cloudflare 型生成

```bash
pnpm cf-typegen
```

`CloudflareBindings` を Hono インスタンス化時にジェネリクスとして渡す：

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
