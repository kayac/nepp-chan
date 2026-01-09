# aiss-nepch

## 概要

北海道音威子府村のマスコット AI「ねっぷちゃん」と会話できるチャットアプリケーションです。

ねっぷちゃんは村のことをなんでも知っていて、村民や観光客の役に立つ情報を教えてくれます。観光スポット、イベント、暮らしの情報などを案内します。

### 主要機能

- ねっぷちゃんとのチャット会話
- 管理者向けデータ分析

## 技術スタック

- **フレームワーク**: Hono, Mastra (beta)
- **ランタイム**: Cloudflare Workers / Pages
- **AI**: Google Generative AI (Gemini 2.5)
- **フロントエンド**: React 19, Vite, TailwindCSS
- **データベース**: Cloudflare D1
- **言語**: TypeScript

## プロジェクト構成

| ディレクトリ                | 説明                                        |
| --------------------------- | ------------------------------------------- |
| [server/](server/README.md) | バックエンド API（Cloudflare Workers）      |
| [web/](web/README.md)       | フロントエンド WEB （Cloudflare Pages）     |
| knowledge/                  | RAG 用ナレッジファイル                      |

## セットアップ

### 必要条件

- Node.js >= 22.13.0
- pnpm
- Cloudflare アカウント

### インストール

```bash
pnpm install
```

### 環境変数の設定

#### ルートディレクトリ

`.env` を作成：

```env
# R2 アップロード用
CLOUDFLARE_ACCOUNT_ID=your-account-id
R2_BUCKET_NAME=your-bucket-name

# API 呼び出し用
API_URL=http://localhost:8787
ADMIN_KEY=your-admin-key
```

#### server ディレクトリ

`server/.dev.vars` を作成（Workers 開発用）：

```env
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
GOOGLE_SEARCH_ENGINE_ID=your-engine-id
MASTER_PASSWORD=your-password
ADMIN_KEY=your-admin-key
```

`server/.env` を作成（Mastra Playground 用）：

```env
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
GOOGLE_SEARCH_ENGINE_ID=your-engine-id
MASTER_PASSWORD=your-password
ADMIN_KEY=your-admin-key
```

#### web ディレクトリ

`web/.env` を作成：

```env
VITE_API_URL=http://localhost:8787
```

### D1 データベースの初期化

```bash
# 開発環境（マイグレーション適用）
cd server
pnpm db:migrate:local
```

## 開発

```bash
# API サーバー起動
pnpm server:dev

# Web 開発サーバー起動
pnpm web:dev

# Mastra Playground 起動
pnpm mastra:dev
```

## デプロイ

```bash
# API サーバーをデプロイ
pnpm server:deploy

# Web をデプロイ
pnpm web:deploy
```
