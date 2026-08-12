# 🏔️ Nepp-chan.ai

**音威子府村 AI 副村長**

[![AGPLv3 License](https://img.shields.io/badge/License-AGPLv3-blue.svg?style=for-the-badge)](LICENSE)
[![Website](https://img.shields.io/badge/Website-nepp--chan.ai-blue?style=for-the-badge)](https://nepp-chan.ai)
[![Chat](https://img.shields.io/badge/Chat-web.nepp--chan.ai-blue?style=for-the-badge)](https://web.nepp-chan.ai)

北海道音威子府村のAI副村長「ねっぷちゃん」と会話できるチャットアプリケーションです。村独自の公的資料から地域文化まで直接学習することで、地元の通称、お店、冬の除雪相談、コミュニティイベントなど、音威子府村ならではの文脈を深く理解した自然な対話を実現します。

音威子府村で、AIが「道具」ではなく「村の一員」として受け入れられる。そんな世界を実験するプロジェクトです。コンセプトは「存在するソフトウェア」── 道具ではなく、村民に愛される存在を目指しています。

このプロジェクトは、全国の自治体が低コストで「AIによる住民支援」を導入できるモデルケースとして、開発プロセスを全面公開する**オープンR&D**の取り組みです。

[Website](https://nepp-chan.ai) · [チャット](https://web.nepp-chan.ai) · [セットアップ](#セットアップ) · [ロードマップ](#ロードマップ) · [English](README.en.md)

---

## 概要

一般的なAIは地方の細かな情報に精通しておらず、温かみのある会話にも乏しいという課題があります。「ねっぷちゃん」は、汎用的なFAQ自動応答AIとは異なり、自然な対話を通じて気軽に相談できる「AI副村長」という親しみやすい存在として設計されています。

デジタル操作に不慣れな方も取り残さないよう、Web・モバイル・LINE・電話・対面など、段階的にアクセス方法を拡大する予定です。音威子府村での試行錯誤を公開することで、同様の課題を抱える自治体の横展開を支援します。

---

## 特徴

- 🏘️ **地域密着型ナレッジ** — 村独自の公的資料、地域文化、日常の文脈を直接学習
- 📱 **マルチチャネル対応** — Web、モバイル、LINE、電話、対面端末（段階的に展開）
- 🤝 **親しみやすいキャラクター** — 単なるツールではなく、人柄と温かみを持った地域の一員
- 🌐 **オープンR&D** — 全国の自治体が導入できるよう、ソースコードを全面公開

---

## ロードマップ

- [x] **Phase 1**: Web/モバイルチャットのパイロット運用
- [x] **Phase 2**: LINEメッセージ対応
- [ ] **Phase 3**: 電話対応
- [ ] **Phase 4**: 村役場・公共施設への対面端末の設置
- [ ] **Phase 5**: 匿名化された会話分析による政策改善
- [ ] **ビジョン**: 「すべての声が届く村へ」

---

## 技術スタック

- **フレームワーク**: Hono, Mastra
- **ランタイム**: Cloudflare Workers / Pages
- **AI**: OpenAI (GPT-5.6)、Google Gemini (embedding・Web検索)
- **フロントエンド**: Astro, React, TailwindCSS
- **データベース**: Cloudflare D1
- **言語**: TypeScript

## プロジェクト構成

| ディレクトリ                | 説明                                        |
| --------------------------- | ------------------------------------------- |
| [server/](server/README.md) | バックエンド API（Cloudflare Workers）      |
| [web/](web/README.md)       | チャット Web アプリ（Cloudflare Pages）     |
| lp/                         | ランディングページ（Cloudflare Pages）      |
| [widget/](widget/CLAUDE.md) | 外部サイト埋め込みチャットウィジェット      |
| shared/                     | web / lp / server 共通の TypeScript パッケージ |
| knowledge/                  | RAG 用ナレッジファイル                      |
| [identity/](identity/)      | キャラ・ロゴ等のビジュアルアセット（[CC BY 4.0](identity/README.md)） |

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
# ルート（ナレッジアップロードスクリプト用）
cp .env.example .env

# server
cp server/.env.example server/.env
cp server/.dev.vars.example server/.dev.vars

# web
cp web/.env.example web/.env

# lp
cp lp/.env.example lp/.env

# widget
cp widget/.env.example widget/.env
```

各 `.env` ファイルに適切な値を設定してください。

### D1 データベースの初期化

```bash
# 開発環境（マイグレーション適用）
pnpm db:migrate:local
```

## 開発

```bash
pnpm server:dev   # API
pnpm web:dev      # Web
pnpm lp:dev       # LP
pnpm mastra:dev   # Mastra Playground
```

開発・dev 環境の URL、各種コマンドの詳細は [CLAUDE.md](CLAUDE.md) を参照してください。

## 本番環境

| | URL |
| --- | --- |
| LP | https://nepp-chan.ai |
| Web | https://web.nepp-chan.ai |
| API | https://api.nepp-chan.ai |

`develop` への merge で CI が走り、[tagpr](https://github.com/Songmu/tagpr) がバージョンバンプ PR を自動作成。バンプ PR をマージするとタグ + GitHub Release + 本番デプロイが連動します。
