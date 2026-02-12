import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import { deleteAllKnowledge, syncAll } from "~/services/knowledge";
import { requireApiKey, SuccessResponseSchema } from "./schemas";

export const knowledgeSyncRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

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
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

knowledgeSyncRoutes.openapi(deleteAllRoute, async (c) => {
  try {
    const result = await deleteAllKnowledge(c.env.VECTORIZE);
    return c.json(
      {
        message: `${result.deleted}件のベクトルを削除しました`,
        count: result.deleted,
      },
      200,
    );
  } catch (error) {
    console.error("Vectorize delete error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Vectorize delete failed",
    });
  }
});

// POST /admin/knowledge/sync - 全ナレッジを同期
const syncAllRoute = createRoute({
  method: "post",
  path: "/sync",
  summary: "全ナレッジを同期",
  description:
    "R2バケットの全Markdownファイルを読み込み、Vectorizeに同期します",
  tags: ["Admin - Knowledge"],
  responses: {
    200: {
      description: "同期成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            results: z.array(
              z.object({
                file: z.string(),
                chunks: z.number(),
                error: z.string().optional(),
                edited: z.boolean().optional(),
              }),
            ),
            editedCount: z.number().optional(),
          }),
        },
      },
    },
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

knowledgeSyncRoutes.openapi(syncAllRoute, async (c) => {
  const apiKey = requireApiKey(c.env.GOOGLE_GENERATIVE_AI_API_KEY);

  try {
    const result = await syncAll({
      bucket: c.env.KNOWLEDGE_BUCKET,
      vectorize: c.env.VECTORIZE,
      apiKey,
    });

    return c.json(
      {
        message: `${result.totalFiles}ファイル、${result.totalChunks}チャンクを同期しました`,
        results: result.results,
        editedCount: result.editedCount,
      },
      200,
    );
  } catch (error) {
    console.error("Sync error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Sync failed",
    });
  }
});
