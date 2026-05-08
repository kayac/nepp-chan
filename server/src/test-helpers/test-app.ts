import { Hono } from "hono";

/**
 * サブルーターを resolvePrincipal でラップしてテスト用アプリを作成する。
 * index.ts のグローバルミドルウェア構成を再現する。
 */
// biome-ignore lint/suspicious/noExplicitAny: テスト用ヘルパーのため型制約を緩和
export const withResolvePrincipal = async (routes: Hono<any, any, any>) => {
  const { resolvePrincipal } = await import("~/middleware/resolve-principal");
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.use("*", resolvePrincipal);
  app.route("/", routes);
  return app;
};
