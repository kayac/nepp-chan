import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { feedbackRepository } from "~/repository/feedback-repository";
import { requireAdmin } from "./helpers";

const feedbackSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  rating: z.string(),
  category: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});

const statsSchema = z.object({
  total: z.number(),
  good: z.number(),
  bad: z.number(),
  idea: z.number(),
  byCategory: z.record(z.string(), z.number()),
});

export const adminFeedbackTool = createTool({
  id: "admin-feedback",
  description:
    "【管理者専用】フィードバック一覧と統計を取得します。管理者としてログインしている場合のみ使用可能です。",
  inputSchema: z.object({
    rating: z
      .enum(["good", "bad", "idea"])
      .optional()
      .describe("評価でフィルター（省略時は全て取得）"),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .default(30)
      .describe("取得する最大件数。デフォルトは30件、最大100件"),
    includeStats: z
      .boolean()
      .default(true)
      .describe("統計情報を含めるかどうか"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    feedbacks: z.array(feedbackSchema),
    stats: statsSchema.optional(),
    count: z.number(),
    message: z.string(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const result = requireAdmin(context);
    if ("error" in result) {
      return {
        success: false,
        feedbacks: [],
        count: 0,
        message: result.error.message,
        error: result.error.error,
      };
    }
    const { db } = result;

    const { rating, limit, includeStats } = inputData;

    try {
      const result = await feedbackRepository.list(db, { rating, limit });

      const feedbacks = result.feedbacks.map((f) => ({
        id: f.id,
        threadId: f.threadId,
        messageId: f.messageId,
        rating: f.rating,
        category: f.category,
        comment: f.comment,
        createdAt: f.createdAt,
        resolvedAt: f.resolvedAt,
      }));

      let stats:
        | Awaited<ReturnType<typeof feedbackRepository.getStats>>
        | undefined;
      if (includeStats) {
        stats = await feedbackRepository.getStats(db);
      }

      const ratingLabel = rating ? `（${rating}のみ）` : "";
      const satisfactionRate = stats
        ? Math.round((stats.good / (stats.good + stats.bad || 1)) * 100)
        : null;

      let message = `【管理者】フィードバック${ratingLabel}を${feedbacks.length}件取得しました`;
      if (stats) {
        message += `。総数: ${stats.total}件、満足率: ${satisfactionRate}%`;
      }

      return {
        success: true,
        feedbacks,
        stats,
        count: feedbacks.length,
        message,
      };
    } catch (error) {
      console.error("Admin feedback fetch failed:", error);
      return {
        success: false,
        feedbacks: [],
        count: 0,
        message: "フィードバックの取得に失敗しました",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
