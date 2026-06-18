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
