<h1 align="center">🏔️ Nepp-chan.ai</h1>

<p align="center">
  <strong>AI Deputy Mayor for Otoineppu Village</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPLv3-blue.svg?style=for-the-badge" alt="AGPLv3 License"></a>
  <a href="https://github.com/kayac/nepp-chan/releases"><img src="https://img.shields.io/github/v/release/kayac/nepp-chan?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://web.nepp-chan.ai"><img src="https://img.shields.io/badge/Demo-Live-success?style=for-the-badge" alt="Live Demo"></a>
</p>

**Nepp-chan.ai** is a _community-native AI assistant_ for Otoineppu Village, Hokkaido. Trained on village-specific documents and local culture, Nepp-chan understands local contexts like community nicknames, shops, and winter snow removal—enabling natural, warm conversations that generic AI cannot provide.

This is an **Open R&D project** that fully discloses our development process, serving as a model case for municipalities nationwide to introduce AI-based resident support at low cost.

[Live Demo](https://web.nepp-chan.ai) · [Getting Started](#-getting-started) · [Roadmap](#%EF%B8%8F-roadmap--マイルストーン) · [日本語](#about--概要)

---

## About / 概要

**English**

Nepp-chan.ai is a community-native AI chat application serving Otoineppu Village, Hokkaido—one of Japan's smallest municipalities. Unlike generic AI assistants that lack local knowledge and warm conversational tones, Nepp-chan is trained directly on village-specific official documents and cultural contexts. This enables natural conversations about local nicknames, neighborhood shops, winter snow removal logistics, and community events—the kind of contextual understanding that residents need but generic AI cannot provide.

Beyond typical FAQ automation, Nepp-chan engages in natural dialogue and serves as a friendly, accessible "AI Deputy Mayor" rather than just a search tool. The project is designed to be accessible to all residents, including those unfamiliar with digital technology, through progressive multi-channel rollout (web, mobile, LINE messaging, voice calls, and in-person kiosks).

This is an **Open R&D initiative** that fully discloses our development process, serving as a replicable model for municipalities nationwide facing similar challenges in resident engagement and administrative support. By sharing our trials and learnings, we aim to enable other municipalities to introduce AI-based resident support at low cost.

**日本語**

北海道音威子府村のAI副村長「ねっぷちゃん」と会話できるチャットアプリケーションです。一般的なAIは地方の細かな情報に精通しておらず、温かみのある会話にも乏しいという課題があります。「ねっぷちゃん」は、村独自の公的資料から地域文化まで直接学習することで、地元の通称、お店、冬の除雪相談、コミュニティイベントなど、音威子府村ならではの文脈を深く理解した自然な対話を実現します。

汎用的なFAQ自動応答AIとは異なり、自然な対話を通じて気軽に相談できる「AI副村長」という親しみやすい存在として設計されています。また、デジタル操作に不慣れな方も取り残さないよう、Web・モバイル・LINE・電話・対面など、段階的にアクセス方法を拡大する予定です。

このプロジェクトは、全国の自治体が低コストで「AIによる住民支援」を導入できるモデルケースとして、開発プロセスを全面公開する**オープンR&D**の取り組みです。音威子府村での試行錯誤を公開することで、同様の課題を抱える自治体の横展開を支援します。

---

## ✨ Features

- 🏘️ **Community-Native Knowledge** — Trained on village-specific documents, local culture, and daily contexts
- 📱 **Multi-Channel Access** — Web, mobile, LINE messaging, voice calls, and in-person kiosks (progressive rollout)
- 🤝 **Friendly Persona** — Not just a tool, but a community member with personality and warmth
- 🌐 **Open R&D** — Full source code disclosure for nationwide municipal adoption

---

## 🗺️ Roadmap / マイルストーン

- [x] **Phase 1**: Web/Mobile chat pilot (Current)
- [ ] **Phase 2**: LINE messaging + voice call support
- [ ] **Phase 3**: In-person kiosks at village hall and public facilities
- [ ] **Phase 4**: Anonymized conversation analytics for policy improvement
- [ ] **Vision**: "A municipality where every voice is heard"

---

## 🚀 Getting Started

> セットアップの詳細は[ルートの README](../README.md#セットアップ) を参照してください。

```bash
pnpm install
```

### 環境変数の設定

dotenvx で暗号化された `.env` を使用。詳細はルートの [README.md](../README.md) を参照。

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
