import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const displayChartTool = createTool({
  id: "display-chart",
  description: `グラフやチャートを表示するツール。人口推移、統計データ、比較データなどを視覚的に表示したいときに使用する。

使用例:
- 「人口推移をグラフで見せて」→ type: "line", xKey: "年", yKey: "人口", data: [{ 年: "2020", 人口: 1000 }, ...]
- 「年齢別の人口を見せて」→ type: "bar", xKey: "年齢層", yKey: "人数", data: [{ 年齢層: "20代", 人数: 500 }, ...]
- 「産業別の割合を見せて」→ type: "pie", xKey: "産業", yKey: "割合", data: [{ 産業: "農業", 割合: 30 }, ...]

重要: xKeyとyKeyで指定したキー名をdataのオブジェクトで使用すること。ツールチップにyKeyの名前が表示される。`,
  inputSchema: z.object({
    title: z.string().describe("グラフのタイトル"),
    type: z
      .enum(["line", "bar", "pie"])
      .describe("グラフの種類: line=折れ線, bar=棒, pie=円"),
    data: z
      .array(z.record(z.string(), z.union([z.string(), z.number()])))
      .describe(
        "グラフに表示するデータ。xKeyとyKeyで指定したキーを含むオブジェクトの配列",
      ),
    xKey: z
      .string()
      .describe("X軸に使用するキー（例: '年', '月', 'カテゴリ'）"),
    yKey: z
      .string()
      .describe(
        "Y軸に使用するキー。ツールチップに表示される名前になる（例: '人口', '件数', '売上'）",
      ),
  }),
  outputSchema: z.object({
    displayed: z.boolean(),
  }),
  execute: async () => {
    // UI側で表示するため、サーバーでは何もしない
    return { displayed: true };
  },
});
