# 観点チェックリスト（3 軸詳細）

テスト設計時、以下の 3 軸を順に当てて漏れを潰す。例はこのリポジトリ（nepp-chan）の実テーブル・ルート・ツールに揃えている。

**このチェックリストは「全部をテスト化するためのリスト」ではなく「該当性を判定するためのチェックリスト」**。各項目は「該当するか」を 1 度判定し、該当しないものは書かないで良い。形式的にケースを増やすほうが害が大きい。

## 軸 1: 入出力の分類

入出力に対して必ず 4 種類のケースを検討する。1 つでも書けないなら仕様の理解が足りていないか、関数の責務が不明瞭。

### 正常系

- 仕様の主目的にあたる入力 → 期待通りの出力
- 「典型例」を 1 つ。ここで全部詰めない（境界値や特殊入力は別ケース）

### 準正常系（仕様の許容範囲内だが特殊）

仕様には反していないが「うっかり」で壊れやすい入力:

- 先頭末尾の空白
- 重複要素
- 順不同入力（順序非依存のはずなら）
- 大文字小文字の揺れ
- Unicode（絵文字、結合文字、サロゲートペア境界、合字）
- 空・最小・最大に近い値
- 巨大な配列・長文
- `null` / `undefined` / `NaN` / `0` / `""`

### 異常系（仕様で「エラーが返る」べき入力）

- 明確に拒否される入力 → 期待されるエラーが返る
- **エラーの status・コード・message までアサート**。`toThrow()` だけは弱い
- このリポジトリでは `HTTPException` を `errorHandler` が `{ error: { code, message } }` に整形する。レスポンス body の `error.code` と `error.message` までチェックする
- 「どんな間違いをユーザがしうるか」想像する: 必須引数欠落 / 型ミス / 値域外 / 不正フォーマット / 無効状態からの操作（`closed` の poll を再 send 等）

### 例外系（throw / reject が起きる経路）

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

## 軸 3: nepp-chan のドメイン観点

このリポジトリで頻出するドメイン。該当機能を書く時は必ずこのリストを当てる。

### Mastra エージェント / ツール

- **tool call の異常**: 空配列 / 重複呼び出し / 無限ループ（同じ tool を呼び続ける）に対するガード
- **structured output のスキーマ違反**: `inputSchema` / `outputSchema` の Zod `safeParse` 失敗パス、各 field 欠落
- **`requestContext` の未設定**: `context?.requestContext?.get("env")` が `undefined` になり得る経路を踏んでいないか（`buildToolContext` でセットしていないキーを参照していないか）
- **管理者専用 tool の呼び出し制限**: `description` に `【管理者専用】` が付いた tool を一般ユーザーの agent から呼べないこと
- **D1Store**: `await storage.init()` を忘れていないか（テストでも初期化が必要）
- **PII / secret の漏れ**: ログ・モデル入力にトークンや個人情報が混ざっていないか
- **temperature / 非決定性**: テストで実モデルを直接呼ばない（msw / fixture で固定）

### Cloudflare ランタイム

- **D1**: 単発クエリのトランザクション境界、`prepare().bind()` のパラメータバインド、`db.batch([...])` の atomic 性、`UNIQUE` 制約違反のエラー型
- **R2**: eventual visibility、`KNOWLEDGE_BUCKET` のオブジェクト一覧 cursor、broadcast 用画像 key の衝突、presigned URL の期限
- **Vectorize**: 検索の eventual consistency、ベクター次元数の整合（`gemini-embedding-001` は 1536 次元）、`upsert` の重複キー
- **Cron Trigger**: `*/5 * * * *` で重複起動した時の冪等性（broadcast 予約・poll 予約・persona 抽出）
- **Workers の制限**: subrequest 数（一斉配信で大量に LINE API を叩く時）、CPU time、リクエスト body サイズ

### LINE webhook / 配信

- **署名検証**: `x-line-signature` が無い / 不正な時に 400 を返すか
- **イベント型網羅**: message / follow / unfollow / postback の各イベントで分岐が踏まれるか
- **配信ステータス遷移**: `draft → scheduled → sent → failed` の不正遷移を弾くか（既に `sent` の broadcast を再送できないか）
- **poll 結果集計**: `poll_submissions` の集計が `closed` 後でも崩れないか

### 認証 / 認可

- **resolvePrincipal**: opaque session（`admin_sessions`）→ anonymous JWT の優先順位、両方無いとき principal が null
- **requireRole**: 未認証 401 / 権限不足 403 / 期限切れ session の扱い
- **requireThreadAccess**: 別ユーザーの thread にアクセスしたら 403
- **anonymous JWT**: 不正署名 / 期限切れ / 別 issuer
- **register/login**: パスワードハッシュ比較の timing attack、`admin_invitations.token` の使い回し（`used_at` セット後の拒否）

### フロントエンド

- **msw**: `setup.ts` で `onUnhandledRequest: "error"` なので、未モックのエンドポイントを叩いたテストは落ちる。テスト先頭で `server.use(...)` を必ず書く
- **TanStack Query**: テスト用 `QueryClient` は retry: false / gcTime: 0 / staleTime: 0。retry を期待するロジックは別途モックする
- **renderHookWithQuery / renderWithQuery**: 各テストで新しい `QueryClient` が作られるので、テスト間でキャッシュが残らない前提で書く
- **assistant-ui**: ストリーミング応答の途中状態（`status.type === "running"`）と完了後の表示が分岐するか
- **a11y**: role / label / focus 順序、`dvh` を使って vh の落とし穴を踏んでいないか
- **route 変化中の async**: 画面離脱後の setState（Astro の MPA 構成でもクライアント遷移をする画面）

## 各軸の使い方

1. 軸 1 の 4 分類を必ず **検討** する。該当しないものは書かない（純粋関数で例外系が無い、Zod / OpenAPI 層で異常系が吸収される薄い mapper など）
2. 軸 2 の 8 観点を「該当するか」順に判定し、該当するものだけケース化
3. 軸 3 のうち、機能が触る範囲で必要なものを当てる
4. 全体を見て「実装が落ちうる場所」を再確認（ミューテーション思考）
