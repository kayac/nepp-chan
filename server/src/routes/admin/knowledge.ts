import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { sessionAuth } from "~/middleware/session-auth";
import {
  convertAndUpload,
  deleteAllKnowledge,
  deleteFile,
  getFile,
  getOriginalFile,
  listFiles,
  listUnifiedFiles,
  reconvertFromOriginal,
  syncAll,
  syncFile,
  uploadMarkdownFile,
} from "~/services/knowledge";

export const knowledgeAdminRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

knowledgeAdminRoutes.use("*", sessionAuth);

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

const FileInfoSchema = z.object({
  key: z.string(),
  size: z.number(),
  lastModified: z.string(),
  etag: z.string(),
  edited: z.boolean().optional(),
});

const FilesListResponseSchema = z.object({
  files: z.array(FileInfoSchema),
  truncated: z.boolean(),
});

const UnifiedFileInfoSchema = z.object({
  baseName: z.string(),
  original: z
    .object({
      key: z.string(),
      size: z.number(),
      lastModified: z.string(),
      contentType: z.string(),
    })
    .optional(),
  markdown: z
    .object({
      key: z.string(),
      size: z.number(),
      lastModified: z.string(),
    })
    .optional(),
  hasMarkdown: z.boolean(),
});

const UnifiedFilesListResponseSchema = z.object({
  files: z.array(UnifiedFileInfoSchema),
  truncated: z.boolean(),
});

const FileContentResponseSchema = z.object({
  key: z.string(),
  content: z.string(),
  contentType: z.string(),
  size: z.number(),
  lastModified: z.string(),
});

const SaveFileRequestSchema = z.object({
  content: z.string(),
});

const FileKeyParamSchema = z.object({
  key: z.string().openapi({ param: { name: "key", in: "path" } }),
});

const validateFileKey = (key: string) => {
  if (key.includes("..") || key.startsWith("/")) {
    throw new HTTPException(400, { message: "Invalid file key" });
  }
};

const requireApiKey = (apiKey: string | undefined): string => {
  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }
  return apiKey;
};

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
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(deleteAllRoute, async (c) => {
  try {
    const result = await deleteAllKnowledge(c.env.VECTORIZE);
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
                edited: z.boolean().optional(),
              }),
            ),
            editedCount: z.number().optional(),
          }),
        },
      },
    },
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(syncAllRoute, async (c) => {
  const apiKey = requireApiKey(c.env.GOOGLE_GENERATIVE_AI_API_KEY);

  try {
    const result = await syncAll({
      bucket: c.env.KNOWLEDGE_BUCKET,
      vectorize: c.env.VECTORIZE,
      apiKey,
    });

    return c.json({
      success: true,
      message: `${result.totalFiles}ファイル、${result.totalChunks}チャンクを同期しました`,
      results: result.results,
      editedCount: result.editedCount,
    });
  } catch (error) {
    console.error("Sync error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Sync failed",
    });
  }
});

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
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(listFilesRoute, async (c) => {
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
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "ファイルが見つかりません",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(getFileRoute, async (c) => {
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
            success: z.boolean(),
            message: z.string(),
            chunks: z.number(),
          }),
        },
      },
    },
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(saveFileRoute, async (c) => {
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
        success: true,
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
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(deleteFileRoute, async (c) => {
  const { key } = c.req.valid("param");
  validateFileKey(key);

  try {
    await deleteFile(c.env.KNOWLEDGE_BUCKET, c.env.VECTORIZE, key);
    const baseName = key.replace(/\.md$/, "");
    return c.json(
      { success: true, message: `${baseName} を完全に削除しました` },
      200,
    );
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Delete file error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Delete file failed",
    });
  }
});

// POST /admin/knowledge/upload - ファイルアップロード
const uploadFileRoute = createRoute({
  method: "post",
  path: "/upload",
  summary: "ファイルをアップロード",
  description:
    "Markdownファイルをアップロードし、R2に保存してVectorizeに同期します",
  tags: ["Admin - Knowledge"],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.any().openapi({ type: "string", format: "binary" }),
            filename: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "アップロード成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            key: z.string(),
            chunks: z.number(),
          }),
        },
      },
    },
    400: {
      description: "リクエストエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(uploadFileRoute, async (c) => {
  const apiKey = requireApiKey(c.env.GOOGLE_GENERATIVE_AI_API_KEY);

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const customFilename = formData.get("filename") as string | null;

    if (!file) {
      throw new HTTPException(400, { message: "File is required" });
    }

    if (customFilename) validateFileKey(customFilename);

    const result = await uploadMarkdownFile(file, customFilename, {
      bucket: c.env.KNOWLEDGE_BUCKET,
      vectorize: c.env.VECTORIZE,
      apiKey,
    });

    return c.json(
      {
        success: true,
        message: `ファイルをアップロードし、${result.chunks}チャンクを同期しました`,
        key: result.key,
        chunks: result.chunks,
      },
      200,
    );
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Upload file error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Upload failed",
    });
  }
});

// POST /admin/knowledge/convert - 画像/PDF → Markdown 変換
const convertFileRoute = createRoute({
  method: "post",
  path: "/convert",
  summary: "画像/PDFをMarkdownに変換",
  description:
    "画像またはPDFファイルをGeminiで読み取り、Markdown形式に変換してR2に保存します",
  tags: ["Admin - Knowledge"],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.any().openapi({ type: "string", format: "binary" }),
            filename: z.string().openapi({
              description: "保存するファイル名（.md拡張子）",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "変換成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            key: z.string(),
            originalType: z.string(),
            chunks: z.number(),
          }),
        },
      },
    },
    400: {
      description: "リクエストエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(convertFileRoute, async (c) => {
  const apiKey = requireApiKey(c.env.GOOGLE_GENERATIVE_AI_API_KEY);

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const filename = formData.get("filename") as string | null;

    if (!file) {
      throw new HTTPException(400, { message: "File is required" });
    }
    if (!filename) {
      throw new HTTPException(400, { message: "Filename is required" });
    }

    validateFileKey(filename);

    const result = await convertAndUpload(file, filename, {
      bucket: c.env.KNOWLEDGE_BUCKET,
      vectorize: c.env.VECTORIZE,
      apiKey,
    });

    return c.json(
      {
        success: true,
        message: `ファイルを変換し、${result.chunks}チャンクを同期しました`,
        key: result.key,
        originalType: result.originalType,
        chunks: result.chunks,
      },
      200,
    );
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Convert file error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Convert failed",
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
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(listUnifiedFilesRoute, async (c) => {
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
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "ファイルが見つかりません",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(getOriginalFileRoute, async (c) => {
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

// POST /admin/knowledge/reconvert - 元ファイルからMarkdownを再生成
const reconvertFileRoute = createRoute({
  method: "post",
  path: "/reconvert",
  summary: "元ファイルからMarkdownを再生成",
  description: "originals/ 配下の元ファイルからMarkdownを再生成します",
  tags: ["Admin - Knowledge"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            originalKey: z.string().openapi({
              description: "元ファイルのキー（originals/xxx.pdf）",
            }),
            filename: z.string().openapi({
              description: "保存するMarkdownファイル名",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "再変換成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            key: z.string(),
            chunks: z.number(),
          }),
        },
      },
    },
    400: {
      description: "リクエストエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "認証エラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "元ファイルが見つかりません",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    500: {
      description: "サーバーエラー",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

knowledgeAdminRoutes.openapi(reconvertFileRoute, async (c) => {
  const { originalKey, filename } = c.req.valid("json");
  const apiKey = requireApiKey(c.env.GOOGLE_GENERATIVE_AI_API_KEY);

  if (!originalKey.startsWith("originals/")) {
    throw new HTTPException(400, {
      message: "originalKey must start with 'originals/'",
    });
  }
  validateFileKey(filename);

  try {
    const result = await reconvertFromOriginal(originalKey, filename, {
      bucket: c.env.KNOWLEDGE_BUCKET,
      vectorize: c.env.VECTORIZE,
      apiKey,
    });

    return c.json(
      {
        success: true,
        message: `ファイルを再変換し、${result.chunks}チャンクを同期しました`,
        key: result.key,
        chunks: result.chunks,
      },
      200,
    );
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    console.error("Reconvert file error:", error);
    throw new HTTPException(500, {
      message: error instanceof Error ? error.message : "Reconvert failed",
    });
  }
});
