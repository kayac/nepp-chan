# CLAUDE.md - web

Cloudflare Pages で動作するフロントエンド（チャット・ダッシュボード・認証等のアプリ）。
Astro + React（client:only）+ TailwindCSS。
Astro のファイルベースルーティングで MPA 構成、各ページはフル CSR React。
LP（apex 配信の静的サイト）は別パッケージ `lp/` にある。

## ファイル探索ガイド

| 探したいもの          | 場所                                   |
| --------------------- | -------------------------------------- |
| ページルーティング    | `pages/*.astro`                        |
| チャット画面          | `app/chat/`                            |
| チャット UI           | `components/chat/`                     |
| ツール表示 UI         | `components/chat/tool-uis/`            |
| 共通 UI               | `components/ui/`                       |
| モーダル/ダイアログ    | `components/ui/Dialog.tsx`（native `<dialog>` ベース） |
| 共通レイアウト        | `components/RootLayout.tsx`            |
| マスコット表示        | `components/Mascot.tsx`                |
| 背景アニメーション    | `components/AmbientBG.tsx`             |
| ダッシュボード画面    | `app/dashboard/`                       |
| 認証画面              | `app/auth/`                            |
| API クライアント      | `lib/api/repository.ts`（factory は `@nepp-chan/shared/api`） |
| 共通フック            | `hooks/`（app 固有のフックは `app/<feature>/hooks/`） |
| 型定義                | `types/`                               |
| Basic 認証            | `functions/_middleware.ts`             |
| LP への外部リンク     | `constants/urls.ts`                    |

## ディレクトリ構成

```text
web/
├── astro.config.ts      # Astro 設定（Vite プラグイン含む）
├── src/
│   ├── pages/                 # Astro ファイルベースルーティング
│   │   ├── index.astro        # / → チャット画面
│   │   ├── dashboard.astro    # /dashboard → ダッシュボード
│   │   ├── login.astro        # /login → ログイン
│   │   ├── register.astro     # /register → 登録
│   │   └── poll.astro         # /poll → 投票結果
│   ├── app/                   # React ページコンポーネント
│   │   ├── chat/              # チャット画面
│   │   │   ├── App.tsx              # エントリー（RootLayout + QueryProvider）
│   │   │   ├── ChatPage.tsx         # メインページ（スレッド管理）
│   │   │   ├── feedback-helpers.ts  # メッセージ/フィードバック抽出ユーティリティ
│   │   │   ├── contexts/            # ChatContext（ChatProvider + useChatContext）
│   │   │   └── hooks/                # chat 専用フック（useThreadManager / useThreads / useAnonymousSession / useSubmitFeedback）
│   │   ├── auth/              # 認証画面
│   │   │   ├── LoginPage.tsx        # ログインページ
│   │   │   └── RegisterPage.tsx     # 登録ページ
│   │   ├── poll/              # 投票結果画面
│   │   │   └── PollResultsPage.tsx  # 投票結果ページ
│   │   └── dashboard/         # ダッシュボード画面
│   │       ├── DashboardPage.tsx    # エントリー（RootLayout + Providers）
│   │       ├── App.tsx              # ダッシュボード本体（認証ガード含む）
│   │       ├── contexts/            # AuthContext
│   │       ├── hooks/               # dashboard 専用フック（useAnalytics / useBroadcasts / useEmergencies / useFeedback / useInvitations / useKnowledge / usePersonas / usePolls / useInfiniteScroll / useRole / keys）
│   │       └── components/          # パネル群（分析タブは components/analytics/ にセクション分割）
│   ├── components/
│   │   ├── RootLayout.tsx     # 共通レイアウト（StrictMode + Sentry）
│   │   ├── AmbientBG.tsx      # bg-winter + 雪 + 星座を統合した canvas 背景
│   │   ├── Mascot.tsx         # マスコット表示
│   │   ├── chat/             # チャット UI（useChat ベース）
│   │   │   ├── Thread.tsx         # メッセージ一覧 + Composer の組み立て
│   │   │   ├── Composer.tsx       # 入力欄（IME / タッチ / 送信・停止）
│   │   │   ├── UserMessage.tsx
│   │   │   ├── AssistantMessage.tsx
│   │   │   ├── MarkdownText.tsx   # react-markdown ベース
│   │   │   ├── ToolPart.tsx       # tool part → 表示コンポーネントのアダプタ
│   │   │   ├── ToolFallback.tsx
│   │   │   ├── types.ts           # ToolPartComponent 互換型
│   │   │   ├── hooks/             # useStickToBottom
│   │   │   └── tool-uis/
│   │   └── ui/                # shadcn/ui ベース共通コンポーネント
│   ├── hooks/                 # 複数 app から使う共有フック（useAdminUser / useCopyToClipboard）
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts      # 共通 API クライアント（shared/api factory を web 依存で wiring）
│   │   │   └── repository.ts  # 各 domain の repository 実体（shared/api/repository factory + client）
│   │   ├── auth-token.ts      # 管理者トークン / セッショントークン（localStorage）
│   │   ├── resource.ts        # resourceId 生成・取得
│   │   ├── sentry.ts          # Sentry 初期化
│   │   └── class-merge.ts     # cn ユーティリティ
│   ├── constants/
│   │   └── urls.ts            # 外部 URL 定数（PUBLIC_LP_URL 等）
│   ├── providers/             # QueryProvider 等
│   ├── types/                 # 共有型定義
│   └── index.css              # グローバル CSS（CSS 変数定義含む）
├── functions/
│   └── _middleware.ts         # Basic 認証
└── tsconfig.json
```

## 技術スタック

- **Astro** 6 - ファイルベースルーティング（MPA）
- **React** 19 - `client:only="react"` でフル CSR
- **TailwindCSS** 4
- **TanStack Query** 5 - データフェッチング・キャッシング
- **チャット UI**（`components/chat/`）
  - `@ai-sdk/react` の `useChat` - メッセージ状態・ストリーミング・ツール結果
  - `react-markdown` + `remark-gfm` - Markdown レンダリング
  - サーバーは AI SDK data stream protocol（`POST /threads/{threadId}/chat`）
- **Radix UI** - ツールチップ等の基盤

## ページ追加方法

1. `src/pages/` に `.astro` ファイルを作成
2. `src/app/` に React コンポーネントを作成（`RootLayout` で囲む）
3. `.astro` から `client:only="react"` でマウント

```astro
---
import "~/index.css";
import { MyPage } from "~/app/my-feature/MyPage";
---

<html lang="ja">
  <head>...</head>
  <body>
    <MyPage client:only="react" />
  </body>
</html>
```

## チャット UI アーキテクチャ

`@ai-sdk/react` の `useChat` を `ChatProvider` で 1 回呼び、`useChatContext` で
配下に配る。

```text
ChatPage
  └── ChatProvider (useChat → ChatContext)
      ├── Thread
      │   ├── messages.map
      │   │   ├── UserMessage
      │   │   └── AssistantMessage
      │   │       ├── MarkdownText (text part)
      │   │       ├── ToolPart (tool part → toolsByName / ToolFallback)
      │   │       └── FeedbackModal (👍👎💡 押下で開く dialog)
      │   └── Composer (入力欄)
      └── ChatStandingMascot
```

メッセージ末尾への自動追従は `useStickToBottom` フックが担う。
フィードバックは `AssistantMessage` 内のローカル state で開閉し、送信ロジックは
`useSubmitFeedback`（`threadId` / `messages` は `useChatContext` から取得）に集約する。

### ツール UI 実装

ツール表示は `ToolPartComponent`（`components/chat/types.ts`）型のコンポーネントとして
作り、`toolsByName` に `toolName` で登録する。`ToolPart` が AI SDK の tool part
（`state` / `input` / `output`）を props に変換して振り分ける。

```typescript
import type { ToolPartComponent } from "~/components/chat/types";

export const WeatherToolComponent: ToolPartComponent = ({ args, result, status }) => {
  if (status.type === "running") return <LoadingState />;
  if (!result) return null;
  return <WeatherCard result={result} />;
};

// tool-uis/index.ts で登録（toolName は agent の tools キーと一致させる）
export const toolsByName: Record<string, ToolPartComponent> = {
  "get-weather": WeatherToolComponent,
  // ...
};
```

ユーザー操作の結果をツールに返す場合は props の `addResult(output)` を呼ぶ
（内部で useChat の `addToolOutput` に渡る）。

## CSS 変数（テーマ）

`index.css` で定義。管理画面と統一された stone/teal ベースのカラースキーム。

```css
:root {
  --color-bg: #fafaf9;           /* stone-50 */
  --color-surface: white;
  --color-accent: #0f766e;       /* teal-700 */
  --color-text: #1c1917;         /* stone-900 */
  /* ... */
}
```

## MPA 構成

| パス         | .astro ファイル        | React コンポーネント    |
| ------------ | ---------------------- | ----------------------- |
| `/`          | `pages/index.astro`    | `app/chat/App`          |
| `/dashboard` | `pages/dashboard.astro`| `app/dashboard/DashboardPage` |
| `/login`     | `pages/login.astro`    | `app/auth/LoginPage`    |
| `/register`  | `pages/register.astro` | `app/auth/RegisterPage` |
| `/poll`      | `pages/poll.astro`     | `app/poll/PollResultsPage` |

## コーディング規約

### コンポーネント

```typescript
interface Props {
  message: string;
  onSubmit: () => void;
}

export const MessageItem = ({ message, onSubmit }: Props) => {
  return <div>...</div>;
};
```

### TailwindCSS 4

Tailwind CSS 4 の短縮記法と CSS 変数記法を使用。

```tsx
// CSS 変数参照
<div className="bg-(--color-surface) text-(--color-text)" />

// 透明度
<div className="bg-stone-500/3" />  // 3% opacity
```

### ビューポート単位

モバイルブラウザのアドレスバー対応のため、`vh` ではなく `dvh`（dynamic viewport height）を使用する。

```tsx
// NG: vh（モバイルでアドレスバー分がはみ出る）
<div className="h-screen min-h-screen max-h-[90vh]" />

// OK: dvh
<div className="h-dvh min-h-dvh max-h-[90dvh]" />
```

## デプロイ環境

| 環境 | URL | Pages プロジェクト |
| ---- | --- | ------------------ |
| ローカル | http://localhost:5173 | - |
| dev | https://dev-web.nepp-chan.ai | nepp-chan-web-dev |
| prd | https://web.nepp-chan.ai | nepp-chan-web-prd |

## 開発コマンド

```bash
pnpm dev               # 開発サーバー（http://localhost:5173）
pnpm build             # ビルド → dist/
pnpm check             # 型チェック（astro check）
pnpm test              # vitest 実行（jsdom + msw）
pnpm test --coverage   # カバレッジ計測（v8 provider）
pnpm deploy            # dev 環境にデプロイ
pnpm deploy:prd        # prd 環境にデプロイ
```

## テスト

- ランナー: vitest（jsdom）+ Testing Library + msw
- 配置: `src/foo.ts` の隣に `src/foo.test.ts` を置く co-located 方式
- 共通ヘルパ: `src/test/`（msw-server / QueryClientProvider 付きの `renderHookWithQuery` / `renderWithQuery` / setup）
- カバレッジ閾値は `vitest.config.ts` で管理。Sentry init / 薄いラッパー / 外部 SDK 連携が深い tsx は除外
- E2E は未導入
