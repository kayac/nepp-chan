# CLAUDE.md - web

Cloudflare Pages で動作するフロントエンド。Astro + React（client:only）+ TailwindCSS。
Astro のファイルベースルーティングで MPA 構成、各ページはフル CSR React。

## ファイル探索ガイド

| 探したいもの          | 場所                                   |
| --------------------- | -------------------------------------- |
| ページルーティング    | `pages/*.astro`                        |
| チャット画面          | `app/chat/`                            |
| チャット UI           | `components/assistant-ui/`             |
| ツール表示 UI         | `components/assistant-ui/tool-uis/`    |
| 共通 UI               | `components/ui/`                       |
| 共通レイアウト        | `components/RootLayout.tsx`            |
| ダッシュボード画面    | `app/dashboard/`                       |
| 認証画面              | `app/auth/`                            |
| API クライアント      | `repository/*-repository.ts`           |
| 共通フック            | `hooks/`                               |
| 型定義                | `types/`                               |
| Basic 認証            | `functions/_middleware.ts`             |

## ディレクトリ構成

```text
web/
├── astro.config.ts      # Astro 設定（Vite プラグイン含む）
├── src/
│   ├── pages/                 # Astro ファイルベースルーティング
│   │   ├── index.astro        # / → チャット画面
│   │   ├── dashboard.astro    # /dashboard → ダッシュボード
│   │   ├── login.astro        # /login → ログイン
│   │   └── register.astro     # /register → 登録
│   ├── app/                   # React ページコンポーネント
│   │   ├── chat/              # チャット画面
│   │   │   ├── App.tsx              # エントリー（RootLayout + QueryProvider）
│   │   │   ├── ChatPage.tsx         # メインページ（スレッド管理）
│   │   │   ├── AssistantProvider.tsx # Runtime Provider
│   │   │   └── FeedbackContext.tsx   # フィードバック状態管理
│   │   ├── auth/              # 認証画面
│   │   │   ├── LoginPage.tsx        # ログインページ
│   │   │   └── RegisterPage.tsx     # 登録ページ
│   │   └── dashboard/         # ダッシュボード画面
│   │       ├── DashboardPage.tsx    # エントリー（RootLayout + Providers）
│   │       ├── App.tsx              # ダッシュボード本体（認証ガード含む）
│   │       ├── contexts/            # AuthContext
│   │       └── components/          # パネル群
│   ├── components/
│   │   ├── RootLayout.tsx     # 共通レイアウト（StrictMode + Sentry）
│   │   ├── assistant-ui/      # assistant-ui ベースのチャット UI
│   │   │   ├── Thread.tsx
│   │   │   ├── MarkdownText.tsx
│   │   │   ├── ToolFallback.tsx
│   │   │   └── tool-uis/
│   │   └── ui/                # shadcn/ui ベース共通コンポーネント
│   ├── hooks/                 # 共有フック
│   ├── repository/            # API クライアント（Repository パターン）
│   ├── lib/
│   │   ├── api/client.ts      # 共通 API クライアント
│   │   ├── auth-token.ts      # 管理者トークン（localStorage）
│   │   ├── session-token.ts   # セッショントークン（localStorage）
│   │   ├── resource.ts        # resourceId 生成・取得
│   │   ├── sentry.ts          # Sentry 初期化
│   │   └── class-merge.ts     # cn ユーティリティ
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
- **assistant-ui** - チャット UI フレームワーク
  - `@assistant-ui/react` - コアコンポーネント
  - `@assistant-ui/react-ai-sdk` - AI SDK 統合
  - `@assistant-ui/react-markdown` - Markdown サポート
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

### assistant-ui 統合

```text
ChatPage
  └── AssistantProvider (Runtime)
      └── Thread
          ├── ThreadWelcome (空の時)
          ├── Messages
          │   ├── UserMessage
          │   └── AssistantMessage
          │       ├── MarkdownText
          │       └── ToolUI (各種ツール表示)
          └── Composer (入力欄)
```

### ツール UI 実装

```typescript
// makeAssistantToolUI で定義
export const WeatherToolUI = makeAssistantToolUI<Args, Result>({
  toolName: "get-weather",
  render: ({ args, result, status }) => {
    if (status.type === "running") return <LoadingState />;
    if (!result) return null;
    return <WeatherCard result={result} />;
  },
});

// index.tsx で登録
export const toolsByName = {
  "get-weather": WeatherToolUI,
  // ...
};
```

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
pnpm deploy            # dev 環境にデプロイ
pnpm deploy:prd        # prd 環境にデプロイ
```
