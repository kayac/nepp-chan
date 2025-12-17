import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import {
  deleteAllKnowledge,
  deleteKnowledgeBySource,
  syncAllKnowledge,
  syncKnowledgeBySource,
} from "~/mastra/knowledge";

type AdminBindings = CloudflareBindings & {
  ADMIN_KEY?: string;
  KNOWLEDGE_BUCKET: R2Bucket;
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
const SyncResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  processedFiles: z.number().optional(),
  totalChunks: z.number().optional(),
  errors: z.array(z.string()).optional(),
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

// POST /admin/knowledge/sync - R2 から全同期
const syncAllRoute = createRoute({
  method: "post",
  path: "/sync",
  summary: "全ナレッジを同期",
  description:
    "R2バケットから全てのMarkdownファイルを読み込み、chunk→embed→Vectorize登録を実行します",
  tags: ["Admin - Knowledge"],
  responses: {
    200: {
      description: "同期成功",
      content: {
        "application/json": {
          schema: SyncResponseSchema,
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

knowledgeAdminRoutes.openapi(syncAllRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const vectorize = c.env.VECTORIZE;
  const apiKey = c.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!bucket) {
    throw new HTTPException(500, {
      message: "KNOWLEDGE_BUCKET is not configured",
    });
  }

  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }

  try {
    const result = await syncAllKnowledge(bucket, vectorize, apiKey);

    return c.json({
      success: result.success,
      message: result.success
        ? `${result.processedFiles}ファイル、${result.totalChunks}チャンクを同期しました`
        : "同期中にエラーが発生しました",
      processedFiles: result.processedFiles,
      totalChunks: result.totalChunks,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("Knowledge sync error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Knowledge sync failed",
    });
  }
});

// POST /admin/knowledge/sync/:source - 特定ファイルのみ同期
const SyncBySourceParamsSchema = z.object({
  source: z.string().openapi({
    param: {
      name: "source",
      in: "path",
    },
    example: "otoineppu.md",
  }),
});

const syncBySourceRoute = createRoute({
  method: "post",
  path: "/sync/:source",
  summary: "特定ファイルを同期",
  description:
    "R2バケットから指定したファイルを読み込み、chunk→embed→Vectorize登録を実行します",
  tags: ["Admin - Knowledge"],
  request: {
    params: SyncBySourceParamsSchema,
  },
  responses: {
    200: {
      description: "同期成功",
      content: {
        "application/json": {
          schema: SyncResponseSchema,
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
    404: {
      description: "ファイルが見つかりません",
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

knowledgeAdminRoutes.openapi(syncBySourceRoute, async (c) => {
  const { source } = c.req.valid("param");
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const vectorize = c.env.VECTORIZE;
  const apiKey = c.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!bucket) {
    throw new HTTPException(500, {
      message: "KNOWLEDGE_BUCKET is not configured",
    });
  }

  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }

  try {
    const result = await syncKnowledgeBySource(
      bucket,
      vectorize,
      source,
      apiKey,
    );

    if (!result.success && result.errors.some((e) => e.includes("not found"))) {
      throw new HTTPException(404, {
        message: `File not found: ${source}`,
      });
    }

    return c.json({
      success: result.success,
      message: result.success
        ? `${source} を同期しました（${result.totalChunks}チャンク）`
        : "同期中にエラーが発生しました",
      processedFiles: result.processedFiles,
      totalChunks: result.totalChunks,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error("Knowledge sync by source error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Knowledge sync failed",
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

// DELETE /admin/knowledge/:source - 特定ソースのデータ削除
const DeleteBySourceParamsSchema = z.object({
  source: z.string().openapi({
    param: {
      name: "source",
      in: "path",
    },
    example: "otoineppu.md",
  }),
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
    const result = await deleteKnowledgeBySource(vectorize, source);

    return c.json({
      success: true,
      message: `ソース "${source}" から${result.deleted}件のベクトルを削除しました`,
      count: result.deleted,
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
