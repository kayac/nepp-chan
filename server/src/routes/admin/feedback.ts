import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { count } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { createDb, messageFeedback } from "~/db";
import { feedbackRepository } from "~/repository/feedback-repository";

type AdminBindings = CloudflareBindings & {
  ADMIN_KEY?: string;
};

export const feedbackAdminRoutes = new OpenAPIHono<{
  Bindings: AdminBindings;
}>();

feedbackAdminRoutes.use("*", async (c, next) => {
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

const FeedbackSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  rating: z.string(),
  category: z.string().nullable(),
  comment: z.string().nullable(),
  conversationContext: z.string(),
  toolExecutions: z.string().nullable(),
  createdAt: z.string(),
});

const StatsSchema = z.object({
  total: z.number(),
  good: z.number(),
  bad: z.number(),
  byCategory: z.record(z.string(), z.number()),
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  summary: "フィードバック一覧を取得",
  description: "ユーザーから送信されたフィードバック一覧を取得します",
  tags: ["Admin - Feedback"],
  request: {
    query: z.object({
      limit: z.string().optional().default("30"),
      cursor: z.string().optional(),
      rating: z.enum(["good", "bad"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: z.object({
            feedbacks: z.array(FeedbackSchema),
            total: z.number(),
            nextCursor: z.string().nullable(),
            hasMore: z.boolean(),
            stats: StatsSchema,
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

feedbackAdminRoutes.openapi(listRoute, async (c) => {
  const { limit, cursor, rating } = c.req.valid("query");
  const db = createDb(c.env.DB);
  const limitNum = Number(limit);

  const result = await feedbackRepository.list(c.env.DB, {
    limit: limitNum,
    cursor: cursor ?? undefined,
    rating: rating ?? undefined,
  });

  const stats = await feedbackRepository.getStats(c.env.DB);

  const countResult = await db
    .select({ count: count() })
    .from(messageFeedback)
    .get();

  return c.json(
    {
      feedbacks: result.feedbacks,
      total: countResult?.count ?? 0,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      stats,
    },
    200,
  );
});

const getDetailRoute = createRoute({
  method: "get",
  path: "/:id",
  summary: "フィードバック詳細を取得",
  description: "フィードバックの詳細情報を取得します",
  tags: ["Admin - Feedback"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "取得成功",
      content: {
        "application/json": {
          schema: FeedbackSchema,
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
      description: "フィードバックが見つからない",
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

feedbackAdminRoutes.openapi(getDetailRoute, async (c) => {
  const { id } = c.req.valid("param");

  const feedback = await feedbackRepository.findById(c.env.DB, id);

  if (!feedback) {
    return c.json(
      { success: false, message: "フィードバックが見つかりません" },
      404,
    );
  }

  return c.json(feedback, 200);
});

const deleteAllRoute = createRoute({
  method: "delete",
  path: "/",
  summary: "全フィードバックを削除",
  description: "蓄積された全てのフィードバックを削除します",
  tags: ["Admin - Feedback"],
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

feedbackAdminRoutes.openapi(deleteAllRoute, async (c) => {
  const db = createDb(c.env.DB);

  try {
    const countResult = await db
      .select({ count: count() })
      .from(messageFeedback)
      .get();
    const totalCount = countResult?.count ?? 0;

    await feedbackRepository.deleteAll(c.env.DB);

    return c.json({
      success: true,
      message: `${totalCount}件のフィードバックを削除しました`,
      count: totalCount,
    });
  } catch (error) {
    console.error("Feedback delete error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Feedback deletion failed",
    });
  }
});
