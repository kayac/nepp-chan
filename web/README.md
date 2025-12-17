# @aiss-nepch/web

ねっぷちゃんチャットシステムのフロントエンド。React + Vite で構築し、Cloudflare Pages 上で動作。

## 技術スタック

- React 19
- Vite 7
- TailwindCSS 4
- AI SDK React (@ai-sdk/react)
- TypeScript

## セットアップ

```bash
pnpm install
```

## 開発

```bash
pnpm dev
```

開発サーバーが `http://localhost:5173` で起動します。

## ビルド

```bash
pnpm build
```

ビルド成果物は `dist/` に出力されます。

## デプロイ

```bash
pnpm deploy
```

Cloudflare Pages にデプロイします。

## 環境変数

`.env.production` で本番環境の API URL を設定：

```env
VITE_API_URL=https://your-api.workers.dev
```

## Basic 認証

`functions/_middleware.ts` で Cloudflare Pages Functions を使った Basic 認証を実装しています。

認証情報は Cloudflare Pages の環境変数で設定：

- `BASIC_AUTH_USER`: ユーザー名
- `BASIC_AUTH_PASSWORD`: パスワード
