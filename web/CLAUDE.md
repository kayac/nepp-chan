# CLAUDE.md - web

Cloudflare Pages で動作するフロントエンド。React + Vite + TailwindCSS。

## ファイル探索ガイド

| 探したいもの          | 場所                                   |
| --------------------- | -------------------------------------- |
| チャット画面          | `pages/chat/`                          |
| チャット UI           | `components/assistant-ui/`             |
| ツール表示 UI         | `components/assistant-ui/tool-uis/`    |
| 共通 UI               | `components/ui/`                       |
| ダッシュボード画面    | `pages/dashboard/`                     |
| API クライアント      | `repository/*-repository.ts`           |
| 共通フック            | `hooks/`                               |
| 型定義                | `types/`                               |
| Basic 認証            | `functions/_middleware.ts`             |

## ディレクトリ構成

```text
web/
├── index.html           # チャット画面エントリー（/）
├── dashboard.html       # ダッシュボード画面エントリー（/dashboard）
├── login.html           # ログイン画面エントリー（/login）
├── register.html        # 登録画面エントリー（/register）
├── src/
│   ├── components/
│   │   ├── assistant-ui/      # assistant-ui ベースのチャット UI
│   │   │   ├── Thread.tsx           # メインスレッドコンポーネント
│   │   │   ├── MarkdownText.tsx     # Markdown レンダリング
│   │   │   ├── ToolFallback.tsx     # 汎用ツール実行表示
│   │   │   ├── TooltipIconButton.tsx
│   │   │   └── tool-uis/            # 個別ツール UI
│   │   │       ├── index.tsx        # ToolUIRegistry
│   │   │       ├── ChartToolUI.tsx
│   │   │       ├── DataTableToolUI.tsx
│   │   │       ├── TimelineToolUI.tsx
│   │   │       ├── WeatherToolUI.tsx
│   │   │       ├── GoogleSearchToolUI.tsx
│   │   │       ├── KnowledgeSearchToolUI.tsx
│   │   │       └── ChoiceButtonsToolUI.tsx
│   │   └── ui/                # shadcn/ui ベース共通コンポーネント
│   │       ├── button.tsx
│   │       ├── tooltip.tsx
│   │       └── loading.tsx
│   ├── pages/
│   │   ├── chat/              # チャット画面
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── ChatPage.tsx         # メインページ（スレッド管理）
│   │   │   ├── AssistantProvider.tsx # Runtime Provider
│   │   │   ├── FeedbackContext.tsx   # フィードバック状態管理
│   │   │   └── components/          # レガシー（未使用）
│   │   ├── auth/              # 認証画面（スタンドアロン）
│   │   │   ├── login.tsx            # ログインページ
│   │   │   └── register.tsx         # 登録ページ
│   │   └── dashboard/         # ダッシュボード画面（管理）
│   │       └── ...
│   ├── hooks/                 # 共有フック
│   ├── repository/            # API クライアント（Repository パターン）
│   ├── lib/
│   │   ├── api/client.ts      # 共通 API クライアント
│   │   └── class-merge.ts     # cn ユーティリティ
│   ├── types/                 # 共有型定義
│   └── index.css              # グローバル CSS（CSS 変数定義含む）
├── functions/
│   └── _middleware.ts         # Basic 認証
└── vite.config.ts
```

## 技術スタック

- **React** 19
- **Vite** 7
- **TailwindCSS** 4
- **TanStack Query** 5 - データフェッチング・キャッシング
- **assistant-ui** - チャット UI フレームワーク
  - `@assistant-ui/react` - コアコンポーネント
  - `@assistant-ui/react-ai-sdk` - AI SDK 統合
  - `@assistant-ui/react-markdown` - Markdown サポート
- **Radix UI** - ツールチップ等の基盤

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

| パス         | HTML              | 説明                   |
| ------------ | ----------------- | ---------------------- |
| `/`          | `index.html`      | チャット画面           |
| `/dashboard` | `dashboard.html`  | ダッシュボード（管理） |
| `/login`     | `login.html`      | ログイン画面           |
| `/register`  | `register.html`   | 登録画面               |

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

## 開発コマンド

```bash
pnpm dev               # 開発サーバー（http://localhost:5173）
pnpm build             # ビルド → dist/
pnpm deploy            # dev 環境（nepp-chan-web-dev）にデプロイ
pnpm deploy:production # prd 環境（nepp-chan-web-prd）にデプロイ
```
