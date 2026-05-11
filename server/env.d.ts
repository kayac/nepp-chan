/**
 * Workers シークレット（wrangler secret put で設定する変数）の型定義。
 * worker-configuration.d.ts は wrangler types で上書きされるため、
 * シークレットはこのファイルで宣言する。
 */
interface CloudflareBindings {
  JWT_SECRET: string;
}
