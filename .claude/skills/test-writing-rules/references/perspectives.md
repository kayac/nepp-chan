# 観点チェックリスト（3 軸詳細）

テスト設計時、以下の 3 軸を順に当てて漏れを潰す。

**このチェックリストは「全部をテスト化するためのリスト」ではなく「該当性を判定するためのチェックリスト」**。各項目は「該当するか」を 1 度判定し、該当しないものは書かないで良い。形式的にケースを増やすほうが害が大きい。

## 軸 1: 入出力の分類

入出力に対して必ず 4 種類のケースを検討する。1 つでも書けないなら仕様の理解が足りていないか、関数の責務が不明瞭。

### 正常系 (Happy Path)

- 仕様の主目的にあたる入力 → 期待通りの出力
- 「典型例」を 1 つ。ここで全部詰めない（境界値や特殊入力は別ケース）

### 準正常系 (Edge Case) — 仕様の許容範囲内だが特殊

仕様には反していないが「うっかり」で壊れやすい入力:

- 先頭末尾の空白
- 重複要素
- 順不同入力（順序非依存のはずなら）
- 大文字小文字の揺れ
- Unicode（絵文字、結合文字、サロゲートペア境界、合字）
- 空・最小・最大に近い値
- 巨大な配列・長文
- `null` / `undefined` / `NaN` / `0` / `""`

### 異常系 (Sad Path / Negative) — 仕様で「エラーが返る」べき入力

- 明確に拒否される入力 → 期待されるエラーが返る
- **エラーの status・コード・message までアサート**。`toThrow()` だけは弱い
- このリポジトリでは `HTTPException` を `errorHandler` が `{ error: { code, message } }` に整形する。レスポンス body の `error.code` と `error.message` までチェックする
- 「どんな間違いをユーザがしうるか」想像する: 必須引数欠落 / 型ミス / 値域外 / 不正フォーマット / 無効状態からの操作（`closed` の poll を再 send 等）

### 例外系 (Error Path) — throw / reject が起きる経路

- `expect(...).toThrow(SpecificError)` で型まで指定
- `expect(...).rejects.toThrow(/メッセージ/)` で意味のあるメッセージか確認
- 「ライブラリが投げる素の Error」を握っているだけのケースは弱い。`HTTPException` でラップしているか

## 軸 2: 機能横断の観点

機能の性質によって以下を当てる。該当すれば必ずケース化:

### 冪等性

- 同じ操作を 2 回呼んだら同じ結果か / 副作用が重複しないか
- **書き込み・削除・送信** 系では必須
- 例: `POST /admin/broadcast/:id/send` を 2 回叩いて LINE メッセージが 2 回飛ばないか（`status` が `sent` になっていれば弾くか）
- 例: `poll_submissions` の `(poll_id, user_id)` UNIQUE が効いて重複回答が拒否されるか

### 並行性

- 同時呼び出しでの race condition
- D1 の単発クエリでは BEGIN/COMMIT を跨げないので、複数 INSERT を「成功か全失敗か」で扱いたい時は `db.batch([...])` を使えているか
- 例: 同じ `idempotencyKey` で並行 POST が来た時に lost update が起きないか

### 順序依存

- 配列順序、Map イテレーション順、`Promise.all` の解決順、`db.select(...).all()` の戻り順に依存していないか（ORDER BY を付けているか）
- 「順序が保証されていないものを順序前提でテストする」アンチパターンも避ける（テスト側で sort してから比較）

### タイムアウト・リトライ

- 外部 API（Gemini / Google Custom Search / LINE Messaging API）失敗時の挙動: 指数バックオフ・最大リトライ回数・デッドラインの伝播
- リトライ可能 / 不可能エラーの判定が正しいか（4xx をリトライしていないか）

### 部分失敗

- LINE 一斉配信のようなバッチで N 件中 M 件失敗した時の挙動: 全ロールバック / 部分成功 / `error_message` に記録
- どの方針か仕様で決まっているか、テストで明示する

### リソースリーク

- ストリーム未クローズ（`/threads/:id/chat` の SSE は generator なので注意）
- `AbortController` 未 abort
- `setInterval` / `setTimeout` 未 clear
- D1 / R2 のレスポンス未読

### 入力サニタイズ（セキュリティ）

- prompt injection（user message が agent instructions を上書きしようとする入力）
- SQL injection（drizzle の `prepare().bind()` 経由ならパラメータバインドされるが、生 SQL を組み立てていないか）
- path traversal（R2 のオブジェクトキー、`broadcast/media/:key`）
- SSRF（`web-researcher` 経由で内部 IP / metadata エンドポイントへ到達できないか）
- ReDoS（正規表現でハングする入力）

### i18n / エンコーディング

- 絵文字 / 結合文字 / サロゲートペア境界（broadcast 本文・persona content・チャット本文に絵文字が混ざる）
- タイムゾーン: web は `TZ=Asia/Tokyo` 固定、API は UTC 保存・JST 表示が基本。日付境界（`+00:00` vs `+09:00`）と DST 境界
- 文字長の数え方（`.length` vs grapheme cluster）

## 軸 3: ドメイン / 基盤の観点

対象機能が使う基盤・ドメインに応じて当てる。実装の癖（特定 middleware の優先順位、特定 helper の init 忘れ等）はここに書かない（テスト観点ではなく実装詳細）。

- **LLM / Agent (Mastra 等)**: tool call の異常（空・重複・無限ループ）、structured output のスキーマ違反パス、非決定性をテストで実モデルに依存させない（fixture / msw で固定）、PII / secret の混入チェック
- **RDB / KV (D1・SQLite 等)**: トランザクション境界、UNIQUE 制約違反のエラー型、`ORDER BY` 無しでの戻り順、eventual consistency、batch の atomic 性
- **オブジェクトストレージ (R2 等)**: eventual visibility、オブジェクトキー衝突、署名付き URL の期限
- **ベクトル検索 (Vectorize 等)**: 検索結果の eventual consistency、次元数不整合、`upsert` の重複キー
- **外部 API / Webhook**: 署名検証の不正系、4xx と 5xx の retry 可否分岐、レート制限、部分失敗（バッチ N 件中 M 件失敗時の方針）
- **状態遷移を持つドメイン**: 不正遷移、戻り遷移、遷移時の副作用（timestamp 更新・通知発火）
- **認証 / 認可**: 未認証 / ロール不足 / 別オーナー / 期限切れトークン / 不正署名 / token 使い回し
- **テストランナー / モック (Vitest・MSW)**: 未モックリクエストの検知設定、handler リセットの境界、fake timers の時刻基準
- **クエリキャッシュ (TanStack Query 等)**: テスト毎の独立クライアント、retry の振る舞い、stale な値の読み出し
- **ブラウザ / UI (Testing Library)**: ストリーミングの中間状態、画面離脱後の async（setState 警告）、focus 順序、a11y ラベル

## 各軸の使い方

1. 軸 1 の 4 分類を必ず **検討** する。該当しないものは書かない（純粋関数で例外系が無い、Zod / OpenAPI 層で異常系が吸収される薄い mapper など）
2. 軸 2 の 8 観点を「該当するか」順に判定し、該当するものだけケース化
3. 軸 3 のうち、機能が触る範囲で必要なものを当てる
4. 全体を見て「実装が落ちうる場所」を再確認（ミューテーション思考）
