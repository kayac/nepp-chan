---
name: test-writing-rules
description: "テストを書く前に発動。仕様から観点とテストケースを導出するための 3 軸チェックリストと技法カタログ。実装の翻訳ではなく仕様の検証になるテストを設計する。"
---

# テスト作成ルール

テストを書く前に発動し、対象機能に対して仕様ベースで最適なケース集合を設計するための指針。

## 大原則

- テストは **「退行検知」と「仕様の言語化」** のために書く
- **カバレッジ閾値は退行検知の最低ラインであり、達成目標ではない**。`vitest.config.ts` の閾値ギリギリを稼ぐためのテストを書かない
- テストの本質は **仕様の検証**。実装の振る舞いを写し取るのが目的ではない
- 実装を読んでアサーションに翻訳した「tautological test」は禁止。実装にバグがあっても通るため
- 順序は **仕様（型 / 関数名 / OpenAPI スキーマ / ドキュメント / 呼び出し側）から先に観点を導出 → 後から実装を読んで漏れを補強**
- 各テストは F.I.R.S.T.（Fast / Independent / Repeatable / Self-validating / Timely）を満たす。本 Skill の指針はこの原則の具体化

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

- **正常系 (Happy Path)**: 仕様通りの入力で仕様通りの出力
- **準正常系 (Edge Case)**: 仕様の許容範囲内だが境界・特殊・冗長な入力（空白、重複、順不同、Unicode、長文、`null` / `undefined` / `NaN`）
- **異常系 (Sad Path / Negative)**: 明確なエラーが返るべき入力。`HTTPException` の **status・コード・message** までアサート（`error-handler` で `{ error: { code, message } }` に整形される）
- **例外系 (Error Path)**: throw が起きる経路。`expect(...).toThrow(SpecificError)` で型まで確認

### 軸 2: 機能横断の観点

- 冪等性 / 並行性 / 順序依存 / タイムアウト・リトライ / 部分失敗 / リソースリーク / 入力サニタイズ / i18n・エンコーディング

### 軸 3: ドメイン / 基盤の観点

機能が触る基盤・ドメインに応じて当てる。実装の癖（特定 middleware の優先順位、特定 helper の init 忘れ等）はテスト観点ではなく実装詳細なので含めない。詳細は `references/perspectives.md`。

- **LLM / Agent**: tool call の異常、structured output のスキーマ違反、非決定性の固定、PII 混入
- **RDB / KV / オブジェクトストレージ / ベクトル検索**: トランザクション境界、UNIQUE 制約違反、eventual consistency、次元数整合
- **外部 API / Webhook**: 署名検証、4xx/5xx の retry 可否分岐、レート制限、部分失敗
- **状態遷移ドメイン**: 不正遷移、戻り遷移、遷移時の副作用
- **認証 / 認可**: 未認証 / ロール不足 / 別オーナー / 期限切れ / 不正署名
- **テストランナー / モック / クエリキャッシュ**: 未モックリクエスト検知、handler リセット境界、fake timers の時刻基準、独立 QueryClient
- **ブラウザ / UI**: ストリーミングの中間状態、画面離脱後の async、a11y

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

- テストダブルは **I/O 境界** に限定（HTTP / DB / オブジェクトストレージ / 時刻 / 乱数 / LLM）。ドメインロジック自体や自分のコードはモックしない
- 時刻依存は `vi.useFakeTimers()` または DI された clock。`new Date()` 直接呼び出しはラップ提案を一緒に出す
- 戻り値は本番スキーマ（Zod / Drizzle の型）に準拠させる
- 「モック」と一括りにせず種類を意識する（[Martin Fowler の分類](https://martinfowler.com/bliki/TestDouble.html) より）:
  - **Stub**: 決まった値を返すだけ。状態確認しない
  - **Spy**: 呼ばれた事実・引数・回数を記録する（`vi.fn()` の典型用途）
  - **Mock**: 期待される呼び出しを事前定義し、満たさないと失敗する（厳格な振る舞い検証）
  - **Fake**: 軽量だが動作する代替実装（`createTestDb()` の in-memory SQLite / `msw` のリクエストハンドラ / `vi.useFakeTimers()` の仮想時計が該当）
- Fake で代替できるなら Stub/Spy より Fake を優先する。本番に近い挙動で検証できるため

## テスト道具の使い方（指針）

「どこに何があるか」ではなく「どう使うか」の指針。詳細パスは CLAUDE.md / server/CLAUDE.md / web/CLAUDE.md を参照。

- **モック境界**: 外部 I/O（HTTP / DB / オブジェクトストレージ / 時刻 / 乱数 / LLM）に限ってモック。ドメインロジック自体はモックしない
- **Hono ルートを叩く時**: 本番と同じ middleware スタック（principal 解決 + errorHandler）込みのアプリで叩く。生 Hono を直接組み立てて middleware を省いたテストは仕様検証にならない
- **DB を伴うテスト**: in-memory SQLite ヘルパを使い、`beforeEach` で毎回作り直して状態を隔離。テスト間で row を引き継がない
- **Mastra tool の execute**: テスト用 context builder で `RuntimeContext` の中身を **必ず明示**（特に `env`）。default を信用しない
- **msw**: 各テスト先頭で `server.use(...)` を必ず書く。`setup.ts` が `onUnhandledRequest: "error"` のため未モック呼び出しは即落ちる。`afterEach` の `resetHandlers` でテスト間の漏れを防ぐ
- **QueryClient**: テスト毎に独立クライアントを作るヘルパで包む。retry: false / gcTime: 0 / staleTime: 0 が前提で、retry 挙動を確認したいケースは別途モック
- **時刻 / 日付**: web は `TZ=Asia/Tokyo` 固定で実行。時刻依存ロジックは `vi.useFakeTimers()` か DI された clock を使う。`new Date()` 直接呼び出しは避ける
- **co-located 配置**: テストは対象ファイルの隣に置く（`foo.ts` の隣に `foo.test.ts`）
- **書かない領域**: `vitest.config.ts` で除外されているファイル（Sentry init / Astro shell / 外部 SDK 連携の深い tsx 等）にカバレッジ目当てのテストを足さない

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

- 変更の経緯を固定するだけのテスト。書く前に「これは仕様か、それとも自分がいま入れた変更が効いているかの確認か」を判定し、後者なら書かない
  - 例: 「〜が〜に漏れない」「除外条件が効いている」「変更前の値のままである」
  - 仕様変更で既存テストが落ちたときは、新仕様の姿に書き直す。旧仕様との差分を検証するテストを足さない
- tautological test（実装をそのまま assert に翻訳しただけ）
- 実装の private 状態を直接覗いて assert
- 巨大スナップショットの濫用（差分が読めないもの）
- `expect(true).toBe(true)` 系の placeholder
- `skip` / `only` のコミット
- 真の LLM / 外部 API への到達（`onUnhandledRequest: "error"` で msw が落とすが、念のため）

## 参照

- 観点 3 軸の詳細: `references/perspectives.md`
- 技法カタログ（同値分割 / 境界値 / デシジョンテーブル / 状態遷移 / ペアワイズ / エラー推測）と適用例: `references/techniques.md`
- このリポジトリでのテスト最小コード例（Hono ルート / Mastra tool / DB / web フック・コンポーネント / fakeTimers）: `references/examples.md`
