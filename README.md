# nepp-chan

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

dotenvx で暗号化された `.env` をコミットしています。復号化には `.env.keys` が必要です。

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

#### セットアップ手順

チームから `.env.keys` を受け取り、ルートに配置。

#### dotenvx コマンド

```bash
# 新しい変数を追加（自動で暗号化）
dotenvx set NEW_VAR "value" -fk .env.keys -f server/.env

# 復号化して確認
dotenvx run -fk .env.keys -f server/.env -- printenv NEW_VAR
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

### 環境構成

| 環境 | ブランチ | Server | Web |
|------|----------|--------|-----|
| dev | develop | `nepp-chan-server-dev` | `nepp-chan-web-dev` |
| prd | main | `nepp-chan-server-prd` | `nepp-chan-web-prd` |

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
