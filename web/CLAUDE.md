# CLAUDE.md - web

Cloudflare Pages で動作するフロントエンド。React + Vite + TailwindCSS。

## ディレクトリ構成

```text
web/
├── index.html           # チャット画面エントリー（/）
├── dashboard.html       # ダッシュボード画面エントリー（/dashboard）
├── src/
│   ├── pages/
│   │   ├── chat/        # チャット画面
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── components/
│   │   │       ├── ChatContainer.tsx
│   │   │       ├── ChatInput.tsx
│   │   │       ├── MessageList.tsx
│   │   │       ├── MessageItem.tsx
│   │   │       ├── FeedbackButton.tsx
│   │   │       └── FeedbackModal.tsx
│   │   └── dashboard/   # ダッシュボード画面（管理）
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── components/
│   │           ├── KnowledgePanel.tsx
│   │           ├── PersonaPanel.tsx
│   │           ├── EmergencyPanel.tsx
│   │           ├── FeedbackPanel.tsx
│   │           └── knowledge/    # ナレッジ関連コンポーネント
│   ├── hooks/           # 共有フック
│   ├── repository/      # API クライアント（Repository パターン）
│   │   ├── thread-repository.ts
│   │   ├── knowledge-repository.ts
│   │   ├── persona-repository.ts
│   │   ├── emergency-repository.ts
│   │   └── feedback-repository.ts
│   ├── lib/
│   │   └── api/
│   │       └── client.ts  # 共通 API クライアント
│   ├── types/           # 共有型定義
│   ├── providers/       # React Providers
│   └── index.css        # グローバル CSS
├── functions/
│   └── _middleware.ts   # Basic 認証（Cloudflare Pages Functions）
├── wrangler.jsonc
└── vite.config.ts
```

## 技術スタック

- **React** 19
- **Vite** 7
- **TailwindCSS** 4
- **TanStack Query** 5 - データフェッチング・キャッシング
- **AI SDK React** (@ai-sdk/react) - ストリーミングチャット

## MPA 構成

マルチページアプリケーション（MPA）構成を採用。

| パス         | HTML              | 説明                   |
| ------------ | ----------------- | ---------------------- |
| `/`          | `index.html`      | チャット画面           |
| `/dashboard` | `dashboard.html`  | ダッシュボード（管理） |

## コーディング規約

### コンポーネント

```typescript
// 関数コンポーネントとフックを使用
// Props は interface または type で定義（xxProps ではなく Props で統一）
interface Props {
  message: string;
  onSubmit: () => void;
}

export const MessageItem = ({ message, onSubmit }: Props) => {
  // JSX 内のロジックは複雑にせず、必要なら関数に切り出し
  return <div>...</div>;
};
```

### Repository パターン

API クライアントは Repository パターンで実装。

```typescript
// repository/thread-repository.ts
export const threadRepository = {
  getAll: async () => { ... },
  getById: async (id: string) => { ... },
  create: async (data: CreateThreadInput) => { ... },
};
```

### TailwindCSS 4

Tailwind CSS 4 の短縮記法を使用。

```tsx
// Good
<div className="h-10 w-full p-4 m-2" />

// Avoid
<div className="height-10 width-full padding-4 margin-2" />
```

### テキスト折り返し

長いテキストの折り返しには `wrap-break-word` を使用。

```tsx
<p className="wrap-break-word">長いテキスト...</p>
```

## API クライアント

### 共通クライアント

```typescript
// lib/api/client.ts
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

export const apiClient = {
  get: async <T>(path: string): Promise<T> => { ... },
  post: async <T>(path: string, body: unknown): Promise<T> => { ... },
  // ...
};
```

### 環境変数

| 変数名         | 説明            |
| -------------- | --------------- |
| `VITE_API_URL` | API サーバー URL |

## Basic 認証

`functions/_middleware.ts` で Cloudflare Pages Functions を使った Basic 認証を実装。

環境変数（Cloudflare Pages で設定）:

| 変数名                | 説明               |
| --------------------- | ------------------ |
| `BASIC_AUTH_USER`     | Basic 認証ユーザー名 |
| `BASIC_AUTH_PASSWORD` | Basic 認証パスワード |

## 開発コマンド

```bash
pnpm dev      # 開発サーバー（http://localhost:5173）
pnpm build    # ビルド → dist/
pnpm deploy   # Cloudflare Pages にデプロイ
```
