import { Hono } from "hono";

/**
 * サブルーターを resolvePrincipal + errorHandler でラップしてテスト用アプリを作成する。
 * index.ts のグローバルミドルウェア構成（principal 解決 + 統一エラー形式）を再現する。
 */
// biome-ignore lint/suspicious/noExplicitAny: テスト用ヘルパーのため型制約を緩和
export const withResolvePrincipal = async (routes: Hono<any, any, any>) => {
  const { resolvePrincipal } = await import("~/middleware/resolve-principal");
  const { errorHandler } = await import("~/middleware/error-handler");
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.use("*", resolvePrincipal);
  app.route("/", routes);
  app.onError(errorHandler);
  return app;
};
