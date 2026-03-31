import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const displayTimelineTool = createTool({
  id: "display-timeline",
  description: `出来事を時系列で表示するツール。
日付付きのイベントや報告が複数ある場合、テキストで列挙するよりこのツールを使う。

## 使用判断の基準
- 日付付きの出来事が3件以上 → タイムラインを使う
- 日付なし or 2件以下 → テキストで十分

## 入力形式
- title: タイムラインのタイトル（省略可）
- events: イベント配列。各要素:
  - date: 日付文字列（必須。例: "3/14", "2024年1月", "ステップ1"）
  - title: イベントのタイトル（必須）
  - description: 詳細説明（省略可）
  - status: "completed" | "current" | "upcoming"（省略可）
  - type: "event" | "milestone" | "deadline"（省略可）

## 入力例
title: "住民の声の推移"
events: [
  { "date": "3/14", "title": "バス運行への不満", "description": "朝のバスが1本しかない", "status": "completed" },
  { "date": "3/22", "title": "クマ目撃報告", "status": "completed" }
]

## よくある間違い
- events が空配列 → 呼ばない
- date を省略 → 必須フィールド`,
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
