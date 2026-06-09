import { z } from "zod";

export const displayChartSchema = z.object({
  title: z.string().describe("グラフのタイトル"),
  type: z
    .enum(["line", "bar", "pie"])
    .describe("グラフの種類: line=折れ線, bar=棒, pie=円"),
  data: z
    .array(z.record(z.string(), z.union([z.string(), z.number()])))
    .describe(
      "グラフに表示するデータ。xKeyとyKeyで指定したキーを含むオブジェクトの配列",
    ),
  xKey: z.string().describe("X軸に使用するキー（例: '年', '月', 'カテゴリ'）"),
  yKey: z
    .string()
    .describe(
      "Y軸に使用するキー。ツールチップに表示される名前になる（例: '人口', '件数', '売上'）",
    ),
});

export const displayTableSchema = z.object({
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
});

export const displayTimelineSchema = z.object({
  title: z.string().optional().describe("タイムラインのタイトル"),
  events: z
    .array(
      z.object({
        date: z.string().describe("日付（例: 2024年1月, 1月15日, 10:00）"),
        title: z.string().describe("イベントのタイトル"),
        description: z.string().optional().describe("詳細説明"),
        status: z
          .enum(["completed", "current", "upcoming"])
          .optional()
          .describe("状態: completed=完了, current=進行中, upcoming=予定"),
        type: z
          .enum(["event", "milestone", "deadline"])
          .optional()
          .describe(
            "種類: event=イベント, milestone=マイルストーン, deadline=締切",
          ),
      }),
    )
    .describe("タイムラインに表示するイベント"),
});

export type DisplayChartArgs = z.infer<typeof displayChartSchema>;
export type DisplayTableArgs = z.infer<typeof displayTableSchema>;
export type DisplayTimelineArgs = z.infer<typeof displayTimelineSchema>;
