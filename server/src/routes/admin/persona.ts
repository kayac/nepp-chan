import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { threadPersonaStatusRepository } from "~/repository/thread-persona-status-repository";
import {
  extractAllPendingThreads,
  extractPersonaFromThread,
} from "~/services/persona-extractor";

type AdminBindings = CloudflareBindings & {
  ADMIN_KEY?: string;
};

export const personaAdminRoutes = new OpenAPIHono<{
  Bindings: AdminBindings;
}>();

personaAdminRoutes.use("*", async (c, next) => {
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = c.env.ADMIN_KEY;

  if (!expectedKey) {
    throw new HTTPException(500, { message: "ADMIN_KEY is not configured" });
  }

  if (adminKey !== expectedKey) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  await next();
});

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

type Persona = z.infer<typeof PersonaSchema>;

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
  const db = c.env.DB;
  const limitNum = Number(limit);

  let cursorCondition = "";
  const bindings: (string | number)[] = [];

  if (cursor) {
    const [cursorCreatedAt, cursorId] = cursor.split("_");
    cursorCondition = "WHERE (created_at < ? OR (created_at = ? AND id < ?))";
    bindings.push(cursorCreatedAt, cursorCreatedAt, cursorId);
  }

  const result = await db
    .prepare(
      `SELECT id, resource_id as resourceId, category, tags, content, source,
              topic, sentiment, demographic_summary as demographicSummary,
              created_at as createdAt, updated_at as updatedAt,
              conversation_ended_at as conversationEndedAt
       FROM persona ${cursorCondition} ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .bind(...bindings, limitNum + 1)
    .all<Persona>();

  const hasMore = result.results.length > limitNum;
  const personas = hasMore ? result.results.slice(0, limitNum) : result.results;

  const lastPersona = personas[personas.length - 1];
  const nextCursor =
    hasMore && lastPersona
      ? `${lastPersona.createdAt}_${lastPersona.id}`
      : null;

  const countResult = await db
    .prepare("SELECT COUNT(*) as count FROM persona")
    .first<{ count: number }>();

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

  try {
    // スレッドから resourceId を取得
    const thread = await c.env.DB.prepare(
      "SELECT resourceId FROM mastra_threads WHERE id = ?",
    )
      .bind(threadId)
      .first<{ resourceId: string }>();

    if (!thread) {
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
  const db = c.env.DB;

  try {
    const countResult = await db
      .prepare("SELECT COUNT(*) as count FROM persona")
      .first<{ count: number }>();
    const count = countResult?.count ?? 0;

    await db.prepare("DELETE FROM persona").run();
    await db.prepare("DELETE FROM thread_persona_status").run();

    return c.json({
      success: true,
      message: `${count}件のペルソナを削除しました`,
      count,
    });
  } catch (error) {
    console.error("Persona delete error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Persona deletion failed",
    });
  }
});
