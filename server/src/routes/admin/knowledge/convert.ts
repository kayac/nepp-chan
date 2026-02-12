import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import {
  convertAndUpload,
  reconvertFromOriginal,
  uploadMarkdownFile,
} from "~/services/knowledge";
import { requireApiKey, validateFileKey } from "./schemas";

export const knowledgeConvertRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

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
            message: z.string(),
            key: z.string(),
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

knowledgeConvertRoutes.openapi(uploadFileRoute, async (c) => {
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
            message: z.string(),
            key: z.string(),
            originalType: z.string(),
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

knowledgeConvertRoutes.openapi(convertFileRoute, async (c) => {
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
            message: z.string(),
            key: z.string(),
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

knowledgeConvertRoutes.openapi(reconvertFileRoute, async (c) => {
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
