# @nepp-chan/web

ねっぷちゃんチャットシステムのフロントエンド。Astro + React で構築し、Cloudflare Pages 上で動作。

## 技術スタック

- Astro 6
- React 19（client:only で CSR）
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

| 環境 | URL |
| ---- | --- |
| ローカル | http://localhost:5173 |
| dev | https://dev-web.nepp-chan.ai |
| prd | https://web.nepp-chan.ai |

```bash
pnpm deploy           # dev 環境へデプロイ
pnpm deploy:prd       # prd 環境へデプロイ
```

## 環境変数

接続先は `PUBLIC_ENV` で選択し、URL は `shared/src/constants/environments.ts` に定義。未指定なら `local` になるため、ローカル開発に設定は不要。詳細はルートの [README.md](../README.md) を参照。

## Basic 認証

`functions/_middleware.ts` で Cloudflare Pages Functions を使った Basic 認証を実装しています。

認証情報は Cloudflare Pages の環境変数で設定：

- `BASIC_AUTH_USER`: ユーザー名
- `BASIC_AUTH_PASSWORD`: パスワード
