import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const displayTimelineTool = createTool({
  id: "display-timeline",
  description: `イベントや予定をタイムライン形式で表示するツール。時系列データ、スケジュール、歴史的な出来事などを見せたいときに使用する。
使用例:
- 「今後のイベント予定を見せて」
- 「村の歴史を年表で」
- 「手続きの流れを見せて」`,
  inputSchema: z.object({
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
  }),
  outputSchema: z.object({
    displayed: z.boolean(),
  }),
  execute: async () => {
    return { displayed: true };
  },
});
