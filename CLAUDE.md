# CLAUDE.md - aiss-nepch

## プロジェクト概要

音威子府村の AI キャラクター「ねっぷちゃん」チャットシステム。Mastra AI フレームワークを活用し、Cloudflare Workers（API）+ Cloudflare Pages（Web）で稼働するモノレポ構成。

### 主要機能

- **ねっぷちゃんチャット**: 音威子府村 17 歳の AI キャラクターとの会話
- **村長モード**: `/master` コマンドでパスワード認証後、データ分析機能を利用可能
- **RAG ナレッジ検索**: Markdown ファイルをベクトル化し、村の情報を検索・参照
- **村の集合知（ペルソナ）**: 会話から抽出した情報を蓄積・参照
- **緊急情報管理**: 緊急報告の記録・更新・取得
- **天気情報**: Open-Meteo API 経由で天気取得（ワークフロー）
- **Web 検索**: Google Custom Search API 経由

## 技術スタック

### フレームワーク・ランタイム

- **Hono** 4.10 - Web フレームワーク（OpenAPIHono で OpenAPI 統合）
- **Cloudflare Workers** - API サーバーレスランタイム
- **Cloudflare Pages** - フロントエンドホスティング
- **Mastra** 1.0.0-beta - AI エージェントフレームワーク

### AI/LLM

- **Google Generative AI** (@ai-sdk/google)
  - Gemini 2.5 Flash（メインエージェント）
  - Gemini 2.5 Pro（天気エージェント）

### フロントエンド

- **React** 19
- **Vite** 7
- **TailwindCSS** 4
- **TanStack Query** 5 - データフェッチング・キャッシング
- **AI SDK React** (@ai-sdk/react)

### データベース・ストレージ

- **Cloudflare D1** - SQLite ベースのエッジデータベース
- **Drizzle ORM** - 型安全な SQL クエリビルダー
- **D1Store** (@mastra/cloudflare-d1) - Mastra ストレージアダプタ
- **Cloudflare R2** - ナレッジファイル（Markdown）のオブジェクトストレージ
- **Cloudflare Vectorize** - ベクトルデータベース（RAG 用 embeddings 格納）

### 開発ツール

- **TypeScript** 5.9
- **Zod** 4 - スキーマバリデーション
- **Vitest** - テストフレームワーク
- **Biome** - フォーマッター/リンター
- **pnpm** - パッケージマネージャー（Node.js >= 22.13.0）

## プロジェクト構成

```text
aiss-nepch/
├── server/              # バックエンド API（Cloudflare Workers）
│   └── CLAUDE.md        # server 固有の詳細
├── web/                 # フロントエンド（Cloudflare Pages）
│   └── CLAUDE.md        # web 固有の詳細
├── knowledge/           # ナレッジ Markdown ファイル
├── scripts/             # ユーティリティスクリプト
├── package.json         # ルート（モノレポ）
├── pnpm-workspace.yaml
├── biome.json
└── tsconfig.json
```

## 開発コマンド

```bash
# ルートレベル
pnpm server:dev              # server 開発サーバー
pnpm server:deploy           # server 本番デプロイ
pnpm web:dev                 # web 開発サーバー
pnpm web:build               # web 本番ビルド
pnpm web:deploy              # web 本番デプロイ
pnpm mastra:dev              # Mastra Playground
pnpm lint                    # Biome + TypeScript 型チェック
pnpm lint:fix                # Biome 自動修正
pnpm format                  # Biome フォーマット

# Drizzle ORM / D1 マイグレーション
pnpm db:generate             # スキーマから SQL 生成
pnpm db:migrate              # リモート D1 に適用
pnpm db:migrate:local        # ローカル D1 に適用
pnpm db:studio               # Drizzle Studio 起動

# ナレッジ管理
pnpm knowledge:upload              # 全ファイルを R2 にアップロード
pnpm knowledge:upload --file=x.md  # 特定ファイルのみ
pnpm knowledge:upload --clean      # 全ナレッジを削除
```

## パス別名

```typescript
// ~ は src/ を指す
import { something } from "~/middleware";
```

## 環境変数（シークレット）

API キーなどの機密情報は Cloudflare Workers/Pages のシークレットとして管理。

### Cloudflare Workers（server）

| 変数名                         | 説明                             |
| ------------------------------ | -------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI キー        |
| `GOOGLE_SEARCH_ENGINE_ID`      | Google Custom Search エンジン ID |
| `MASTER_PASSWORD`              | 村長モードのパスワード           |
| `ADMIN_KEY`                    | 管理 API 認証キー                |

### Cloudflare Pages（web）

| 変数名                | 説明                   |
| --------------------- | ---------------------- |
| `BASIC_AUTH_USER`     | Basic 認証ユーザー名   |
| `BASIC_AUTH_PASSWORD` | Basic 認証パスワード   |

### シークレットの登録方法

```bash
# 開発環境（ローカル）
echo "GOOGLE_GENERATIVE_AI_API_KEY=your-api-key" >> ./server/.dev.vars

# 本番環境（Cloudflare Workers）
cd server && wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY

# 本番環境（Cloudflare Pages）
cd web && wrangler pages secret put BASIC_AUTH_USER
```

## ブランチ戦略

- **メインブランチ**: `develop`
- **機能ブランチ**: `feature/*`
