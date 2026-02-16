# @nepp-chan/server

ねっぷちゃんチャットシステムの API サーバー。Mastra AI フレームワークを活用し、Cloudflare Workers 上で動作。

## セットアップ

```bash
pnpm install
```

### 環境変数の設定

`.env.example` をコピーして `.env` を作成。詳細はルートの [README.md](../README.md) を参照。

```bash
cp .env.example .env
cp wrangler.jsonc.example wrangler.jsonc
```

### wrangler 用環境変数

`.dev.vars.example` を `.dev.vars` にコピーして値を設定：

```bash
cp .dev.vars.example .dev.vars
```

### D1 データベースの初期化

```bash
# 初回セットアップ（既存マイグレーション適用）
pnpm db:migrate
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

## API テスト（curl）

### ヘルスチェック

```bash
curl http://localhost:8787/health
```

### チャット

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "id": "msg-1",
      "role": "user",
      "parts": [{"type": "text", "text": "こんにちは！"}]
    },
    "resourceId": "user-123",
    "threadId": "thread-abc"
  }'
```

### スレッド一覧取得

```bash
curl "http://localhost:8787/threads?resourceId=user-123&page=1&perPage=10"
```

## デプロイ環境

| 環境 | URL |
| ---- | --- |
| ローカル | http://localhost:8787 |
| dev | https://dev-api.nepp-chan.ai |
| prd | https://api.nepp-chan.ai |

## スクリプト

```bash
# 開発
pnpm dev              # 開発サーバー起動
pnpm test             # テスト実行
pnpm deploy           # dev 環境へデプロイ
pnpm deploy:production # prd 環境へデプロイ
pnpm cf-typegen       # Cloudflare 型生成

# Drizzle ORM / D1 マイグレーション
pnpm db:generate      # スキーマから SQL 生成 → src/db/migrations/
pnpm db:migrate       # リモート D1 (nepp-chan-db-dev) に適用
pnpm db:migrate:local # ローカル D1 に適用
pnpm db:studio        # Drizzle Studio（DB GUI）起動
pnpm db:check         # スキーマとマイグレーションの整合性チェック

# ナレッジ管理
pnpm knowledge:upload # ナレッジアップロード
pnpm knowledge:clear  # ナレッジ全削除して再アップロード
```

## Drizzle ORM

型安全な SQL クエリビルダー。Cloudflare D1 に対して SQL インジェクションを防止しつつ型安全にクエリを実行。

### スキーマ変更時のマイグレーションフロー

```bash
# 1. スキーマを変更
#    src/db/schema.ts を編集

# 2. マイグレーションファイル生成
pnpm db:generate   # → src/db/migrations/ に SQL 生成

# 3. D1 に適用
pnpm db:migrate        # リモート D1
pnpm db:migrate:local  # ローカル D1
```

### ファイル構成

| パス | 説明 |
| ---- | ---- |
| `src/db/schema.ts` | テーブルスキーマ定義 |
| `src/db/client.ts` | DB クライアント生成関数 |
| `src/db/migrations/` | マイグレーション SQL |
| `drizzle.config.ts` | Drizzle Kit 設定 |

### 使用例

```typescript
import { createDb, persona } from "~/db";
import { eq } from "drizzle-orm";

const db = createDb(c.env.DB);

// SELECT
const result = await db.select().from(persona).where(eq(persona.id, "xxx")).get();

// INSERT
await db.insert(persona).values({ id: "xxx", ... });

// UPDATE
await db.update(persona).set({ content: "新内容" }).where(eq(persona.id, "xxx"));

// DELETE
await db.delete(persona).where(eq(persona.id, "xxx"));
```

## ナレッジ機能（RAG）

音威子府村の情報をベクトルDBに保存し、チャット時に検索できる機能。

### セットアップ

1. **Vectorize インデックス作成**（初回のみ）

```bash
wrangler vectorize create nepp-chan-knowledge-dev --dimensions=1536 --metric=cosine
```

2. **管理者アカウントの作成**

管理 API を使用するには、パスキー認証でログインする必要があります。
初期管理者は招待スクリプトで作成します：

```bash
pnpm admin:invite admin@example.com
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

ルートの `.env` または `.env.local` に設定（詳細は [README.md](../README.md) 参照）

### 管理API

| パス                             | メソッド | 説明                           |
| -------------------------------- | -------- | ------------------------------ |
| `/admin/knowledge`               | DELETE   | 全ナレッジを削除               |
| `/admin/knowledge/sync`          | POST     | 全ナレッジを同期               |
| `/admin/knowledge/files`         | GET      | ファイル一覧取得               |
| `/admin/knowledge/files/:key`    | GET      | ファイル内容取得               |
| `/admin/knowledge/files/:key`    | PUT      | ファイル保存                   |
| `/admin/knowledge/files/:key`    | DELETE   | ファイル削除                   |
| `/admin/knowledge/upload`        | POST     | Markdown アップロード          |
| `/admin/knowledge/convert`       | POST     | 画像/PDF → Markdown 変換       |
| `/admin/knowledge/unified`       | GET      | 統合ファイル一覧取得           |
| `/admin/knowledge/originals/:key`| GET      | 元ファイル取得                 |
| `/admin/knowledge/reconvert`     | POST     | 元ファイルから Markdown 再生成 |

**認証**: パスキー認証でログインしたセッションが必要です。ダッシュボード（`/dashboard`）からログイン後、管理機能を利用できます。

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

## Cloudflare 型生成

```bash
pnpm cf-typegen
```

`CloudflareBindings` を Hono インスタンス化時にジェネリクスとして渡す：

```ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```
