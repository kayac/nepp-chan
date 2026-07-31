import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { DAY_MS, jstDateToUtc } from "~/lib/date";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import { requireRole } from "~/middleware/require-role";
import { personaRepository } from "~/repository/persona-repository";
import { RELATIONSHIPS } from "~/schemas/analytics-schema";
import {
  deleteAllPersonas,
  extractAllPendingThreads,
  extractPersonaFromThreadById,
} from "~/services/persona-extractor";

export const personaAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
}>();

personaAdminRoutes.use("*", requireRole("staff"));

const commaSeparated = <T extends z.ZodType<string, string>>(item: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined))
    .pipe(z.array(item).optional());

const jstDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("JST の日付（YYYY-MM-DD）");

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
    query: z.object({
      limit: z.coerce.number().int().min(1).optional().default(30),
      cursor: z.string().optional(),
      from: jstDateSchema.optional(),
      to: jstDateSchema
        .optional()
        .describe("JST の日付（YYYY-MM-DD、この日を含む）"),
      sentiments: commaSeparated(
        z.enum(["positive", "negative", "request", "neutral"]),
      ),
      relationships: commaSeparated(z.enum(RELATIONSHIPS)),
      topic: z.string().optional(),
    }),
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
  const { limit, cursor, from, to, sentiments, relationships, topic } =
    c.req.valid("query");
  const result = await personaRepository.listForAdmin(c.env.DB, {
    limit,
    cursor: cursor ?? undefined,
    from: from ? jstDateToUtc(from).toISOString() : undefined,
    // to はその日を含むため翌日 0:00 JST 未満
    to: to
      ? new Date(jstDateToUtc(to).getTime() + DAY_MS).toISOString()
      : undefined,
    sentiments,
    relationships,
    topic,
  });
  return c.json(result, 200);
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

const deleteAllRoute = createRoute({
  method: "delete",
  path: "/",
  summary: "全ペルソナを削除",
  description: "蓄積された全てのペルソナ情報を削除します",
  tags: ["Admin - Persona"],
  middleware: [requireRole("admin")] as const,
  responses: {
    200: {
      description: "削除成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            count: z.number(),
          }),
        },
      },
    },
    401: errorResponse(401),
    403: errorResponse(403),
    500: errorResponse(500),
  },
});

personaAdminRoutes.openapi(deleteAllRoute, async (c) => {
  const { count } = await deleteAllPersonas(c.env.DB);
  return c.json({ message: `${count}件のペルソナを削除しました`, count }, 200);
});
