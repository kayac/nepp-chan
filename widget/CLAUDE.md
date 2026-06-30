# CLAUDE.md - widget

外部サイト（村公式ホームページ等）に `<script>` 1 行で貼れる、ねっぷちゃんの埋め込みチャットウィジェット。

## 仕組み

- ローダー `widget.js`（vanilla JS）が host ページに右下のフローティングボタンを注入し、クリックで iframe パネルを開閉する。
- チャット本体は iframe 内ページ（`@nepp-chan/shared` の `MiniChat`）。`/simple-chat`（認証なし・履歴なし・1 往復 SSE）に接続する。
- iframe は lp と同一 origin（`nepp-chan.ai/widget/`）配信。fetch の Origin は配信元になるため、ローダーを貼る host サイトのオリジンは API の CORS 許可リストに無関係。

## host への導入

```html
<script src="https://nepp-chan.ai/widget/widget.js" defer></script>
```

host 側で CSP を設定している場合は `nepp-chan.ai` を `script-src` と `frame-src` に許可する。

## 配信

lp の Pages に同居配信する。`lp build` が widget をビルドして `lp/public/widget/` に出力し、Astro が `dist/widget/` へ配置する（専用サブドメインは設けない）。API URL / Web URL はビルド時に `VITE_API_URL` / `VITE_WEB_URL` で注入する（deploy ワークフローの LP ジョブで設定）。

| 環境 | ローダー URL |
| ---- | ------------ |
| dev  | https://dev.nepp-chan.ai/widget/widget.js |
| prd  | https://nepp-chan.ai/widget/widget.js |

## 開発

ローカルでは API URL / Web URL を `.env` で渡す（`cp widget/.env.example widget/.env`）。これが無いと `dev` や `lp:build` で接続先が未定義になる。

```bash
pnpm --filter @nepp-chan/widget dev    # iframe ページ単体（localhost:5175）
pnpm --filter @nepp-chan/widget build  # iframe + loader を lp/public/widget へ出力
pnpm --filter @nepp-chan/widget test   # ローダーの単体テスト
```

## 構成

- `src/iframe-entry.tsx` — iframe 中身。`MiniChat` をマウント
- `src/iframe.css` — Tailwind + shared スタイルを iframe に読み込む
- `src/loader.ts` — ボタン + iframe 注入ロジック（テスト対象）
- `src/loader-entry.ts` — `widget.js` のエントリ。`document.currentScript` から URL を解決して `mountWidget` を実行
- `vite.iframe.config.ts` / `vite.loader.config.ts` — iframe ページとローダーの 2 ビルド
