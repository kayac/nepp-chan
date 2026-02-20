import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import {
  deleteFile,
  getFile,
  getOriginalFile,
  listFiles,
  listUnifiedFiles,
  syncFile,
} from "~/services/knowledge";
import {
  FileContentResponseSchema,
  FileKeyParamSchema,
  FilesListResponseSchema,
  requireApiKey,
  SaveFileRequestSchema,
  SuccessResponseSchema,
  UnifiedFilesListResponseSchema,
  validateFileKey,
} from "./schemas";

export const knowledgeFilesRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

// GET /admin/knowledge/files - ファイル一覧取得
const listFilesRoute = createRoute({
  method: "get",
  path: "/files",
  summary: "ファイル一覧を取得",
  description: "R2バケット内のファイル一覧を取得します",
  tags: ["Admin - Knowledge"],
  responses: {
    200: {
      description: "ファイル一覧",
      content: { "application/json": { schema: FilesListResponseSchema } },
    },
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

knowledgeFilesRoutes.openapi(listFilesRoute, async (c) => {
  try {
    const result = await listFiles(c.env.KNOWLEDGE_BUCKET);
    return c.json(result, 200);
  } catch (error) {
    console.error("List files error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "List files failed",
    });
  }
});

// GET /admin/knowledge/files/:key - ファイル内容取得
const getFileRoute = createRoute({
  method: "get",
  path: "/files/{key}",
  summary: "ファイル内容を取得",
  description: "指定したファイルの内容を取得します",
  tags: ["Admin - Knowledge"],
  request: { params: FileKeyParamSchema },
  responses: {
    200: {
      description: "ファイル内容",
      content: { "application/json": { schema: FileContentResponseSchema } },
    },
    401: errorResponse(401),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

knowledgeFilesRoutes.openapi(getFileRoute, async (c) => {
  const { key } = c.req.valid("param");

  try {
    const result = await getFile(c.env.KNOWLEDGE_BUCKET, key);
    if (!result) {
      throw new HTTPException(404, { message: "File not found" });
    }
    return c.json(result, 200);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Get file error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Get file failed",
    });
  }
});

// PUT /admin/knowledge/files/:key - ファイル保存（作成・更新）
const saveFileRoute = createRoute({
  method: "put",
  path: "/files/{key}",
  summary: "ファイルを保存",
  description: "ファイルを作成または更新し、自動でVectorizeに同期します",
  tags: ["Admin - Knowledge"],
  request: {
    params: FileKeyParamSchema,
    body: {
      content: { "application/json": { schema: SaveFileRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "保存成功",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            chunks: z.number(),
          }),
        },
      },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

knowledgeFilesRoutes.openapi(saveFileRoute, async (c) => {
  const { key } = c.req.valid("param");
  const { content } = c.req.valid("json");
  const apiKey = requireApiKey(c.env.GOOGLE_GENERATIVE_AI_API_KEY);

  validateFileKey(key);

  try {
    await c.env.KNOWLEDGE_BUCKET.put(key, content, {
      httpMetadata: { contentType: "text/markdown" },
    });
    console.log(`[Save] Saved ${key} (${content.length} bytes)`);

    const result = await syncFile(key, content, {
      vectorize: c.env.VECTORIZE,
      apiKey,
    });

    return c.json(
      {
        message: `ファイルを保存し、${result.chunks}チャンクを同期しました`,
        chunks: result.chunks,
      },
      200,
    );
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Save file error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Save file failed",
    });
  }
});

// DELETE /admin/knowledge/files/:key - ファイル完全削除
const deleteFileRoute = createRoute({
  method: "delete",
  path: "/files/{key}",
  summary: "ファイルを完全削除",
  description:
    "Markdown、元ファイル（originals/）、Vectorizeのデータをすべて削除します",
  tags: ["Admin - Knowledge"],
  request: { params: FileKeyParamSchema },
  responses: {
    200: {
      description: "削除成功",
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

knowledgeFilesRoutes.openapi(deleteFileRoute, async (c) => {
  const { key } = c.req.valid("param");
  validateFileKey(key);

  try {
    await deleteFile(c.env.KNOWLEDGE_BUCKET, c.env.VECTORIZE, key);
    const baseName = key.replace(/\.md$/, "");
    return c.json({ message: `${baseName} を完全に削除しました` }, 200);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Delete file error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Delete file failed",
    });
  }
});

// GET /admin/knowledge/unified - 統合ファイル一覧取得
const listUnifiedFilesRoute = createRoute({
  method: "get",
  path: "/unified",
  summary: "統合ファイル一覧を取得",
  description:
    "元ファイル（originals/）とMarkdownファイルを統合した一覧を取得します",
  tags: ["Admin - Knowledge"],
  responses: {
    200: {
      description: "統合ファイル一覧",
      content: {
        "application/json": { schema: UnifiedFilesListResponseSchema },
      },
    },
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

knowledgeFilesRoutes.openapi(listUnifiedFilesRoute, async (c) => {
  try {
    const result = await listUnifiedFiles(c.env.KNOWLEDGE_BUCKET);
    return c.json(result, 200);
  } catch (error) {
    console.error("List unified files error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "List unified files failed",
    });
  }
});

// GET /admin/knowledge/originals/:key - 元ファイル取得
const getOriginalFileRoute = createRoute({
  method: "get",
  path: "/originals/{key}",
  summary: "元ファイルを取得",
  description: "originals/ 配下の元ファイルを取得します（画像/PDF）",
  tags: ["Admin - Knowledge"],
  request: { params: FileKeyParamSchema },
  responses: {
    200: { description: "元ファイル（バイナリ）" },
    401: errorResponse(401),
    404: errorResponse(404),
    500: errorResponse(500),
  },
});

knowledgeFilesRoutes.openapi(getOriginalFileRoute, async (c) => {
  const { key } = c.req.valid("param");
  validateFileKey(key);

  try {
    const result = await getOriginalFile(c.env.KNOWLEDGE_BUCKET, key);
    if (!result) {
      throw new HTTPException(404, { message: "File not found" });
    }

    return new Response(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": result.size.toString(),
        "Content-Disposition": `inline; filename="${encodeURIComponent(key)}"`,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Get original file error:", error);
    throw new HTTPException(500, {
      message:
        error instanceof Error ? error.message : "Get original file failed",
    });
  }
});
