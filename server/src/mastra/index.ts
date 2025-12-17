import { LibSQLStore } from "@mastra/libsql";
import { createMastra } from "~/mastra/factory";

/**
 * NOTE: mastra playground用のmastraインスタンス
 * アプリケーション側で利用する時は、factory.tsのcreateMastra関数を利用して生成してください。
 *  */

export const mastra = createMastra(
  new LibSQLStore({
    id: "mastra-storage",
    url: ":memory:",
  }),
);
