import { z } from "zod";

export const conversationContextMessageSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string(),
});

export const conversationContextSchema = z.object({
  targetMessage: conversationContextMessageSchema,
  previousMessages: z.array(conversationContextMessageSchema),
  nextMessages: z.array(conversationContextMessageSchema),
});

export const toolExecutionSchema = z.object({
  toolName: z.string(),
  state: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
});

/** ツールの outputSchema 用。会話コンテキストを含まない軽量版 */
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

/** API レスポンス用。会話コンテキスト・ツール実行履歴を含む */
export const feedbackFullSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  rating: z.enum(["good", "bad", "idea"]),
  category: z
    .enum([
      "incorrect_fact",
      "outdated_info",
      "nonexistent_info",
      "off_topic",
      "other",
    ])
    .nullable(),
  comment: z.string().nullable(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  conversationContext: conversationContextSchema,
  toolExecutions: z.array(toolExecutionSchema).nullable(),
});

/** 統計情報 */
export const feedbackStatsSchema = z.object({
  total: z.number(),
  good: z.number(),
  bad: z.number(),
  idea: z.number(),
  byCategory: z.record(z.string(), z.number()),
});
