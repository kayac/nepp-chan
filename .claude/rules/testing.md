---
description: "テストに関するプロジェクト共通の方針。カバレッジ除外・閾値・プロダクトコード保護のルール。"
---

# テスト方針

汎用的な書き方の観点・規則は `test-writing-rules` スキルを参照。
ここではこのプロジェクト固有の決定だけを書く。

## テスト対象

テストはロジック（分岐・計算・境界）に対して書く。宣言的な設定・配線だけのファイル（`mastra/agents/` のエージェント定義等）は co-located テスト必須の対象外で、担保は型に任せる（stop-check.sh も対象から除外している）。モデル名や effort などの設定値を assert で写すコンフィグ断言テストは書かない。instructions の仕様を検証するテストは任意で書いてよい。

## 道具

- 配置: co-located（`foo.ts` の隣に `foo.test.ts`）
- server: vitest + libsql（in-memory）+ msw / coverage-istanbul
- web: vitest + jsdom + Testing Library + msw / coverage-v8
- web は `TZ=Asia/Tokyo` 固定で実行（`package.json` の test スクリプトで指定）

## 共通ヘルパ

- server: `server/src/__tests__/helpers/`（`test-app` / `test-db` / `tool-context`）
- web: `web/src/test/`（`msw-server` / `renderHookWithQuery` / `renderWithQuery` / `setup`）

## カバレッジ集計の除外

カバレッジは `include` 対象の未テストファイルも母数に含むため、「カバレッジを上げるためだけの薄いテストは書かない」方針に従い、本質的ロジックを持たないファイルは exclude する。

判断軸（具体的なファイルは各 `vitest.config.ts` の `coverage.exclude` に理由コメント付きで列挙）:

- StrictMode / フォールバック UI ラッパー（Sentry / Error Boundary 初期化など）
- Astro から `client:only` でマウントされる薄い page shell
- 外部 SDK 連携が深く E2E 領域に該当するもの（recharts 描画や副作用中心の表示など）
- HOC で囲んだ登録 / barrel / registry
- 責務分離が完了して orchestration だけになった Panel / Provider / context wrapper
- 自動生成資源（Mastra の `mastra/public/**` 等）

orchestration shell を exclude するときは「本質的ロジックが hooks / helpers / 子コンポーネントに抽出済みで、別途テストされている」ことを確認してから行う。

## カバレッジ閾値

- 実測値ベースで段階引き上げ（各 `vitest.config.ts` の `coverage.thresholds`）
- ぎりぎりではなく実測 - 1〜2pt のマージンを付ける（CI のノイズ防止）

## カバレッジのためにプロダクトコードを変更しない

カバレッジ目的で error/guard 分岐を削除しない。runtime 上到達不能でも型ナローイング（discriminated union の絞り込み等）を担う分岐がある。カバレッジが上がらない箇所は exclude か閾値据え置きで対応する。

テストしづらい巨大コンポーネントに smoke render を足してカバレッジを稼ぐのも禁止。テストしづらさは設計のフィードバックとして扱い、純関数・hook・子コンポーネントに分割してからテストする。
