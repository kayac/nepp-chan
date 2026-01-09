import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { createDb, mastraThreads, persona, threadPersonaStatus } from "~/db";
import { adminAuth } from "~/middleware/admin-auth";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";
import {
  extractAllPendingThreads,
  extractPersonaFromThread,
} from "~/services/persona-extractor";

export const personaAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

personaAdminRoutes.use("*", adminAuth);

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
    401: {
      description: "認証エラー",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

personaAdminRoutes.openapi(listRoute, async (c) => {
  const { limit, cursor } = c.req.valid("query");
  const db = createDb(c.env.DB);
  const limitNum = Number(limit);

  let cursorCondition: SQL | undefined;

  if (cursor) {
    const [cursorCreatedAt, cursorId] = cursor.split("_");
    cursorCondition = or(
      lt(persona.createdAt, cursorCreatedAt),
      and(eq(persona.createdAt, cursorCreatedAt), lt(persona.id, cursorId)),
    );
  }

  const results = await db
    .select()
    .from(persona)
    .where(cursorCondition)
    .orderBy(desc(persona.createdAt), desc(persona.id))
    .limit(limitNum + 1)
    .all();

  const hasMore = results.length > limitNum;
  const personas = hasMore ? results.slice(0, limitNum) : results;

  const lastPersona = personas[personas.length - 1];
  const nextCursor =
    hasMore && lastPersona
      ? `${lastPersona.createdAt}_${lastPersona.id}`
      : null;

  const countResult = await db.select({ count: count() }).from(persona).get();

  return c.json(
    {
      personas,
      total: countResult?.count ?? 0,
      nextCursor,
      hasMore,
    },
    200,
  );
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
            success: z.boolean(),
            message: z.string(),
            results: z.array(ExtractResultSchema),
          }),
        },
      },
    },
    401: {
      description: "認証エラー",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
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

    return c.json({
      success: true,
      message: `${extracted}件のスレッドからペルソナを抽出しました、${skipped}件スキップ`,
      results,
    });
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
            success: z.boolean(),
            message: z.string(),
            result: ExtractResultSchema.shape.result,
          }),
        },
      },
    },
    401: {
      description: "認証エラー",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: "スレッドが見つからない",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

personaAdminRoutes.openapi(extractOneRoute, async (c) => {
  const { threadId } = c.req.valid("param");
  const db = createDb(c.env.DB);

  try {
    const thread = await db
      .select({ resourceId: mastraThreads.resourceId })
      .from(mastraThreads)
      .where(eq(mastraThreads.id, threadId))
      .get();

    if (!thread || !thread.resourceId) {
      return c.json(
        { success: false, message: "スレッドが見つかりません" },
        404,
      );
    }

    const status = await threadPersonaStatusRepository.findByThreadId(
      c.env.DB,
      threadId,
    );
    const lastMessageCount = status?.lastMessageCount ?? 0;

    const result = await extractPersonaFromThread(
      threadId,
      thread.resourceId,
      lastMessageCount,
      c.env,
    );

    if ("extracted" in result && result.extracted) {
      await threadPersonaStatusRepository.upsert(c.env.DB, {
        threadId,
        lastExtractedAt: new Date().toISOString(),
        lastMessageCount: result.messageCount,
      });
    }

    const message =
      "extracted" in result
        ? `スレッド ${threadId} からペルソナを抽出しました`
        : `スレッド ${threadId} はスキップされました: ${result.reason}`;

    return c.json({
      success: true,
      message,
      result,
    });
  } catch (error) {
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
            success: z.boolean(),
            message: z.string(),
            count: z.number(),
          }),
        },
      },
    },
    401: {
      description: "認証エラー",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

personaAdminRoutes.openapi(deleteAllRoute, async (c) => {
  const db = createDb(c.env.DB);

  try {
    const countResult = await db.select({ count: count() }).from(persona).get();
    const totalCount = countResult?.count ?? 0;

    await db.delete(persona);
    await db.delete(threadPersonaStatus);

    return c.json({
      success: true,
      message: `${totalCount}件のペルソナを削除しました`,
      count: totalCount,
    });
  } catch (error) {
    console.error("Persona delete error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Persona deletion failed",
    });
  }
});
