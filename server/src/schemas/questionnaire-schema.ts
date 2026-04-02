import { z } from "zod";

export const questionTypeSchema = z.enum([
  "single_choice",
  "multiple_choice",
  "free_text",
  "rating",
]);

export type QuestionType = z.infer<typeof questionTypeSchema>;

export const questionnaireStatusSchema = z.enum([
  "draft",
  "scheduled",
  "sent",
  "closed",
]);

export type QuestionnaireStatus = z.infer<typeof questionnaireStatusSchema>;

// 設問定義（作成/更新用）
export const questionInputSchema = z.object({
  text: z.string().min(1).max(500),
  type: questionTypeSchema,
  required: z.boolean().optional().default(true),
  choices: z.array(z.string().min(1).max(100)).optional(),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

// アンケート作成
export const createQuestionnaireSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isAnonymous: z.boolean().optional().default(true),
  questions: z.array(questionInputSchema).min(1).max(20),
  scheduledAt: z.string().datetime().optional(),
  sendNow: z.boolean().optional(),
});

// アンケート更新
export const updateQuestionnaireSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  isAnonymous: z.boolean().optional(),
  questions: z.array(questionInputSchema).min(1).max(20).optional(),
});

// レスポンス用
export const questionResponseSchema = z.object({
  id: z.string(),
  questionnaireId: z.string(),
  order: z.number(),
  text: z.string(),
  type: questionTypeSchema,
  required: z.boolean(),
  choices: z.array(z.string()).nullable(),
});

export const questionnaireResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isAnonymous: z.boolean(),
  status: questionnaireStatusSchema,
  questions: z.array(questionResponseSchema),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  closedAt: z.string().nullable(),
});

// 集計結果
export const choiceResultSchema = z.object({
  choice: z.string(),
  count: z.number(),
  percentage: z.number(),
});

export const questionResultSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  questionType: questionTypeSchema,
  totalResponses: z.number(),
  choiceResults: z.array(choiceResultSchema).optional(),
  averageRating: z.number().optional(),
  ratingDistribution: z.record(z.string(), z.number()).optional(),
  freeTextAnswers: z.array(z.string()).optional(),
});

export const questionnaireResultsSchema = z.object({
  questionnaireId: z.string(),
  title: z.string(),
  totalSubmissions: z.number(),
  completedSubmissions: z.number(),
  questionResults: z.array(questionResultSchema),
});
