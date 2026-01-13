import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const displayChartTool = createTool({
  id: "display-chart",
  description: `グラフやチャートを表示するツール。人口推移、統計データ、比較データなどを視覚的に表示したいときに使用する。
使用例:
- 「人口推移をグラフで見せて」→ type: "line"
- 「年齢別の人口を見せて」→ type: "bar"
- 「産業別の割合を見せて」→ type: "pie"`,
  inputSchema: z.object({
    title: z.string().describe("グラフのタイトル"),
    type: z
      .enum(["line", "bar", "pie"])
      .describe("グラフの種類: line=折れ線, bar=棒, pie=円"),
    data: z
      .array(
        z.object({
          name: z.string().describe("項目名（X軸のラベルや凡例）"),
          value: z.number().describe("数値（Y軸の値）"),
        }),
      )
      .describe("グラフに表示するデータ"),
    xKey: z
      .string()
      .optional()
      .describe("X軸に使用するキー（デフォルト: name）"),
    yKey: z
      .string()
      .optional()
      .describe("Y軸に使用するキー（デフォルト: value）"),
  }),
  outputSchema: z.object({
    displayed: z.boolean(),
  }),
  execute: async () => {
    // UI側で表示するため、サーバーでは何もしない
    return { displayed: true };
  },
});
