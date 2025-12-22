import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import {
  deleteAllKnowledge,
  deleteKnowledgeBySource,
  processKnowledgeFile,
} from "~/mastra/knowledge";

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
            success: z.boolean(),
            message: z.string(),
            results: z.array(
              z.object({
                file: z.string(),
                chunks: z.number(),
                error: z.string().optional(),
              }),
            ),
          }),
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

  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }

  try {
    // R2バケットからファイル一覧を取得
    const listed = await bucket.list();
    const mdFiles = listed.objects.filter((obj) => obj.key.endsWith(".md"));

    console.log(`[Sync] Found ${mdFiles.length} markdown files`);

    const results: { file: string; chunks: number; error?: string }[] = [];

    for (const obj of mdFiles) {
      const file = await bucket.get(obj.key);
      if (!file) {
        results.push({ file: obj.key, chunks: 0, error: "File not found" });
        continue;
      }

      const content = await file.text();
      console.log(`[Sync] Processing ${obj.key} (${content.length} bytes)`);

      // 既存データを削除
      await deleteKnowledgeBySource(vectorize, obj.key);

      // 新しいデータを登録
      const result = await processKnowledgeFile(
        obj.key,
        content,
        vectorize,
        apiKey,
      );

      results.push({
        file: obj.key,
        chunks: result.chunks,
        error: result.error,
      });
    }

    const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);

    return c.json({
      success: true,
      message: `${mdFiles.length}ファイル、${totalChunks}チャンクを同期しました`,
      results,
    });
  } catch (error) {
    console.error("Sync error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Sync failed",
    });
  }
});
