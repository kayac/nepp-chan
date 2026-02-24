import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import { sessionAuth } from "~/middleware/session-auth";
import { feedbackRepository } from "~/repository/feedback-repository";
import {
  feedbackFullSchema,
  feedbackStatsSchema,
} from "~/schemas/feedback-schema";

export const feedbackAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

feedbackAdminRoutes.use("*", sessionAuth);

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
            feedbacks: z.array(feedbackFullSchema),
            total: z.number(),
            nextCursor: z.string().nullable(),
            hasMore: z.boolean(),
            stats: feedbackStatsSchema,
          }),
        },
      },
    },
    401: errorResponse(401),
  },
});

feedbackAdminRoutes.openapi(listRoute, async (c) => {
  const { limit, cursor, rating } = c.req.valid("query");
  const limitNum = Number(limit);

  const result = await feedbackRepository.list(c.env.DB, {
    limit: limitNum,
    cursor: cursor ?? undefined,
    rating: rating ?? undefined,
  });

  const stats = await feedbackRepository.getStats(c.env.DB);
  const total = await feedbackRepository.count(c.env.DB);

  return c.json(
    {
      feedbacks: result.feedbacks,
      total,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      stats,
    },
    200,
  );
});

const getDetailRoute = createRoute({
  method: "get",
  path: "/{id}",
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
          schema: feedbackFullSchema,
        },
      },
    },
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

feedbackAdminRoutes.openapi(getDetailRoute, async (c) => {
  const { id } = c.req.valid("param");

  const feedback = await feedbackRepository.findById(c.env.DB, id);

  if (!feedback) {
    throw new HTTPException(404, {
      message: "フィードバックが見つかりません",
    });
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

feedbackAdminRoutes.openapi(deleteAllRoute, async (c) => {
  try {
    const totalCount = await feedbackRepository.count(c.env.DB);
    await feedbackRepository.deleteAll(c.env.DB);

    return c.json(
      {
        message: `${totalCount}件のフィードバックを削除しました`,
        count: totalCount,
      },
      200,
    );
  } catch (error) {
    console.error("Feedback delete error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Feedback deletion failed",
    });
  }
});

const resolveRoute = createRoute({
  method: "put",
  path: "/{id}/resolve",
  summary: "フィードバックを解決済みにする",
  description: "指定したフィードバックを解決済みステータスに変更します",
  tags: ["Admin - Feedback"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "解決済みに変更成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

feedbackAdminRoutes.openapi(resolveRoute, async (c) => {
  const { id } = c.req.valid("param");

  const feedback = await feedbackRepository.findById(c.env.DB, id);
  if (!feedback) {
    throw new HTTPException(404, {
      message: "フィードバックが見つかりません",
    });
  }

  await feedbackRepository.resolve(c.env.DB, id);

  return c.json({ message: "解決済みに変更しました" }, 200);
});

const unresolveRoute = createRoute({
  method: "delete",
  path: "/{id}/resolve",
  summary: "フィードバックを未解決に戻す",
  description: "指定したフィードバックを未解決ステータスに戻します",
  tags: ["Admin - Feedback"],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: "未解決に変更成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    401: errorResponse(401),
    404: errorResponse(404),
  },
});

feedbackAdminRoutes.openapi(unresolveRoute, async (c) => {
  const { id } = c.req.valid("param");

  const feedback = await feedbackRepository.findById(c.env.DB, id);
  if (!feedback) {
    throw new HTTPException(404, {
      message: "フィードバックが見つかりません",
    });
  }

  await feedbackRepository.unresolve(c.env.DB, id);

  return c.json({ message: "未解決に戻しました" }, 200);
});
