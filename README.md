# nepp-chan

## 概要

北海道音威子府村のマスコット AI「ねっぷちゃん」と会話できるチャットアプリケーションです。

ねっぷちゃんは村のことをなんでも知っていて、村民や観光客の役に立つ情報を教えてくれます。観光スポット、イベント、暮らしの情報などを案内します。

### 主要機能

- ねっぷちゃんとのチャット会話
- 管理者向けデータ分析

## 技術スタック

- **フレームワーク**: Hono, Mastra
- **ランタイム**: Cloudflare Workers / Pages
- **AI**: Google Generative AI (Gemini)
- **フロントエンド**: React, Vite, TailwindCSS
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

`.env.example` をコピーして `.env` を作成します。

```bash
# ルート
cp .env.example .env
cp .env.production.example .env.production  # 本番ナレッジアップロード用（任意）

# server
cp server/.env.example server/.env
cp server/.dev.vars.example server/.dev.vars

# web
cp web/.env.example web/.env
```

各 `.env` ファイルに適切な値を設定してください。

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

### 環境構成

| 環境 | ブランチ | Web URL | API URL |
|------|----------|---------|---------|
| ローカル | - | http://localhost:5173 | http://localhost:8787 |
| dev | develop | https://dev-web.nepp-chan.ai | https://dev-api.nepp-chan.ai |
| prd | main | https://web.nepp-chan.ai | https://api.nepp-chan.ai |

### 手動デプロイ

```bash
# dev 環境
pnpm server:deploy
pnpm web:deploy

# prd 環境
pnpm server:deploy:production
pnpm web:deploy:production
```

### CI/CD

GitHub Actions で自動デプロイ:
- `develop` ブランチ push → dev 環境
- `main` ブランチ push → prd 環境
