import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import { sessionAuth } from "~/middleware/session-auth";
import { personaRepository } from "~/repository/persona-repository";
import {
  deleteAllPersonas,
  extractAllPendingThreads,
  extractPersonaFromThreadById,
} from "~/services/persona-extractor";

export const personaAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

personaAdminRoutes.use("*", sessionAuth);

const PersonaSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
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
      limit: z.string().optional().default("30"),
      cursor: z.string().optional(),
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
  },
});

personaAdminRoutes.openapi(listRoute, async (c) => {
  const { limit, cursor } = c.req.valid("query");
  const result = await personaRepository.listForAdmin(c.env.DB, {
    limit: Number(limit),
    cursor: cursor ?? undefined,
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
    500: errorResponse(500),
  },
});

personaAdminRoutes.openapi(extractAllRoute, async (c) => {
  try {
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
  } catch (error) {
    console.error("Persona extract error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Persona extraction failed",
    });
  }
});

const extractOneRoute = createRoute({
  method: "post",
  path: "/extract/:threadId",
  summary: "特定スレッドからペルソナを抽出",
  description: "指定したスレッドからペルソナ情報を抽出します",
  tags: ["Admin - Persona"],
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
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

personaAdminRoutes.openapi(extractOneRoute, async (c) => {
  const { threadId } = c.req.valid("param");

  try {
    const { result, message } = await extractPersonaFromThreadById(
      threadId,
      c.env,
    );
    return c.json({ message, result }, 200);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Persona extract error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Persona extraction failed",
    });
  }
});

const deleteAllRoute = createRoute({
  method: "delete",
  path: "/",
  summary: "全ペルソナを削除",
  description: "蓄積された全てのペルソナ情報を削除します",
  tags: ["Admin - Persona"],
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
    500: errorResponse(500),
  },
});

personaAdminRoutes.openapi(deleteAllRoute, async (c) => {
  try {
    const { count } = await deleteAllPersonas(c.env.DB);
    return c.json(
      { message: `${count}件のペルソナを削除しました`, count },
      200,
    );
  } catch (error) {
    console.error("Persona delete error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Persona deletion failed",
    });
  }
});
