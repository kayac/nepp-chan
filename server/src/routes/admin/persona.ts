import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { DAY_MS, jstDateToUtc } from "~/lib/date";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import { personaRepository } from "~/repository/persona-repository";
import {
  extractAllPendingThreads,
  extractPersonaFromThreadById,
} from "~/services/persona-extractor";

export const personaAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

personaAdminRoutes.use("*", requireRole("staff"));

const jstDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("JST の日付（YYYY-MM-DD）");

const filterQuerySchema = z.object({
  from: jstDateSchema.optional(),
  to: jstDateSchema
    .optional()
    .describe("JST の日付（YYYY-MM-DD、この日を含む）"),
  sentiments: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined))
    .pipe(
      z
        .array(z.enum(["positive", "negative", "request", "neutral"]))
        .optional(),
    ),
  topic: z.string().optional(),
});

// from/to は JST 日付。to はその日を含むため翌日 0:00 JST 未満に広げる
const toPeriod = (from?: string, to?: string) => ({
  from: from ? jstDateToUtc(from).toISOString() : undefined,
  to: to
    ? new Date(jstDateToUtc(to).getTime() + DAY_MS).toISOString()
    : undefined,
});

const PersonaSchema = z.object({
  id: z.string(),
  category: z.string(),
  tags: z.string().nullable(),
  content: z.string(),
  source: z.string().nullable(),
  topic: z.string().nullable(),
  sentiment: z.string().nullable(),
  demographicSummary: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  conversationEndedAt: z.string().nullable(),
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "ペルソナ一覧を取得",
  description: "村の集合知として蓄積されたペルソナ情報の一覧を取得します",
  tags: ["Admin - Persona"],
  request: {
    query: z
      .object({
        limit: z.coerce.number().int().min(1).max(100).optional().default(30),
        cursor: z.string().optional(),
      })
      .merge(filterQuerySchema),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({
            personas: z.array(PersonaSchema),
            total: z.number(),
            nextCursor: z.string().nullable(),
            hasMore: z.boolean(),
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

personaAdminRoutes.openapi(listRoute, async (c) => {
  const { limit, cursor, from, to, sentiments, topic } = c.req.valid("query");
  const result = await personaRepository.listForAdmin(c.env.DB, {
    limit,
    cursor: cursor ?? undefined,
    ...toPeriod(from, to),
    sentiments,
    topic,
  });
  return c.json(result, 200);
});

const TopicBreakdownSchema = z.object({
  topic: z.string(),
  total: z.number(),
  sentiments: z.object({
    positive: z.number(),
    negative: z.number(),
    request: z.number(),
    neutral: z.number(),
  }),
  sample: z.string().nullable(),
  topTags: z.array(z.object({ tag: z.string(), count: z.number() })),
});

const topicsRoute = createRoute({
  method: "get",
  path: "/topics",
  summary: "話題ごとの件数・感情内訳・代表的な声",
  description:
    "絞り込み条件に該当する声を話題ごとに集計します。件数降順で返します",
  tags: ["Admin - Persona"],
  request: { query: filterQuerySchema },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({ topics: z.array(TopicBreakdownSchema) }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
  },
});

personaAdminRoutes.openapi(topicsRoute, async (c) => {
  const { from, to, sentiments, topic } = c.req.valid("query");
  const topics = await personaRepository.topicBreakdown(c.env.DB, {
    ...toPeriod(from, to),
    sentiments,
    topic,
  });
  return c.json({ topics }, 200);
});

const ExtractResultSchema = z.object({
  threadId: z.string(),
  result: z.union([
    z.object({
      skipped: z.literal(true),
      reason: z.string(),
      messageCount: z.number().optional(),
    }),
    z.object({ extracted: z.literal(true), messageCount: z.number() }),
  ]),
});

const extractAllRoute = createRoute({
  method: "post",
  path: "/extract",
  summary: "全スレッドからペルソナを抽出",
  description:
    "未処理または新しいメッセージがあるスレッドからペルソナ情報を抽出します",
  tags: ["Admin - Persona"],
  middleware: [requireRole("admin")] as const,
  responses: {
    200: {
      description: "抽出完了",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            results: z.array(ExtractResultSchema),
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    500: errorResponse(500),
  },
});

personaAdminRoutes.openapi(extractAllRoute, async (c) => {
  const results = await extractAllPendingThreads(c.env);

  const extracted = results.filter(
    (r) => "extracted" in r.result && r.result.extracted,
  ).length;
  const skipped = results.filter(
    (r) => "skipped" in r.result && r.result.skipped,
  ).length;

  return c.json(
    {
      message: `${extracted}件のスレッドからペルソナを抽出しました、${skipped}件スキップ`,
      results,
    },
    200,
  );
});

const extractOneRoute = createRoute({
  method: "post",
  path: "/extract/{threadId}",
  summary: "特定スレッドからペルソナを抽出",
  description: "指定したスレッドからペルソナ情報を抽出します",
  tags: ["Admin - Persona"],
  middleware: [requireRole("admin")] as const,
  request: {
    params: z.object({
      threadId: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "抽出完了",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            result: ExtractResultSchema.shape.result,
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

personaAdminRoutes.openapi(extractOneRoute, async (c) => {
  const { threadId } = c.req.valid("param");

  const { result, message } = await extractPersonaFromThreadById(
    threadId,
    c.env,
  );
  return c.json({ message, result }, 200);
});
