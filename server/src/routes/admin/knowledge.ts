import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import {
  deleteAllKnowledge,
  deleteKnowledgeBySource,
  processKnowledgeFile,
} from "~/mastra/knowledge";
import {
  convertToMarkdown,
  isSupportedMimeType,
} from "~/mastra/knowledge/converter";

type AdminBindings = CloudflareBindings & {
  ADMIN_KEY?: string;
};

export const knowledgeAdminRoutes = new OpenAPIHono<{
  Bindings: AdminBindings;
}>();

// 認証ミドルウェア（ヘッダーまたはクエリパラメータで認証）
knowledgeAdminRoutes.use("*", async (c, next) => {
  const adminKeyHeader = c.req.header("X-Admin-Key");
  const adminKeyQuery = c.req.query("adminKey");
  const adminKey = adminKeyHeader || adminKeyQuery;
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

// ファイル情報スキーマ
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

// 統合ファイル情報スキーマ
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

// ファイル内容スキーマ
const FileContentResponseSchema = z.object({
  key: z.string(),
  content: z.string(),
  contentType: z.string(),
  size: z.number(),
  lastModified: z.string(),
});

// ファイル保存リクエストスキーマ
const SaveFileRequestSchema = z.object({
  content: z.string(),
});

// ファイルキーパラメータスキーマ
const FileKeyParamSchema = z.object({
  key: z.string().openapi({ param: { name: "key", in: "path" } }),
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
    const allObjects = listed.objects;

    // Markdown ファイル（originals/ 以外）
    const mdFiles = allObjects.filter(
      (obj) => obj.key.endsWith(".md") && !obj.key.startsWith("originals/"),
    );

    // originals/ 内のファイルをマップ化
    const originalsMap = new Map<string, Date>();
    for (const obj of allObjects) {
      if (obj.key.startsWith("originals/")) {
        // originals/xxx.pdf → xxx
        const baseName = obj.key
          .replace("originals/", "")
          .replace(/\.[^.]+$/, "");
        originalsMap.set(baseName, obj.uploaded);
      }
    }

    console.log(`[Sync] Found ${mdFiles.length} markdown files`);

    const results: {
      file: string;
      chunks: number;
      error?: string;
      edited?: boolean;
    }[] = [];

    for (const obj of mdFiles) {
      const file = await bucket.get(obj.key);
      if (!file) {
        results.push({ file: obj.key, chunks: 0, error: "File not found" });
        continue;
      }

      // 編集済み判定: originals/ の対応ファイルより md が十分新しい場合
      // （同時アップロードは編集済みとみなさない：5秒以内の差は許容）
      const baseName = obj.key.replace(/\.md$/, "");
      const originalUploaded = originalsMap.get(baseName);
      const EDIT_THRESHOLD_MS = 5000;
      const isEdited =
        originalUploaded !== undefined &&
        obj.uploaded.getTime() - originalUploaded.getTime() > EDIT_THRESHOLD_MS;

      const content = await file.text();
      console.log(
        `[Sync] Processing ${obj.key} (${content.length} bytes)${isEdited ? " [EDITED]" : ""}`,
      );

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
        edited: isEdited,
      });
    }

    const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);
    const editedCount = results.filter((r) => r.edited).length;

    return c.json({
      success: true,
      message: `${mdFiles.length}ファイル、${totalChunks}チャンクを同期しました`,
      results,
      editedCount,
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
      content: {
        "application/json": {
          schema: FilesListResponseSchema,
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

knowledgeAdminRoutes.openapi(listFilesRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;

  try {
    const listed = await bucket.list({ limit: 1000 });
    const allObjects = listed.objects;

    // originals/ 内のファイルをマップ化
    const originalsMap = new Map<string, Date>();
    for (const obj of allObjects) {
      if (obj.key.startsWith("originals/")) {
        const baseName = obj.key
          .replace("originals/", "")
          .replace(/\.[^.]+$/, "");
        originalsMap.set(baseName, obj.uploaded);
      }
    }

    // originals/ プレフィックスのファイルは除外し、編集済み情報を追加
    // 編集済み判定: originals/ より md が十分新しい場合（5秒以内の差は同時アップロードとみなす）
    const EDIT_THRESHOLD_MS = 5000;
    const files = allObjects
      .filter((obj) => !obj.key.startsWith("originals/"))
      .map((obj) => {
        const baseName = obj.key.replace(/\.md$/, "");
        const originalUploaded = originalsMap.get(baseName);
        const isEdited =
          originalUploaded !== undefined &&
          obj.uploaded.getTime() - originalUploaded.getTime() >
            EDIT_THRESHOLD_MS;

        return {
          key: obj.key,
          size: obj.size,
          lastModified: obj.uploaded.toISOString(),
          etag: obj.etag,
          edited: isEdited || undefined,
        };
      });

    return c.json(
      {
        files,
        truncated: listed.truncated,
      },
      200,
    );
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
  request: {
    params: FileKeyParamSchema,
  },
  responses: {
    200: {
      description: "ファイル内容",
      content: {
        "application/json": {
          schema: FileContentResponseSchema,
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

knowledgeAdminRoutes.openapi(getFileRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const { key } = c.req.valid("param");

  try {
    const object = await bucket.get(key);
    if (!object) {
      throw new HTTPException(404, { message: "File not found" });
    }

    const content = await object.text();

    return c.json(
      {
        key,
        content,
        contentType: object.httpMetadata?.contentType || "text/markdown",
        size: object.size,
        lastModified: object.uploaded.toISOString(),
      },
      200,
    );
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
      content: {
        "application/json": {
          schema: SaveFileRequestSchema,
        },
      },
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

knowledgeAdminRoutes.openapi(saveFileRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const vectorize = c.env.VECTORIZE;
  const apiKey = c.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const { key } = c.req.valid("param");
  const { content } = c.req.valid("json");

  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }

  // ファイル名のバリデーション（パストラバーサル対策）
  if (key.includes("..") || key.startsWith("/")) {
    throw new HTTPException(400, { message: "Invalid file key" });
  }

  try {
    // R2 に保存
    await bucket.put(key, content, {
      httpMetadata: { contentType: "text/markdown" },
    });

    console.log(`[Save] Saved ${key} (${content.length} bytes)`);

    // Vectorize に同期（既存データを削除してから登録）
    await deleteKnowledgeBySource(vectorize, key);
    const result = await processKnowledgeFile(key, content, vectorize, apiKey);

    if (result.error) {
      console.error(`[Save] Vectorize sync error for ${key}:`, result.error);
    }

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
  request: {
    params: FileKeyParamSchema,
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

knowledgeAdminRoutes.openapi(deleteFileRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const vectorize = c.env.VECTORIZE;
  const { key } = c.req.valid("param");

  // ファイル名のバリデーション（パストラバーサル対策）
  if (key.includes("..") || key.startsWith("/")) {
    throw new HTTPException(400, { message: "Invalid file key" });
  }

  // baseNameを抽出（xxx.md → xxx）
  const baseName = key.replace(/\.md$/, "");

  try {
    // 1. Markdownファイルを削除
    const mdKey = baseName.endsWith(".md") ? baseName : `${baseName}.md`;
    await bucket.delete(mdKey);
    console.log(`[Delete] Deleted ${mdKey} from R2`);

    // 2. 元ファイル（originals/）を検索して削除
    const listed = await bucket.list({ prefix: `originals/${baseName}` });
    for (const obj of listed.objects) {
      // originals/baseName.* にマッチするもののみ削除
      const objBaseName = obj.key
        .replace("originals/", "")
        .replace(/\.[^.]+$/, "");
      if (objBaseName === baseName) {
        await bucket.delete(obj.key);
        console.log(`[Delete] Deleted ${obj.key} from R2`);
      }
    }

    // 3. Vectorize から削除
    await deleteKnowledgeBySource(vectorize, mdKey);
    console.log(`[Delete] Deleted ${mdKey} from Vectorize`);

    return c.json(
      {
        success: true,
        message: `${baseName} を完全に削除しました`,
      },
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
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for Markdown

knowledgeAdminRoutes.openapi(uploadFileRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const vectorize = c.env.VECTORIZE;
  const apiKey = c.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const customFilename = formData.get("filename") as string | null;

    if (!file) {
      throw new HTTPException(400, { message: "File is required" });
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new HTTPException(400, {
        message: `File size exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)`,
      });
    }

    // ファイル名の決定
    let key = customFilename || file.name;
    if (!key.endsWith(".md")) {
      key = `${key}.md`;
    }

    // ファイル名のバリデーション
    if (key.includes("..") || key.startsWith("/")) {
      throw new HTTPException(400, { message: "Invalid filename" });
    }

    const content = await file.text();

    // R2 に保存
    await bucket.put(key, content, {
      httpMetadata: { contentType: "text/markdown" },
    });

    console.log(`[Upload] Uploaded ${key} (${content.length} bytes)`);

    // Vectorize に同期
    await deleteKnowledgeBySource(vectorize, key);
    const result = await processKnowledgeFile(key, content, vectorize, apiKey);

    return c.json(
      {
        success: true,
        message: `ファイルをアップロードし、${result.chunks}チャンクを同期しました`,
        key,
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
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
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

const MAX_CONVERT_FILE_SIZE = 20 * 1024 * 1024; // 20MB for images/PDF

knowledgeAdminRoutes.openapi(convertFileRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const vectorize = c.env.VECTORIZE;
  const apiKey = c.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }

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

    if (file.size > MAX_CONVERT_FILE_SIZE) {
      throw new HTTPException(400, {
        message: `File size exceeds limit (${MAX_CONVERT_FILE_SIZE / 1024 / 1024}MB)`,
      });
    }

    const mimeType = file.type;
    if (!isSupportedMimeType(mimeType)) {
      throw new HTTPException(400, {
        message: `Unsupported file type: ${mimeType}. Supported: image/png, image/jpeg, image/webp, image/gif, application/pdf`,
      });
    }

    // ファイル名の決定
    let key = filename;
    if (!key.endsWith(".md")) {
      key = `${key}.md`;
    }

    // ファイル名のバリデーション
    if (key.includes("..") || key.startsWith("/")) {
      throw new HTTPException(400, { message: "Invalid filename" });
    }

    console.log(`[Convert] Converting ${file.name} (${mimeType}) to ${key}`);

    // converterAgent で Markdown に変換
    const fileData = await file.arrayBuffer();
    const markdown = await convertToMarkdown(fileData, mimeType);

    console.log(`[Convert] Generated ${markdown.length} bytes of markdown`);

    // 元ファイルを originals/ に保存
    const originalExtension = file.name.split(".").pop() || "bin";
    const originalKey = `originals/${key.replace(/\.md$/, `.${originalExtension}`)}`;
    await bucket.put(originalKey, fileData, {
      httpMetadata: { contentType: mimeType },
    });
    console.log(`[Convert] Saved original to ${originalKey}`);

    // Markdown を R2 に保存
    await bucket.put(key, markdown, {
      httpMetadata: { contentType: "text/markdown" },
    });

    // Vectorize に同期
    await deleteKnowledgeBySource(vectorize, key);
    const result = await processKnowledgeFile(key, markdown, vectorize, apiKey);

    return c.json(
      {
        success: true,
        message: `ファイルを変換し、${result.chunks}チャンクを同期しました`,
        key,
        originalType: mimeType,
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
        "application/json": {
          schema: UnifiedFilesListResponseSchema,
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

knowledgeAdminRoutes.openapi(listUnifiedFilesRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;

  try {
    const listed = await bucket.list({ limit: 1000 });
    const allObjects = listed.objects;

    // originals/ 内のファイルをマップ化
    const originalsMap = new Map<
      string,
      { key: string; size: number; uploaded: Date; contentType: string }
    >();
    for (const obj of allObjects) {
      if (obj.key.startsWith("originals/")) {
        const baseName = obj.key
          .replace("originals/", "")
          .replace(/\.[^.]+$/, "");
        const file = await bucket.head(obj.key);
        originalsMap.set(baseName, {
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
          contentType:
            file?.httpMetadata?.contentType || "application/octet-stream",
        });
      }
    }

    // Markdown ファイルをマップ化
    const markdownMap = new Map<
      string,
      { key: string; size: number; uploaded: Date }
    >();
    for (const obj of allObjects) {
      if (obj.key.endsWith(".md") && !obj.key.startsWith("originals/")) {
        const baseName = obj.key.replace(/\.md$/, "");
        markdownMap.set(baseName, {
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
        });
      }
    }

    // 全てのベース名を収集
    const allBaseNames = new Set([
      ...originalsMap.keys(),
      ...markdownMap.keys(),
    ]);

    const files: z.infer<typeof UnifiedFileInfoSchema>[] = [];

    for (const baseName of allBaseNames) {
      const original = originalsMap.get(baseName);
      const markdown = markdownMap.get(baseName);

      files.push({
        baseName,
        original: original
          ? {
              key: original.key,
              size: original.size,
              lastModified: original.uploaded.toISOString(),
              contentType: original.contentType,
            }
          : undefined,
        markdown: markdown
          ? {
              key: markdown.key,
              size: markdown.size,
              lastModified: markdown.uploaded.toISOString(),
            }
          : undefined,
        hasMarkdown: !!markdown,
      });
    }

    // 更新日時でソート（新しい順）
    files.sort((a, b) => {
      const aDate = a.markdown?.lastModified || a.original?.lastModified || "";
      const bDate = b.markdown?.lastModified || b.original?.lastModified || "";
      return bDate.localeCompare(aDate);
    });

    return c.json(
      {
        files,
        truncated: listed.truncated,
      },
      200,
    );
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
  request: {
    params: FileKeyParamSchema,
  },
  responses: {
    200: {
      description: "元ファイル（バイナリ）",
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

knowledgeAdminRoutes.openapi(getOriginalFileRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const { key } = c.req.valid("param");

  // ファイル名のバリデーション
  if (key.includes("..") || key.startsWith("/")) {
    throw new HTTPException(400, { message: "Invalid file key" });
  }

  const fullKey = `originals/${key}`;

  try {
    const object = await bucket.get(fullKey);
    if (!object) {
      throw new HTTPException(404, { message: "File not found" });
    }

    const contentType =
      object.httpMetadata?.contentType || "application/octet-stream";
    const body = await object.arrayBuffer();

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": object.size.toString(),
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
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
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
      description: "元ファイルが見つかりません",
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

knowledgeAdminRoutes.openapi(reconvertFileRoute, async (c) => {
  const bucket = c.env.KNOWLEDGE_BUCKET;
  const vectorize = c.env.VECTORIZE;
  const apiKey = c.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const { originalKey, filename } = c.req.valid("json");

  if (!apiKey) {
    throw new HTTPException(500, {
      message: "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
    });
  }

  // バリデーション
  if (!originalKey.startsWith("originals/")) {
    throw new HTTPException(400, {
      message: "originalKey must start with 'originals/'",
    });
  }

  if (filename.includes("..") || filename.startsWith("/")) {
    throw new HTTPException(400, { message: "Invalid filename" });
  }

  let key = filename;
  if (!key.endsWith(".md")) {
    key = `${key}.md`;
  }

  try {
    // 元ファイルを取得
    const object = await bucket.get(originalKey);
    if (!object) {
      throw new HTTPException(404, { message: "Original file not found" });
    }

    const mimeType =
      object.httpMetadata?.contentType || "application/octet-stream";
    if (!isSupportedMimeType(mimeType)) {
      throw new HTTPException(400, {
        message: `Unsupported file type: ${mimeType}`,
      });
    }

    console.log(
      `[Reconvert] Converting ${originalKey} (${mimeType}) to ${key}`,
    );

    // converterAgent で Markdown に変換
    const fileData = await object.arrayBuffer();
    const markdown = await convertToMarkdown(fileData, mimeType);

    console.log(`[Reconvert] Generated ${markdown.length} bytes of markdown`);

    // Markdown を R2 に保存
    await bucket.put(key, markdown, {
      httpMetadata: { contentType: "text/markdown" },
    });

    // Vectorize に同期
    await deleteKnowledgeBySource(vectorize, key);
    const result = await processKnowledgeFile(key, markdown, vectorize, apiKey);

    return c.json(
      {
        success: true,
        message: `ファイルを再変換し、${result.chunks}チャンクを同期しました`,
        key,
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
