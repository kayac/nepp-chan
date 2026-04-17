import { z } from "zod";

export const pollStatusSchema = z.enum([
  "draft",
  "scheduled",
  "sent",
  "closed",
]);

export type PollStatus = z.infer<typeof pollStatusSchema>;

// 投票作成
export const createPollSchema = z.object({
  title: z.string().min(1).max(200),
  choices: z.array(z.string().min(1).max(100)).min(2).max(10),
  followUpPrompt: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
  sendNow: z.boolean().optional(),
});

// 投票更新
export const updatePollSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  choices: z.array(z.string().min(1).max(100)).min(2).max(10).optional(),
  followUpPrompt: z.string().max(500).nullable().optional(),
});

// レスポンス用
export const pollResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  choices: z.array(z.string()),
  followUpPrompt: z.string().nullable(),
  status: pollStatusSchema,
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  closedAt: z.string().nullable(),
});

// 集計結果
export const pollChoiceResultSchema = z.object({
  choice: z.string(),
  count: z.number(),
  percentage: z.number(),
});

export const pollResultsSchema = z.object({
  pollId: z.string(),
  title: z.string(),
  totalSubmissions: z.number(),
  choiceResults: z.array(pollChoiceResultSchema),
});
