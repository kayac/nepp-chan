import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

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
const VectorDataSchema = z.object({
  id: z.string(),
  values: z.array(z.number()),
  metadata: z.object({
    source: z.string(),
    section: z.string().optional(),
    subsection: z.string().optional(),
    content: z.string(),
  }),
});

const UpsertRequestSchema = z.object({
  vectors: z.array(VectorDataSchema),
});

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

// POST /admin/knowledge/upsert - ベクトルをupsert
const upsertRoute = createRoute({
  method: "post",
  path: "/upsert",
  summary: "ナレッジベクトルをupsert",
  description: "Vectorizeにベクトルデータをupsertします",
  tags: ["Admin - Knowledge"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpsertRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "upsert成功",
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

knowledgeAdminRoutes.openapi(upsertRoute, async (c) => {
  const { vectors } = c.req.valid("json");
  const vectorize = c.env.VECTORIZE;

  try {
    const vectorizeData = vectors.map((v) => ({
      id: v.id,
      values: v.values,
      metadata: v.metadata,
    }));

    await vectorize.upsert(vectorizeData);

    return c.json({
      success: true,
      message: `${vectors.length}件のベクトルをupsertしました`,
      count: vectors.length,
    });
  } catch (error) {
    console.error("Vectorize upsert error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Vectorize upsert failed",
    });
  }
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
    // Vectorizeの全ベクトルを取得して削除
    // Note: Vectorizeには全削除APIがないため、クエリで取得して削除する
    // 大量のデータがある場合は分割して処理する必要がある
    const dummyVector = new Array(768).fill(0);
    const results = await vectorize.query(dummyVector, {
      topK: 10000,
      returnMetadata: "all",
    });

    if (results.matches.length > 0) {
      const ids = results.matches.map((m) => m.id);
      await vectorize.deleteByIds(ids);
    }

    return c.json({
      success: true,
      message: `${results.matches.length}件のベクトルを削除しました`,
      count: results.matches.length,
    });
  } catch (error) {
    console.error("Vectorize delete error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Vectorize delete failed",
    });
  }
});

// DELETE /admin/knowledge/:source - 特定ソースのデータ削除
const DeleteBySourceParamsSchema = z.object({
  source: z.string(),
});

const deleteBySourceRoute = createRoute({
  method: "delete",
  path: "/:source",
  summary: "特定ソースのナレッジを削除",
  description: "指定したソースのベクトルを削除します",
  tags: ["Admin - Knowledge"],
  request: {
    params: DeleteBySourceParamsSchema,
  },
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

knowledgeAdminRoutes.openapi(deleteBySourceRoute, async (c) => {
  const { source } = c.req.valid("param");
  const vectorize = c.env.VECTORIZE;

  try {
    // ソースでフィルタリングして削除
    const dummyVector = new Array(768).fill(0);
    const results = await vectorize.query(dummyVector, {
      topK: 10000,
      returnMetadata: "all",
      filter: { source: { $eq: source } },
    });

    if (results.matches.length > 0) {
      const ids = results.matches.map((m) => m.id);
      await vectorize.deleteByIds(ids);
    }

    return c.json({
      success: true,
      message: `ソース "${source}" から${results.matches.length}件のベクトルを削除しました`,
      count: results.matches.length,
    });
  } catch (error) {
    console.error("Vectorize delete by source error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error
          ? error.message
          : "Vectorize delete by source failed",
    });
  }
});
