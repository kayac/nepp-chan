import { Hono } from "hono";

/**
 * サブルーターを resolveAuth でラップしてテスト用アプリを作成する。
 * index.ts のグローバルミドルウェア構成を再現する。
 */
// biome-ignore lint/suspicious/noExplicitAny: テスト用ヘルパーのため型制約を緩和
export const withResolveAuth = async (routes: Hono<any, any, any>) => {
  const { resolveAuth } = await import("~/middleware/auth");
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.use("*", resolveAuth);
  app.route("/", routes);
  return app;
};
