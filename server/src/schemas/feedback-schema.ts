import { z } from "zod";

/** ツール用: 軽量版（conversationContext/toolExecutions を含まない） */
export const feedbackBaseSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  rating: z.string(),
  category: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});

/** ルート用: 全フィールド版 */
export const feedbackFullSchema = feedbackBaseSchema.extend({
  conversationContext: z.string(),
  toolExecutions: z.string().nullable(),
});

/** 統計情報 */
export const feedbackStatsSchema = z.object({
  total: z.number(),
  good: z.number(),
  bad: z.number(),
  idea: z.number(),
  byCategory: z.record(z.string(), z.number()),
});
