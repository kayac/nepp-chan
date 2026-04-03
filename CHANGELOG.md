# Changelog

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
