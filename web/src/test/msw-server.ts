import { setupServer } from "msw/node";

/**
 * 各テストの先頭で server.use(...) でハンドラを上書きして、
 * そのテスト固有のレスポンスを設定する。
 */
export const server = setupServer();
