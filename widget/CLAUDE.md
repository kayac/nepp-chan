# CLAUDE.md - widget

外部サイト（村公式ホームページ等）に `<script>` 1 行で貼れる、ねっぷちゃんの埋め込みチャットウィジェット。

## 仕組み

- ローダー `widget.js`（vanilla JS）が host ページに右下のフローティングボタンを注入し、クリックで iframe パネルを開閉する（visibility/opacity/transform でトランジション）。
- チャット本体は iframe 内ページの `WidgetChat`（フローティングウィジェット専用 UI。LP のティーザー `MiniChat` とは別コンポーネント）。web / LINE と同じ `/threads` 系エンドポイント（Mastra memory・スレッド永続化あり）に接続する。widget は「お試し」ではなく村民が実際に使う正規チャンネルという位置づけのため、web と同様の会話継続性を持たせている。
- マウント時に匿名 JWT セッションを取得し（`POST /auth/anonymous-session` に `platform: "widget"` を渡す）、resourceId は `widget-` prefix 付きで発行される（`line:` / `admin:` と同じ、resourceId prefix でチャネルを区別する規約）。この prefix により `/threads/{threadId}/chat` 側でエージェントの利用可能ツール・エージェント（`platform: "widget"`、`emergencyReporterAgent` 等を除外する安全上のスコープ制限）と `llm_usage.platform` が正しく "widget" として扱われる。
- スレッドはパネルを開く（`WidgetChat` がマウントする）たびに新規作成する。widget はアクセスごとに違う質問をするユースケースが中心のため、cross-visit の会話継続は行わない（localStorage に threadId は保存しない）。開いている間の複数往復は Mastra memory の恩恵を受ける。
- 匿名セッションのトークン/resourceId は localStorage（`nepp-chan-widget:session-token` / `nepp-chan-widget:resource-id`）に保存し、同じブラウザでの再訪問時は再利用する（90日有効）。
- iframe は lp と同一 origin（`nepp-chan.ai/widget/`）配信。fetch の Origin は配信元になるため、ローダーを貼る host サイトのオリジンは API の CORS 許可リストに無関係。
- iframe → loader の「閉じる」連携は `postMessage`。loader 側で `event.origin`（iframeSrc のオリジン）と `event.source`（iframe の contentWindow）を検証してから閉じる。
- loader は iframe の src に `?host=<埋め込み元の origin + pathname>` を付ける。iframe は自ドメイン配信で `Referer` が使えないため、どのページに置かれた widget かはこのクエリでしか分からない。GA の `page_location` にそのまま乗るので、ページ別の利用状況はレポート上で切れる。host 側の URL に個人情報が乗りうるのでクエリ文字列とハッシュは落とす。値は自己申告なので認可には使えない。
- iframe は上記 `host` クエリからホスト名だけを取り出し、チャット送信時に `siteHost` として API に渡す。サーバーは `widget_sites` テーブル（管理画面の「設置サイト」タブで super_admin が編集）に完全一致で登録があるときだけ、その行の instructions をねっぷちゃんに足す。`siteHost` は host 側の自己申告で偽装できるため、instructions に入るのは管理画面で登録されたテキストだけにしてある。パスは渡さない（閲覧ページ自体が機微になりうるうえ、会話に混ざると Mastra memory やペルソナ抽出に流入するため）。
- ボタン設置 2500ms 後、`INITIAL_MESSAGE` の挨拶文を吹き出しティーザーとして表示する。localStorage（`nepp-chan-widget:teaser-dismissed-at`）に閉じた時刻を記録し、7 日以内は再表示しない。

## host への導入

```html
<script src="https://nepp-chan.ai/widget/widget.js" defer></script>
```

host 側で CSP を設定している場合は `nepp-chan.ai` を `script-src` と `frame-src` に許可する。

## 配信

lp の Pages に同居配信する。`lp build` が widget をビルドして `lp/public/widget/` に出力し、Astro が `dist/widget/` へ配置する（専用サブドメインは設けない）。API URL / Web URL はビルド時に `VITE_API_URL` / `VITE_WEB_URL` で注入する（deploy ワークフローの LP ジョブで設定）。

GA は `VITE_GA_MEASUREMENT_ID` を渡した本番ビルドでのみ有効（lp と同じ測定 ID）。host サイトから見るとサードパーティ Cookie になるため、ブロック環境では計測が漏れる。

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

- `src/WidgetChat.tsx` — フローティングウィジェット専用のチャット UI（フルハイト・連続会話・ヘッダーに閉じるボタン）。マウント時に匿名セッション取得 → スレッド作成の順で bootstrap し、`@ai-sdk/react` の `DefaultChatTransport` で `/threads/{threadId}/chat` を叩く
- `src/anonymous-session.ts` — `acquireAnonymousSession`。匿名 JWT の取得・localStorage 読み書き
- `src/thread.ts` — `createThread`。`POST /threads` で新規スレッドを作成
- `src/site-host.ts` — `resolveSiteHost`。loader が付ける `host` クエリからホスト名だけを取り出す
- `src/iframe-entry.tsx` — iframe 中身。`WidgetChat` をマウント
- `src/iframe.css` — Tailwind + shared スタイルを iframe に読み込む
- `src/messages.ts` — `CLOSE_MESSAGE_TYPE`（loader と iframe で共有する postMessage の type）
- `src/loader.ts` — ボタン + iframe 注入ロジック、iframe からの close postMessage 受信（テスト対象）
- `src/loader-entry.ts` — `widget.js` のエントリ。`document.currentScript` から URL を解決して `mountWidget` を実行
- `vite.iframe.config.ts` / `vite.loader.config.ts` — iframe ページとローダーの 2 ビルド
