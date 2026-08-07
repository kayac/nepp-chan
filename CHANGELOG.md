# Changelog

## [v1.0.10](https://github.com/kayac/nepp-chan/compare/v1.0.9...v1.0.10) - 2026-08-07

- fix(widget): intent 固定をやめてサーバーの intent 分類に委ねる by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/990

## [v1.0.9](https://github.com/kayac/nepp-chan/compare/v1.0.8...v1.0.9) - 2026-08-06

- ダッシュボードの週次レポート表示順と今週の話題の集計を調整 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/987
- fix(server): Gemini の thinking 無効化指定を minimal に変更 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/989

## [v1.0.8](https://github.com/kayac/nepp-chan/compare/v1.0.7...v1.0.8) - 2026-08-05

- chore: Claude Code の品質ゲートと rules を整備する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/770
- fix(server): embedding テキストに strip されたヘッダー情報を復元 by @vesperworks in https://github.com/kayac/nepp-chan/pull/772
- build(deps): bump @line/bot-sdk from 11.0.1 to 11.0.2 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/778
- build(deps): bump @sentry/react from 10.57.0 to 10.59.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/781
- build(deps): bump ai from 6.0.198 to 6.0.208 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/782
- build(deps): bump @radix-ui/react-slot from 1.2.5 to 1.3.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/785
- build(deps): bump @ai-sdk/react from 3.0.200 to 3.0.210 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/789
- build(deps): bump @ai-sdk/openai from 3.0.71 to 3.0.73 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/792
- build(deps): bump lucide-react from 1.20.0 to 1.21.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/796
- build(deps): 残り21依存パッケージを一括更新（Mastra系/AI SDK/ツール類） by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/806
- fix: GA 計測を本番デプロイのみに限定 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/810
- 外部サイトに script 1 行で埋め込めるチャットウィジェットを追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/838
- chore(claude): スキル・hook の棚卸しと修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/839
- widget を LP に統合し、simple-chat から本チャンネルへ移行 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/871
- build(deps): patch/minor 依存 15 件を一括 bump by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/872
- feat: デザイン憲法 DESIGN.md と np-design スキルを追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/873
- build(deps): Mastra 系 10 パッケージを一括 bump by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/874
- build(deps): astro 7 / vite 8 系 4 パッケージを一括 bump by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/875
- fix(server): Mastra 未登録 Agent の generate が workerd でクラッシュする問題を回避 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/903
- feat: 通話機能 Phase 0 — 音声ブレイン + ブラウザ softphone 検証 (#773) by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/809
- fix(web): softphoneの発信音とwelcomeGreetingの重なりを解消 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/906
- fix(server): 検索前の待機案内を最後まで再生する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/907
- デザインシステム・コンポーネント共通化ブラッシュアップ by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/935
- perf(server): 音声会話のD1依存を応答経路から外す by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/908
- build(deps): patch/minor の依存26件を一括更新 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/936
- build(deps): bump @mastra/core from 1.49.0 to 1.52.1 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/909
- build(deps): mastra 系更新と unref ワークアラウンド削除 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/938
- build(deps): bump the react group across 1 directory with 2 updates by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/939
- build(deps): bump hono from 4.12.31 to 4.12.32 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/954
- build(deps-dev): bump postcss from 8.5.22 to 8.5.23 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/946
- build(deps-dev): bump @vitejs/plugin-react from 6.0.3 to 6.0.4 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/944
- build(deps): bump @sentry/react from 10.67.0 to 10.68.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/945
- build(deps): bump @radix-ui/react-slot from 1.3.0 to 1.3.3 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/959
- build(deps): bump @sentry/cloudflare from 10.67.0 to 10.68.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/942
- build(deps): bump @tanstack/react-query from 5.101.2 to 5.101.4 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/960
- build(deps-dev): bump @testing-library/jest-dom from 6.9.1 to 7.0.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/948
- build(deps): bump recharts from 3.9.2 to 3.10.1 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/949
- build(deps-dev): bump @biomejs/biome from 2.5.2 to 2.5.5 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/940
- feat(knowledge): 広報おといねっぷ 2026年4〜7月号 + 納涼まつり2026を追加 by @vesperworks in https://github.com/kayac/nepp-chan/pull/985
- 管理画面のホームを今週のサマリー中心に再構成 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/986

## [v1.0.7](https://github.com/kayac/nepp-chan/compare/v1.0.6...v1.0.7) - 2026-06-17

- security: @mastra/deployer マルウェア依存を除去 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/768

## [v1.0.6](https://github.com/kayac/nepp-chan/compare/v1.0.5...v1.0.6) - 2026-06-17

- 分析ダッシュボードの整理 by @vesperworks in https://github.com/kayac/nepp-chan/pull/743
- feat(web): Landing を吹き出し化し location 初回訪問で歓迎挨拶を開始する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/765
- build(deps): 依存パッケージを一括更新する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/767

## [v1.0.5](https://github.com/kayac/nepp-chan/compare/v1.0.4...v1.0.5) - 2026-06-15

- GA4 を lp / web に導入する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/744

## [v1.0.4](https://github.com/kayac/nepp-chan/compare/v1.0.3...v1.0.4) - 2026-06-12

- feat: ビジュアルアイデンティティを CC BY 4.0 で追加 by @vesperworks in https://github.com/kayac/nepp-chan/pull/685
- refactor(web): チャットUIを assistant-ui から useChat ベースへ置き換え by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/730
- chore(deps): AI SDK を v6 系へ更新（server/web/lp） by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/731
- test: テストカバレッジの底上げと閾値引き上げ by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/732
- fix(chat): staff ロールに管理者専用エージェントを割り当てない by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/435
- build(deps-dev): bump @vitest/coverage-v8 from 4.1.7 to 4.1.8 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/690
- build(deps): bump @ai-sdk/openai from 3.0.66 to 3.0.68 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/709
- build(deps-dev): bump vitest from 4.1.7 to 4.1.8 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/698
- build(deps): bump lucide-react from 1.16.0 to 1.17.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/701
- build(deps-dev): bump @vitest/coverage-istanbul from 4.1.7 to 4.1.8 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/702
- build(deps-dev): bump wrangler from 4.95.0 to 4.98.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/712
- build(deps-dev): bump tsx from 4.22.3 to 4.22.4 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/704
- build(deps): bump astro from 6.3.8 to 6.4.4 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/722
- build(deps): bump react/react-dom を 19.2.7 に揃える by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/733
- build(deps): bump the react group with 3 updates by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/734
- build(deps): bump hono from 4.12.23 to 4.12.25 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/735
- build(deps-dev): bump @types/node from 25.9.1 to 25.9.2 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/727
- build(deps): bump @sentry/cloudflare from 10.54.0 to 10.56.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/724
- build(deps): bump @tanstack/react-query from 5.100.14 to 5.101.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/723
- build(deps): bump @radix-ui/react-slot from 1.2.4 to 1.2.5 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/719
- build(deps): bump @sentry/react from 10.54.0 to 10.57.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/710
- build(deps): bump @astrojs/react from 5.0.5 to 5.0.7 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/706
- build(deps): bump @mastra/mcp from 1.8.1 to 1.9.1 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/729
- build(deps): bump @mastra/loggers from 1.1.1 to 1.1.2 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/726
- build(deps): bump @mastra/evals from 1.2.3 to 1.2.4 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/721
- feat: スーパーアドミン向け分析ダッシュボードを追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/736
- build(deps): mastra パッケージ群を最新版へ更新 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/737
- 管理ユーザー削除 API を追加し、登録済みアカウントを削除できるようにする by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/738
- feat: mastra 1.41 の新機能採用とツール表示まわりの疎結合化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/739
- feat: lp / web に OGP・Twitter Card メタタグを追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/740
- feat(web): location クエリパラメータで歓迎挨拶を開始する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/741
- feat(lp): LINE 友だち追加用の OGP リダイレクトページを追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/742

## [v1.0.3](https://github.com/kayac/nepp-chan/compare/v1.0.2...v1.0.3) - 2026-05-29
- feat(server): LINE配信の参照を関連性ベースに広げる by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/683

## [v1.0.2](https://github.com/kayac/nepp-chan/compare/v1.0.1...v1.0.2) - 2026-05-29
- chore: dev LP のドメインを dev.nepp-chan.ai に統一 + README 更新 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/649
- feat(server): LINE スタンプ受信時にねっぷちゃんが返信 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/674
- fix(server): ペルソナ一覧を会話日時優先で並び替え by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/675
- perf(server): LINE の体感レイテンシを改善する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/676
- perf(server): webhook 受信時にローディングを先出しする by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/677
- feat(web/chat): モバイルでもチャット画面にマスコットを表示する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/678
- build(deps): bump astro from 6.3.5 to 6.3.7 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/651
- build(deps-dev): bump @vitest/coverage-istanbul from 4.1.6 to 4.1.7 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/658
- build(deps-dev): bump tsx from 4.22.2 to 4.22.3 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/656
- build(deps): bump hono from 4.12.19 to 4.12.23 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/673
- fix(web): チャット TopBar を透明にしてスクロール時の見切れを解消 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/679
- chore(deps): @mastra/core@1.10.0 互換範囲で依存を一斉アップデート by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/680
- feat(server): ねっぷちゃんのペルソナを公式プロフィールに整合 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/681
- fix(server): ペルソナ抽出を全件取得＋差分更新に修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/682

## [v1.0.1](https://github.com/kayac/nepp-chan/compare/v1.0.0...v1.0.1) - 2026-05-21
- fix(server): 旧 admin JWT による /threads などの 500 を防ぐ by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/647

## [v1.0.0](https://github.com/kayac/nepp-chan/compare/v0.4.4...v1.0.0) - 2026-05-21
- v5 データ処理 + 検索精度改善 by @vesperworks in https://github.com/kayac/nepp-chan/pull/427
- 認証主体を Principal に統一 + Intent 2段化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/434
- chore(deps-dev): bump vite-tsconfig-paths from 5.1.4 to 6.1.1 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/429
- refactor: admin 認証を opaque session に移行し認証認可を整理 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/507
- feat: LINE 配信メッセージのスレッド注入と検索統合 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/509
- feat: アンケート投票結果の公開ページを追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/511
- fix(server): admin_sessions マイグレーションを冪等に修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/512
- feat(server): 投票結果リンクを回答完了時に送信 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/513
- fix(server): 名前不明時のプレースホルダー呼称を禁止 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/514
- refactor: アンケート機能を投票機能に一本化し、回答後のねっぷちゃん会話継続を実装 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/516
- feat(server): 投票のフォローアップ方針を内部メモ形式で強化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/520
- feat(server): 管理者モード向けに投票結果取得ツール pollGetTool を追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/521
- feat(server): LINE配信におしらせ解説ボタンを追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/522
- fix(server): 解説ボタンのラベルを短縮して見切れを防止 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/523
- feat(server): 解説ボタンに説明文を添えて意図を明確化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/524
- feat(web): Companion v2 デザインをチャット画面に適用 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/539
- feat(web): LP (/lp) 追加 + AmbientBG・Mascot を共通化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/542
- feat(web): chat ヘッダーを LP のトンマナに統一しロゴから /lp へ遷移可能に by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/543
- feat: LP の MiniChat にストリーミング対応のシンプルなチャット API を実装 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/544
- feat: LP を独立した lp パッケージに切り出す by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/545
- refactor: 共通 UI を @nepp-chan/shared に集約し Layout.astro で head を共通化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/546
- fix(web): ログアウト見え状態でのチャット 401 永続ローディングを解消する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/548
- test: web/server のテスト基盤とカバレッジ整備 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/553
- refactor: repository と API 型を @nepp-chan/shared に集約 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/554
- refactor: repository と API 型を @nepp-chan/shared に集約 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/556
- refactor: Sentry 依存を完全削除し Workers Logs に一本化する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/558
- feat(server): LINE userId 由来の resourceId / threadId を HMAC-SHA256 でハッシュ化する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/559
- fix(server): Workers Logs に LINE 生 userId を出さないようにする by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/560
- feat(server): LINE unfollow → 全関連データ削除パイプラインを実装する (#20) by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/561
- refactor(server): LINE userId の HMAC 計算を 1 回にまとめる toLineIds を新設する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/562
- refactor: LINE userId HMAC 統合と関連 lint クリーンアップ by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/563
- feat(server): 保管期間自動削除 Cron を実装する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/564
- ci: Dependabot の同時オープン PR 上限を 99 に引き上げる by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/566
- refactor(server): persona の resource_id を廃止する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/565
- build(deps): bump recharts from 3.7.0 to 3.8.1 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/503
- chore(deps): 低リスクな依存を一括 bump する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/613
- refactor: テスタビリティ向上とカバレッジ強化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/611
- build(deps): bump @line/bot-sdk from 10.6.0 to 11.0.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/584
- chore(deps-dev): vitest を 4.1.6 に更新 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/614
- build(deps-dev): bump typescript from 5.9.3 to 6.0.3 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/576
- build(deps): bump lucide-react from 0.562.0 to 1.14.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/607
- test: vitest v4 計測差異に合わせ web の coverage 閾値を 90% 台へ引き上げる by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/615
- refactor(web): app に閉じる hooks を app/<feature>/hooks/ に colocate する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/616
- fix(lint): biome 全 warning の解消と test 共通ヘルパの整理 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/617
- feat: Sentry を再導入し個人情報保護クリティカル処理の重大通知を可視化する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/618
- feat(data-retention): Sentry Cron Monitor で不起動検知を有効化 (closes #36) by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/639
- refactor(logger): logger.error の Workers Logs 出力を serializeError 経由に揃えて PII 流出を防ぐ by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/640
- build(deps): bump hono from 4.12.18 to 4.12.19 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/634
- build(deps): bump lucide-react from 1.14.0 to 1.16.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/636
- build(deps-dev): bump @types/node from 25.7.0 to 25.8.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/635
- build(deps-dev): bump wrangler from 4.90.1 to 4.92.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/630
- build(deps): bump @sentry/cloudflare from 10.45.0 to 10.53.1 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/625
- build(deps): bump astro from 6.3.1 to 6.3.5 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/628
- build(deps-dev): bump @sentry/vite-plugin from 5.1.1 to 5.3.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/629
- build(deps-dev): bump tsx from 4.21.0 to 4.22.2 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/620
- design: ブランドカラー刷新・マスコットアイコン更新・favicon SVG 化 by @vesperworks in https://github.com/kayac/nepp-chan/pull/641
- style: LINE Flex Message と投票結果バーの色を新トンマナに揃える by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/642
- build(deps): bump @sentry/react from 10.43.0 to 10.53.1 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/624
- feat: プライバシーポリシー・利用規約ページを追加 by @vesperworks in https://github.com/kayac/nepp-chan/pull/643
- feat: LINE Flex と投票結果ページのデザイン刷新（共通山ヘッダー・ブランド配色） by @vesperworks in https://github.com/kayac/nepp-chan/pull/644
- feat(lp): LINE 友達追加ボタンを公式アカウント URL に反映 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/645

## [v0.4.3](https://github.com/kayac/nepp-chan/compare/v0.4.2...v0.4.3) - 2026-04-03
- feat: URL正答率改善 + ナレッジデータ v5 by @vesperworks in https://github.com/kayac/nepp-chan/pull/423
- fix(server): ペルソナ一括抽出で処理済みスレッドのスキップコストを削減 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/425
- Release for v0.4.3 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/424

## [v0.4.3](https://github.com/kayac/nepp-chan/compare/v0.4.2...v0.4.3) - 2026-04-03
- feat: URL正答率改善 + ナレッジデータ v5 by @vesperworks in https://github.com/kayac/nepp-chan/pull/423

## [v0.4.2](https://github.com/kayac/nepp-chan/compare/v0.4.1...v0.4.2) - 2026-04-03
- feat: 匿名セッションによるresourceId所有権検証 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/419
- fix: Dependabot alert対応（hono, @hono/zod-openapi, astro） by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/421

## [v0.4.1](https://github.com/kayac/nepp-chan/compare/v0.4.0...v0.4.1) - 2026-04-02
- fix(ci): tagpr.ymlにactions: write権限を追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/416

## [v0.4.0](https://github.com/kayac/nepp-chan/compare/v0.3.0...v0.4.0) - 2026-04-02
- feat(server): Sentry Logs ラッパー導入・全ログ統一 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/291
- feat: LINE配信（broadcast）機能を追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/293
- feat: ナレッジデータ品質改善 + knowledge-agent 棄権率改善 by @vesperworks in https://github.com/kayac/nepp-chan/pull/295
- feat: OpenAPI 型安全クライアント導入 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/296
- refactor(server): __mocks__ 移動と OpenAPI タイトル修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/297
- feat: frontmatter一括付与 + ゴミカレンダーchunk文脈欠落修正 + evalテストケース拡充 by @vesperworks in https://github.com/kayac/nepp-chan/pull/300
- refactor(pm-agent): スキルの汎用化・コード品質改善・日本語化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/302
- build(deps-dev): bump drizzle-kit from 0.31.8 to 0.31.9 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/290
- build(deps-dev): bump postcss from 8.5.6 to 8.5.8 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/289
- build(deps-dev): bump mastra from 1.3.7 to 1.3.12 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/288
- build(deps-dev): bump @types/node from 25.2.0 to 25.5.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/287
- feat(auth): パスキー認証からJWT認証への移行 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/338
- build(deps): bump @sentry/cloudflare from 10.43.0 to 10.45.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/339
- build(deps-dev): bump wrangler from 4.66.0 to 4.76.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/342
- build(deps): bump @hono/swagger-ui from 0.5.2 to 0.6.1 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/346
- build(deps-dev): bump @tailwindcss/vite from 4.1.17 to 4.2.2 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/345
- feat(db): drizzle-kit studio で dev/prd D1 に接続可能にする by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/347
- feat(web): Vite MPA から Astro + React MPA に移行 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/348
- fix(pm-agent): リファクタリングで欠落した機能の再現と構造最適化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/349
- feat: ロールベースアクセス制御(RBAC)の追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/350
- feat: LINE配信のマルチパーツ対応（テキスト・画像） by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/351
- fix(server): エージェント応答から内部ツール名を秘匿 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/352
- refactor(skill): pm-agent SKILL.mdのフォーマット統一と構造整理 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/353
- tagprによるリリース自動化を導入 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/354
- リファクタリング・バグ修正・モデル分離 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/357
- feat(skill): 利用分析レポート生成スキル np-report を追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/359
- feat(broadcast): 配信画像のOCRテキスト化でLLMコンテキストに含める by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/367
- fix(broadcast): Copilot レビュー指摘を修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/368
- refactor(pm-agent): eval実験に基づくSkill最適構成への移行 by @vesperworks in https://github.com/kayac/nepp-chan/pull/356
- fix: ペルソナ集計・検索のバグ修正 + 管理者レポート基盤整備 by @vesperworks in https://github.com/kayac/nepp-chan/pull/373
- refactor: DISPLAY_DATA プロトコル廃止・display ツール責務整理 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/402
- build(deps-dev): bump autoprefixer from 10.4.22 to 10.4.27 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/390
- build(deps): bump react and @types/react by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/391
- feat(agent): Intent ルーターによるモデル動的切り替え by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/404
- feat: eval基盤強化 + ナレッジ文脈補強 + stripHeaders効果検証 by @vesperworks in https://github.com/kayac/nepp-chan/pull/386
- refactor: eval レガシーワークフロー除去とスクリプト配置の整理 by @vesperworks in https://github.com/kayac/nepp-chan/pull/405
- ペルソナ抽出の品質向上 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/406
- fix(agent): ペルソナ抽出の匿名化ルール強化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/407
- fix(agent): ペルソナ匿名化で括弧書きの名前補足を禁止 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/408
- fix(agent): ペルソナ content と tags の役割分担見直し by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/409
- fix(agent): content セクションに名前禁止ルールを直接記載 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/410
- fix(auth): 管理者トークンの有効期限を8時間から7日に延長 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/411
- feat: LINEアンケート機能の実装 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/413
- ci: tagpr PR作成時にCIワークフローをトリガー by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/414
- revert: tagpr PRのCIトリガーステップを削除 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/415

## [v0.3.0](https://github.com/kayac/nepp-chan/compare/v0.2.0...v0.3.0) - 2026-03-11
- [release] 2026-02-16 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/176
- [release] 2026-02-16 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/182
- [release] 2026-02-17 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/185
- [release] 2026-02-17 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/188
- [release] 2026-02-19 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/194
- refactor: バックエンドの層構造・規約を統一 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/202
- build(deps-dev): bump wrangler from 4.53.0 to 4.66.0 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/191
- fix: ダッシュボード無限スクロールが動作しない問題を修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/204
- refactor: エージェント応答・プロンプト改善 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/205
- [release] 2026-02-26 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/203
- feat: pm-agentをnepchプロジェクトローカルに移植 by @vesperworks in https://github.com/kayac/nepp-chan/pull/213
- fix: ごみ収集日等の定期変動情報に対するハルシネーションを防止 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/226
- [release] 2026-02-27 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/214
- feat: R2ディレクトリ構造保持 & frontmatterメタデータ対応 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/227
- feat: 環境設定を local/dev/prd の3環境に統一 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/229
- fix: local 環境に Queue consumer を追加 by @vesperworks in https://github.com/kayac/nepp-chan/pull/230
- [release] 2026-03-02 by @github-actions[bot] in https://github.com/kayac/nepp-chan/pull/228
- feat: LINE Messaging API Webhook Reply エンドポイントを作成 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/215
- fix: LINE応答でMarkdown記法を使わないよう修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/236
- fix: LINE向けMarkdown禁止指示を代替表現付きに強化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/237
- feat: LINE応答からMarkdown記法を除去する後処理を追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/238
- Gemini APIコスト最適化 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/239
- LINE向けに検索・エージェント呼び出しの制限を追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/240
- build(deps): bump hono from 4.11.7 to 4.12.3 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/232
- build(deps): bump @assistant-ui/react-markdown from 0.12.1 to 0.12.5 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/235
- build(deps): bump @assistant-ui/react from 0.11.53 to 0.12.14 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/233
- revert: assistant-ui v0.12 更新を差し戻し by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/241
- feat: LINE チャネルに googleSearch を直接ツールとして追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/242
- fix: LINE webhook の waitUntil タイムアウトによる無応答を修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/243
- fix: LINE googleSearch 直接ツール化の revert と waitUntil 修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/244
- fix: LINE Queue で replyMessage を先に試行し、失敗時に pushMessage へフォールバック by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/245
- fix: LINE Queue で replyMessage を優先し pushMessage にフォールバック by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/246
- fix: LINE Queue の replyMessage/pushMessage 送信方法をログ出力 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/247
- refactor: LINE イベントハンドラーの責務を分離 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/248
- fix: Vectorize vector ID を UUID に変更して64バイト制限を回避 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/249
- hotfix: GEMINI_FLASH モデルを gemini-flash-lite-latest に変更 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/252
- feat(eval): Eval V2/V3
  スコアリング基盤の実装 by @vesperworks in https://github.com/kayac/nepp-chan/pull/253
- refactor: LINE では応答前リアクションテキストを省略する by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/272
- fix(knowledge): Queue consumer のエラー時に message.retry() を呼ぶ by @vesperworks in https://github.com/kayac/nepp-chan/pull/273
- refactor: knowledgeAgent をサブエージェント化しリトライ戦略を追加 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/281
- chore(deps): Mastra 関連パッケージを最新バージョンに更新 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/282
- build(deps): bump glob from 13.0.0 to 13.0.6 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/275
- feat: Sentry によるエラートラッキングを導入 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/283
- build(deps-dev): bump @biomejs/biome from 2.3.8 to 2.4.6 by @dependabot[bot] in https://github.com/kayac/nepp-chan/pull/277
- fix: ペルソナテーブルの属性・タグをデスクトップでも表示 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/284
- chore: v0.3.0 リリース準備 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/285
- feat(knowledge): テーブルJSON変換 + MIN_CHUNK_LENGTH調整 by @vesperworks in https://github.com/kayac/nepp-chan/pull/286

## [v0.2.0](https://github.com/kayac/nepp-chan/compare/v0.1...v0.2.0) - 2026-02-19
- fix: 検索前の発言をおうむ返し・共感に限定してハルシネーションを防止 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/181
- chore: 未使用の環境変数を削除 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/183
- fix: GitHub Actions で VITE_API_URL を設定 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/184
- fix: RAGナレッジベースのデッドリンクを修正 by @vesperworks in https://github.com/kayac/nepp-chan/pull/169
- fix(web): フィードバック送信時の ZodError を修正 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/186
- docs: README を日本語版に統一し英語版を並列追加 by @vesperworks in https://github.com/kayac/nepp-chan/pull/187
- fix: ハルシネーション防止のためプロンプトを改善 by @owk-owk130 in https://github.com/kayac/nepp-chan/pull/193

## [](https://github.com/kayac/nepp-chan/commits/v0.1) - 2025-12-17
