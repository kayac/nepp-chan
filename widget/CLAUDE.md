# CLAUDE.md - widget

外部サイト（村公式ホームページ等）に `<script>` 1 行で貼れる、ねっぷちゃんの埋め込みチャットウィジェット。

## 仕組み

- ローダー `widget.js`（vanilla JS）が host ページに右下のフローティングボタンを注入し、クリックで iframe パネルを開閉する（visibility/opacity/transform でトランジション）。
- チャット本体は iframe 内ページの `WidgetChat`（フローティングウィジェット専用 UI。LP のティーザー `MiniChat` とは別コンポーネント）。`/simple-chat`（認証なし、直近最大 10 件の bounded history を送信、サーバー側の永続化なし）に接続する。
- iframe は lp と同一 origin（`nepp-chan.ai/widget/`）配信。fetch の Origin は配信元になるため、ローダーを貼る host サイトのオリジンは API の CORS 許可リストに無関係。
- iframe → loader の「閉じる」連携は `postMessage`。loader 側で `event.origin`（iframeSrc のオリジン）と `event.source`（iframe の contentWindow）を検証してから閉じる。
- ボタン設置 2500ms 後、`INITIAL_MESSAGE` の挨拶文を吹き出しティーザーとして表示する。localStorage（`nepp-chan-widget:teaser-dismissed-at`）に閉じた時刻を記録し、7 日以内は再表示しない。

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
pnpm --filter @nepp-chan/widget test   # WidgetChat / loader の単体テスト
```

## 構成

- `src/WidgetChat.tsx` — フローティングウィジェット専用のチャット UI（フルハイト・連続会話・ヘッダーに閉じるボタン）。`@nepp-chan/shared` の `ChatMarkdown` / `createSimpleChatTransport` を利用
- `src/iframe-entry.tsx` — iframe 中身。`WidgetChat` をマウント
- `src/iframe.css` — Tailwind + shared スタイルを iframe に読み込む
- `src/messages.ts` — `CLOSE_MESSAGE_TYPE`（loader と iframe で共有する postMessage の type）
- `src/loader.ts` — ボタン + iframe 注入ロジック、iframe からの close postMessage 受信（テスト対象）
- `src/loader-entry.ts` — `widget.js` のエントリ。`document.currentScript` から URL を解決して `mountWidget` を実行
- `vite.iframe.config.ts` / `vite.loader.config.ts` — iframe ページとローダーの 2 ビルド
