import { z } from "@hono/zod-openapi";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("JST の日付（YYYY-MM-DD）");

export const personaAnalyticsQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional().describe("JST の日付（YYYY-MM-DD、この日を含む）"),
});

export const conversationAnalyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(30)
    .default(30)
    .describe("集計対象の直近日数（raw 会話の保持期間 30 日が上限）"),
});

export const usageAnalyticsQuerySchema = z.object({
  weeks: z.coerce
    .number()
    .int()
    .min(1)
    .max(26)
    .default(12)
    .describe("集計対象の直近週数"),
});

export const weeklyReportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(52).default(12),
});

const sentimentCountsShape = {
  positive: z.number(),
  negative: z.number(),
  request: z.number(),
  neutral: z.number(),
};

const hourlyCountSchema = z.object({ hour: z.number(), count: z.number() });
// dow は JST の曜日（0=日曜 〜 6=土曜）
const weekdayCountSchema = z.object({ dow: z.number(), count: z.number() });

export const personaAnalyticsResponseSchema = z.object({
  totalCount: z.number(),
  // 1会話から複数件抽出されるため件数は会話数とは一致しない近似値
  hourly: z.array(hourlyCountSchema),
  weekday: z.array(weekdayCountSchema),
  officeHours: z.object({ open: z.number(), closed: z.number() }),
  ageSentiment: z.array(z.object({ age: z.string(), ...sentimentCountsShape })),
  topics: z.array(
    z.object({ topic: z.string(), total: z.number(), ...sentimentCountsShape }),
  ),
  segments: z.object({
    residence: z.array(z.object({ label: z.string(), count: z.number() })),
    relationship: z.array(z.object({ label: z.string(), count: z.number() })),
  }),
});
const ontologyRoleSchema = z.enum([
  "接続点",
  "争点",
  "不満点",
  "満足点",
  "関心点",
  "セグメント",
]);

const ontologyNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["segment", "topic", "entity"]),
  type: z.string().optional(),
  topic: z.string().optional(),
  count: z.number(),
  role: ontologyRoleSchema,
  roles: z.array(ontologyRoleSchema),
  bySegment: z.record(z.string(), z.number()).optional(),
  bySentiment: z.record(z.string(), z.number()).optional(),
});

const ontologyLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  n: z.number(),
  kind: z.enum(["seg-topic", "topic-ent", "seg-ent"]),
});

export const ontologyResponseSchema = z.object({
  nodes: z.array(ontologyNodeSchema),
  links: z.array(ontologyLinkSchema),
  meta: z.object({
    personaTotal: z.number(),
    generatedAt: z.string(),
    entityLayerStatus: z.enum(["none", "ready", "stale"]),
    note: z.string(),
  }),
});

const platformCountSchema = z.object({
  platform: z.string(),
  count: z.number(),
});

export const conversationAnalyticsResponseSchema = z.object({
  daily: z.array(
    z.object({
      date: z.string(),
      conversations: z.number(),
      messages: z.number(),
    }),
  ),
  hourly: z.array(hourlyCountSchema),
  weekday: z.array(weekdayCountSchema),
  platforms: z.array(platformCountSchema),
  totals: z.object({ conversations: z.number(), messages: z.number() }),
});

const modelUsageShape = {
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  reasoningTokens: z.number(),
  cachedInputTokens: z.number(),
  totalTokens: z.number(),
  costUsd: z.number(),
};

export const usageAnalyticsResponseSchema = z.object({
  weekly: z.array(z.object({ weekStart: z.string(), ...modelUsageShape })),
});

// 週次レポートの stats(JSON) の中身。生成側（weekly-report service）と共有する
export const weeklyStatsSchema = z.object({
  conversationCount: z.number(),
  messageCount: z.number(),
  hourly: z.array(hourlyCountSchema),
  platforms: z.array(platformCountSchema),
  usageByModel: z.array(z.object(modelUsageShape)),
});

export type WeeklyStats = z.infer<typeof weeklyStatsSchema>;

const weeklyReportListItemSchema = z.object({
  id: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  summary: z.string(),
  createdAt: z.string(),
});

export const weeklyReportsResponseSchema = z.object({
  reports: z.array(weeklyReportListItemSchema),
});

export const weeklyReportDetailResponseSchema = z.object({
  report: weeklyReportListItemSchema.extend({ stats: weeklyStatsSchema }),
});
