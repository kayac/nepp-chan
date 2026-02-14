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

[Live Demo](https://web.nepp-chan.ai) · [Getting Started](#セットアップ) · [Roadmap](#roadmap--マイルストーン) · [日本語](#about--概要)

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

## Features

- 🏘️ **Community-Native Knowledge** — Trained on village-specific documents, local culture, and daily contexts
- 📱 **Multi-Channel Access** — Web, mobile, LINE messaging, voice calls, and in-person kiosks (progressive rollout)
- 🤝 **Friendly Persona** — Not just a tool, but a community member with personality and warmth
- 🌐 **Open R&D** — Full source code disclosure for nationwide municipal adoption

---

## Roadmap / マイルストーン

- [x] **Phase 1**: Web/Mobile chat pilot (Current)
- [ ] **Phase 2**: LINE messaging + voice call support
- [ ] **Phase 3**: In-person kiosks at village hall and public facilities
- [ ] **Phase 4**: Anonymized conversation analytics for policy improvement
- [ ] **Vision**: "A municipality where every voice is heard"


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
