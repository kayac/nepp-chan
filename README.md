# aiss-nepch

音威子府村の AI キャラクター「ねっぷちゃん」チャットシステム

## 概要

北海道音威子府村のマスコット AI「ねっぷちゃん」と会話できるチャットアプリケーションです。Mastra AI フレームワークを活用し、Cloudflare Workers + Pages 上で稼働します。

### 主要機能

- ねっぷちゃんとのチャット会話
- 村長モード（管理者向けデータ分析）
- 村の集合知（ペルソナ）の蓄積・参照
- 緊急情報の記録・管理
- 天気情報の取得
- Web 検索

## 技術スタック

- **フレームワーク**: Hono, Mastra (beta)
- **ランタイム**: Cloudflare Workers / Pages
- **AI**: Google Generative AI (Gemini 2.5)
- **フロントエンド**: React 19, Vite, TailwindCSS
- **データベース**: Cloudflare D1
- **言語**: TypeScript

## セットアップ

### 必要条件

- Node.js >= 22.13.0
- pnpm
- Cloudflare アカウント

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd aiss-nepch

# 依存関係をインストール
pnpm install
```

### 環境変数の設定

`server/.dev.vars` ファイルを作成し、以下の環境変数を設定：

```
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
GOOGLE_SEARCH_ENGINE_ID=your-engine-id
MASTER_PASSWORD=your-password
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
