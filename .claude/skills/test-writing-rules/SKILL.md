---
name: test-writing-rules
description: "テストを書く前に発動。仕様から観点とテストケースを導出するための 3 軸チェックリストと技法カタログ。実装の翻訳ではなく仕様の検証になるテストを設計する。"
---

# テスト作成ルール（nepp-chan）

テストを書く前に発動し、対象機能に対して仕様ベースで最適なケース集合を設計するための指針。
このリポジトリは Cloudflare Workers（API）+ Cloudflare Pages（Astro + React）の構成で、Mastra でエージェント / ツールを組んでいる。観点と例はその前提で書いてある。

## 大原則

- テストは **「退行検知」と「仕様の言語化」** のために書く
- **カバレッジ閾値は退行検知の最低ラインであり、達成目標ではない**。`vitest.config.ts` の閾値ギリギリを稼ぐためのテストを書かない
- テストの本質は **仕様の検証**。実装の振る舞いを写し取るのが目的ではない
- 実装を読んでアサーションに翻訳した「tautological test」は禁止。実装にバグがあっても通るため
- 順序は **仕様（型 / 関数名 / OpenAPI スキーマ / ドキュメント / 呼び出し側）から先に観点を導出 → 後から実装を読んで漏れを補強**

## ワークフロー

テストを書く前に毎回辿る:

1. **仕様の読解** — Hono ルートなら `createRoute` の入出力 Zod スキーマ、Mastra ツールなら `inputSchema` / `description`、Repository なら呼び出し元のユースケース、フックなら `Props` 型と画面側の使われ方を把握
2. **観点の列挙** — 下記の 3 軸を当ててケース候補を出す（詳細: `references/perspectives.md`）
3. **技法の選択** — 関連する技法を選んでケースに展開（詳細: `references/techniques.md`）
4. **実装で漏れ補強** — 列挙したケースが全分岐を踏めているか確認、足りなければ仕様視点で追加
5. **記述** — 1 ケース 1 テストに落とす。テスト名は日本語、技法は describe や `it` の文章で表現する（`// 技法: 〇〇` のラベルコメントは書かない）

## 観点を導出する 3 軸

書き始める前に各軸で漏れを潰す。詳細は `references/perspectives.md`。

### 軸 1: 入出力の分類

- **正常系**: 仕様通りの入力で仕様通りの出力
- **準正常系**: 仕様の許容範囲内だが境界・特殊・冗長な入力（空白、重複、順不同、Unicode、長文、`null` / `undefined` / `NaN`）
- **異常系**: 明確なエラーが返るべき入力。`HTTPException` の **status・コード・message** までアサート（`error-handler` で `{ error: { code, message } }` に整形される）
- **例外系**: throw が起きる経路。`expect(...).toThrow(SpecificError)` で型まで確認

### 軸 2: 機能横断の観点

- 冪等性 / 並行性 / 順序依存 / タイムアウト・リトライ / 部分失敗 / リソースリーク / 入力サニタイズ / i18n・エンコーディング

### 軸 3: nepp-chan で必ず当てる観点

- **Mastra エージェント / ツール**: tool call の空・重複・無限ループ、structured output のスキーマ違反、`requestContext.get("env")` の未設定
- **Cloudflare ランタイム**: D1 のトランザクション境界、R2 の eventual visibility、Vectorize の次元数整合、Cron Trigger の重複起動
- **認証 / 認可**: 未認証 / `requireRole("admin")` 不一致 / 別オーナー / `admin_sessions` 期限切れ / anonymous JWT 不正
- **フロントエンド**: msw で外したリクエスト、TanStack Query の retry 挙動、`TZ=Asia/Tokyo` 前提の日付描画

## ミューテーション思考

書いたケースが本当に効くか、頭の中で実装に小さな変更を入れて落ちるか確認:

- `>` を `>=` に変えても落ちないテストは弱い
- `&&` を `||` に変えても落ちないなら不足
- `return x` を `return undefined` にしても落ちないなら戻り値検証が甘い

## 構造

- AAA（Arrange / Act / Assert）の流れは大半の単体テストで自然に出る。明示コメント・空行は **任意**。冗長なら入れない
- GWT（Given / When / Then）は受け入れテストや複雑な業務シナリオに限って使う
- テスト名は「対象 / 条件 / 期待振る舞い」の 3 要素
  例: `POST /admin/broadcast: scheduled_at が過去日時のとき 400 を返す`
- `describe` のネストは 2 階層まで。深くなるならファイルを分ける
- 1 テスト 1 振る舞い。1 つの仕様（status・error.code・DB 副作用など）を成立させる複数 assert は許容するが、無関係な仕様を 1 テストに詰めない

## テストダブル

- モックは **I/O 境界** に限定（HTTP / D1 / R2 / Vectorize / 時刻 / 乱数 / LLM）
- ドメインロジック自体や自分のコードはモックしない
- 時刻依存は `vi.useFakeTimers()` または DI された clock。`new Date()` 直接呼び出しはラップ提案を一緒に出す
- モック戻り値は本番スキーマ（Zod / Drizzle の型）に準拠させる

## このリポジトリの道具

- **server**: vitest + libsql（in-memory）+ msw / coverage-istanbul。ヘルパは `server/src/test-helpers/` の `test-app.ts`（resolvePrincipal + errorHandler 込みの Hono アプリ）/ `test-db.ts`（in-memory SQLite + DDL）/ `tool-context.ts`（`buildToolContext` / `callTool` で Mastra tool を実行）
- **web**: vitest + jsdom + Testing Library + msw / coverage-v8。`TZ=Asia/Tokyo` 固定。ヘルパは `web/src/test/` の `msw-server.ts`（`server.use(...)` でテスト毎にハンドラ差し替え）/ `query.ts`（`renderHookWithQuery` / `renderWithQuery`）/ `setup.ts`（msw の lifecycle）
- 配置は co-located（`foo.ts` の隣に `foo.test.ts`）
- カバレッジ閾値・除外は各 `vitest.config.ts`。Sentry init や薄い shell（`pages/**`, `RootLayout.tsx`, `app/chat/App.tsx` 等）は意図的に除外しているため、そこを稼ぐためのテストを書かない

### ヘルパ最小例

```ts
// server: Mastra tool（tool-context.ts）
import { callTool } from "~/test-helpers/tool-context";
const result = await callTool(emergencyReportTool, { type: "fire" }, { env });

// server: Hono ルート（test-app.ts + test-db.ts）
const db = await createTestDb();
const app = await withResolvePrincipal(adminBroadcastRoutes);
const res = await app.request("/admin/broadcast", { method: "POST", body }, { DB: ..., ... });

// web: フック（query.ts + msw-server.ts）
server.use(http.get("*/threads", () => HttpResponse.json({ items: [] })));
const { result } = renderHookWithQuery(() => useThreads());
```

## ケース設計の出力フォーマット

テストを書く前に、必ず下記の形でケース集合を一度言語化する。これでテスト過多と漏れを同時に防ぐ。

```
対象仕様: <関数 / ルート / フックのシグネチャと責務>
採用技法: <同値分割 + 境界値 / 状態遷移 / デシジョンテーブル など>
書くケース:
  - <観点>: <入力 → 期待挙動>
  - ...
書かないケース（理由付き）:
  - <観点>: <なぜ書かないか。例: Zod が境界で弾く / Hono router が同じ branch を踏む / 純粋関数で例外系が無い>
```

## 禁止事項

- tautological test（実装をそのまま assert に翻訳しただけ）
- 実装の private 状態を直接覗いて assert
- 巨大スナップショットの濫用（差分が読めないもの）
- `expect(true).toBe(true)` 系の placeholder
- `skip` / `only` のコミット
- 真の LLM / 外部 API への到達（`onUnhandledRequest: "error"` で msw が落とすが、念のため）

## 参照

- 観点 3 軸の詳細とこのリポジトリでの具体例: `references/perspectives.md`
- 技法カタログ（同値分割 / 境界値 / デシジョンテーブル / 状態遷移 / ペアワイズ / エラー推測）と適用例: `references/techniques.md`
