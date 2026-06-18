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

**AI が書きがちで不要なもの（レビューで除去）:**

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

### スタイル

TailwindCSS utility class のみ。BEM 不採用。CSS 変数は `bg-(--paper-50)` 形式。

### ルート設計

ハンドラーには「関数呼び出し + エラーハンドリング」を書く。Repository 呼び出しはルートに直接書いて処理の流れが見えるようにする。データ変換ロジックの Service 切り出しは OK だが、複数 Repository 呼び出しをまとめるだけのラッパーは作らない。

### shared パッケージ

web/lp で UI が必要になったら `@nepp-chan/shared` を最初に確認。新規 UI も両側で使える性質なら shared に置く。

### web ディレクトリ規約

- `app/dashboard/components/<feature>/` 内の helper は `helpers.ts` に集約
- feature 間の越境 import 禁止。共有は `src/lib/` か `components/ui/` に昇格
- 新しい配置前に同種の既存ファイルを grep で確認

### 機密情報

`.gitignore` 等のコミット対象に実データ/PII の存在を示唆するテキストを書かない。ignore コメントは `# ローカル作業ディレクトリ` のような中立な表現に留める。

## Mastra・インフラ規約

### パス別名

```typescript
import { something } from "~/middleware"; // ~ = src/
```

### Mastra 配置ルール

- `mastra/agents/` - Agent のみ
- `mastra/tools/` - Tool のみ
- `mastra/workflows/` - Workflow のみ
- `services/` - ビジネスロジック（Mastra プリミティブ以外）

### createTool シグネチャ

```typescript
execute: async (inputData, context) => {
  const env = context?.requestContext?.get("env") as CloudflareBindings;
  // inputData は inputSchema のフィールドを直接持つ
};
```

### D1Store 初期化

```typescript
const storage = new D1Store({ id: "mastra-storage", binding: db });
await storage.init(); // 必須
```

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

## デプロイ環境

| 環境 | LP | Web | API |
| ---- | --- | --- | --- |
| ローカル | http://localhost:5174 | http://localhost:5173 | http://localhost:8787 |
| dev | https://dev.nepp-chan.ai | https://dev-web.nepp-chan.ai | https://dev-api.nepp-chan.ai |
| prd | https://nepp-chan.ai | https://web.nepp-chan.ai | https://api.nepp-chan.ai |

## テスト

汎用的な書き方の観点・規則は `test-writing-rules` スキルを参照。
ここではこのプロジェクト固有の決定だけを書く。

### 道具

- 配置: co-located（`foo.ts` の隣に `foo.test.ts`）
- server: vitest + libsql（in-memory）+ msw / coverage-istanbul
- web: vitest + jsdom + Testing Library + msw / coverage-v8
- web は `TZ=Asia/Tokyo` 固定で実行（`package.json` の test スクリプトで指定）

### 共通ヘルパ

- server: `server/src/__tests__/helpers/`（`test-app` / `test-db` / `tool-context`）
- web: `web/src/test/`（`msw-server` / `renderHookWithQuery` / `renderWithQuery` / `setup`）

### カバレッジ集計の除外

カバレッジは `include` 対象の未テストファイルも母数に含むため、「カバレッジを上げるためだけの薄いテストは書かない」方針に従い、本質的ロジックを持たないファイルは exclude する。

判断軸（具体的なファイルは各 `vitest.config.ts` の `coverage.exclude` に理由コメント付きで列挙）:

- StrictMode / フォールバック UI ラッパー（Sentry / Error Boundary 初期化など）
- Astro から `client:only` でマウントされる薄い page shell
- 外部 SDK 連携が深く E2E 領域に該当するもの（recharts 描画や副作用中心の表示など）
- HOC で囲んだ登録 / barrel / registry
- 責務分離が完了して orchestration だけになった Panel / Provider / context wrapper
- 自動生成資源（Mastra の `mastra/public/**` 等）

orchestration shell を exclude するときは「本質的ロジックが hooks / helpers / 子コンポーネントに抽出済みで、別途テストされている」ことを確認してから行う。

### カバレッジ閾値

- 実測値ベースで段階引き上げ（各 `vitest.config.ts` の `coverage.thresholds`）
- ぎりぎりではなく実測 - 1〜2pt のマージンを付ける（CI のノイズ防止）

### カバレッジのためにプロダクトコードを変更しない

カバレッジ目的で error/guard 分岐を削除しない。runtime 上到達不能でも型ナローイング（discriminated union の絞り込み等）を担う分岐がある。カバレッジが上がらない箇所は exclude か閾値据え置きで対応する。

テストしづらい巨大コンポーネントに smoke render を足してカバレッジを稼ぐのも禁止。テストしづらさは設計のフィードバックとして扱い、純関数・hook・子コンポーネントに分割してからテストする。

## 開発フロー

### 標準ワークフロー

```
1. /branch-start でブランチ作成
2. /plan で実装計画を作成（影響範囲が大きい変更の場合）
3. TDD で実装（test-writing-rules スキル参照）
4. PostToolUse が Edit/Write 直後に biome check、stop-check が毎ターン テスト不足検出 + Plan 進捗チェック
5. /quality-check で品質チェック〜コミットまで一括実行
6. /create-pr で PR 作成
```

### 計画ファースト

影響範囲が大きい変更（新機能、DB スキーマ変更、複数モジュールにまたがる修正）は `/plan` で計画を先に作る。
計画ファイルは `.brain/plans/` に置く（`.gitignore` 済み）。
stop-check が未完了の要件チェックリスト項目を検出して毎ターン通知する。

軽微な修正やリファクタリングでは Plan 不要。

### Hooks による品質ゲート

| Hook | タイミング | 内容 |
|------|-----------|------|
| `post-edit-lint.sh` | PostToolUse（Edit / Write） | 変更ファイルに `biome check --write` を即時実行 |
| `stop-check.sh` | Stop（毎ターン） | テストファイル不足検出 + Plan 進捗チェック |


## ブランチ

- メイン: `develop`
- 作業: `{type}/{slug}`（type は feat / fix / refactor / docs / chore / test / perf）

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
