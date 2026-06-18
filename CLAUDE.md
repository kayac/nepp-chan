# CLAUDE.md - nepp-chan

音威子府村 AI キャラクター「ねっぷちゃん」チャットシステム。
Cloudflare Workers（API）+ Pages（Web）のモノレポ構成。

## クイックリファレンス

```bash
# 開発
pnpm server:dev          # API 開発サーバー（8787）
pnpm web:dev             # Web 開発サーバー（5173）
pnpm lp:dev              # LP 開発サーバー（5174）

# 品質チェック
pnpm lint                # Biome + astro check + tsc
pnpm format              # Biome フォーマット

# DB マイグレーション
pnpm db:generate         # スキーマ → SQL 生成
pnpm db:migrate:local    # ローカル D1 適用
pnpm db:migrate:dev      # dev 環境 D1 適用
pnpm db:migrate:prd      # prd 環境 D1 適用

# ナレッジ
pnpm knowledge:upload:local  # ローカル R2 → Vectorize 同期
pnpm knowledge:upload:dev    # dev 環境
pnpm knowledge:upload:prd    # prd 環境
```

## プロジェクト構造

```text
server/              → API（詳細: server/CLAUDE.md）
web/                 → アプリ（チャット・ダッシュボード等）（詳細: web/CLAUDE.md）
lp/                  → LP（apex 配信の静的サイト）
knowledge/           → RAG 用 Markdown ファイル
```

### ナレッジ Vectorize ベクター数の基準値

knowledge/ 配下 329 ファイルを clean アップロードした場合の正しいベクター数。
大幅に乖離している場合はアップロード失敗やバグの可能性がある。

| 日付 | ファイル数 | ベクター数 | 備考 |
|------|:---------:|:---------:|------|
| 2026-03-09 | 329 | 2,891 | clean 後の正確な値 |

## コーディング規約

### コメント

原則書かない。残すのは「コードを読んだだけでは誤解する非自明な事実」だけ。迷ったら消す。

**不要なコメントの例:**

- 変更経緯: `// XXX を追加` `// YYY から変更` `// 旧実装を置き換え`
- タスク参照: `// Issue #123 対応` `// XXX の修正`（コミットメッセージの領域）
- WHAT の説明: `// この関数は〜を行う` `// Helper for...` `// 〜を返す`
- 過剰な JSDoc: フィールド・引数の説明、`@returns` の自明な記述
- セクション区切り: `// --- xxx用 ---`
- 他所と重複するドメイン補足: enum 値列挙、hex→色トークン名の注記

**残す例:** dow の曜日基点、件数が近似である注意、`[]` と `NULL` の状態区別、外部 API の制約回避理由

### 命名

- コンポーネント名は内容を表す具体的な名詞（`Knowledge` `Guide`）。番号付き（Feature1）や冗長 suffix（KnowledgeFeature）は禁止
- Props 型名は `Props` で統一（`XxxProps` 禁止）
- 戻り値型は型推論に任せる。`: Promise<string>` / `: void` 等の自明な注釈は書かない

### 機密情報

`.gitignore` 等のコミット対象に実データ/PII の存在を示唆するテキストを書かない。ignore コメントは `# ローカル作業ディレクトリ` のような中立な表現に留める。

## 環境変数

`.env.example` をコピーして `.env` を作成。

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

### ルート環境変数

| 変数名                 | 用途                           |
| ---------------------- | ------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID`| Cloudflare アカウント ID       |
| `R2_BUCKET_NAME`       | R2 バケット名                  |
| `VECTORIZE_INDEX_NAME` | Vectorize インデックス名       |

### server 環境変数

| 変数名                         | 用途                                  |
| ------------------------------ | ------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API                            |
| `GOOGLE_SEARCH_ENGINE_ID`      | Custom Search                         |
| `WEB_URL`                      | Web URL                               |
| `LINE_CHANNEL_SECRET`          | LINE 署名検証                         |
| `LINE_CHANNEL_ACCESS_TOKEN`    | LINE API 認証                         |
| `JWT_SECRET`                   | anonymous セッション JWT 署名         |
| `RESOURCE_ID_HASH_SECRET`      | LINE userId のハッシュ化（HMAC-SHA256）|

### web 環境変数

| 変数名         | 用途    |
| -------------- | ------- |
| `PUBLIC_API_URL` | API URL |

### 本番環境

本番環境の機密情報は Cloudflare の環境変数で管理。

```bash
# Workers シークレット
wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY

# Pages 環境変数は Cloudflare Dashboard で設定
```

## 品質ゲート

コード変更を伴うタスクの完了時は `/quality-check` を実行する。

### 自動 Hooks

| Hook | タイミング | 内容 |
|------|-----------|------|
| `post-edit-lint.sh` | PostToolUse（Edit / Write） | 変更ファイルに `biome check --write` を即時実行 |
| `stop-check.sh` | Stop（毎ターン） | テストファイル不足検出 + Plan 進捗チェック |

### 便利スキル

| スキル | 用途 |
|--------|------|
| `/plan` | 影響範囲が大きい変更の計画作成（`.brain/plans/` に保存） |
| `/tdd` | テスト駆動開発のサイクル |
| `/test-writing-rules` | テスト設計の観点チェックリスト |

## ブランチ

- メイン: `develop`

## CI/CD

### GitHub Actions ワークフロー

| ワークフロー | トリガー | 内容 |
| ------------ | -------- | ---- |
| `ci.yml` | PR / develop push | Biome lint + tsc + テスト |
| `deploy-dev.yml` | develop push | DB マイグレーション → サーバーデプロイ → Web デプロイ |
| `tagpr.yml` | develop push | バージョンバンプ PR 自動作成 |
| `deploy-prd.yml` | `v*` タグ push / tagpr からトリガー | 本番 DB マイグレーション → サーバーデプロイ → Web デプロイ |
| `eval.yml` | 毎週月曜 9:00 JST / 手動 | ナレッジエージェント評価 |

### リリースフロー

```
feature/* → PR → develop（CI + dev 自動デプロイ）
  ↓
tagpr がバージョンバンプ PR を自動作成
  ↓
バージョンバンプ PR マージ → タグ + GitHub Release → 本番デプロイ
```

- デフォルトは patch バンプ。`tagpr:minor` / `tagpr:major` ラベルで制御
- 本番デプロイは tagpr が `gh workflow run deploy-prd.yml` でトリガー
