import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { deleteAllKnowledge } from "~/mastra/knowledge";

type AdminBindings = CloudflareBindings & {
  ADMIN_KEY?: string;
};

export const knowledgeAdminRoutes = new OpenAPIHono<{
  Bindings: AdminBindings;
}>();

// 認証ミドルウェア
knowledgeAdminRoutes.use("*", async (c, next) => {
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

// スキーマ定義
const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  count: z.number().optional(),
});

const ErrorResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

// DELETE /admin/knowledge - 全削除
const deleteAllRoute = createRoute({
  method: "delete",
  path: "/",
  summary: "全ナレッジを削除",
  description: "Vectorizeの全ベクトルを削除します",
  tags: ["Admin - Knowledge"],
  responses: {
    200: {
      description: "削除成功",
      content: {
        "application/json": {
          schema: SuccessResponseSchema,
        },
      },
    },
    401: {
      description: "認証エラー",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "サーバーエラー",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

knowledgeAdminRoutes.openapi(deleteAllRoute, async (c) => {
  const vectorize = c.env.VECTORIZE;

  try {
    const result = await deleteAllKnowledge(vectorize);

    return c.json({
      success: true,
      message: `${result.deleted}件のベクトルを削除しました`,
      count: result.deleted,
    });
  } catch (error) {
    console.error("Vectorize delete error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Vectorize delete failed",
    });
  }
});
