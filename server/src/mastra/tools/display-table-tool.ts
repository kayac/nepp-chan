import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const displayTableTool = createTool({
  id: "display-table",
  description: `データをテーブル形式で表示するツール。一覧表示、比較データ、詳細情報などを整理して見せたいときに使用する。
使用例:
- 「施設の一覧を見せて」
- 「イベントの詳細を表にして」
- 「比較データをまとめて」`,
  inputSchema: z.object({
    title: z.string().optional().describe("テーブルのタイトル"),
    columns: z
      .array(
        z.object({
          key: z.string().describe("データのキー名"),
          label: z.string().describe("列のヘッダー表示名"),
          sortable: z.boolean().optional().describe("ソート可能かどうか"),
        }),
      )
      .describe("テーブルの列定義"),
    data: z
      .array(z.record(z.string(), z.unknown()))
      .describe("テーブルに表示するデータ（各行のオブジェクト）"),
  }),
  outputSchema: z.object({
    displayed: z.boolean(),
  }),
  execute: async () => {
    return { displayed: true };
  },
});
