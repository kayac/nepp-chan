import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import {
  convertAndUpload,
  reconvertFromOriginal,
  uploadMarkdownFile,
} from "~/services/knowledge";
import { validateFileKey } from "./schemas";

export const knowledgeConvertRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
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
  const body = await c.req.parseBody();
  const file = body.file;

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "File is required" });
  }

  const customFilename =
    typeof body.filename === "string" ? body.filename : null;
  if (customFilename) validateFileKey(customFilename);

  const result = await uploadMarkdownFile(file, customFilename, {
    bucket: c.env.KNOWLEDGE_BUCKET,
    d1: c.env.DB,
  });

  return c.json(
    {
      message:
        "ファイルをアップロードしました。検索への反映には数十秒かかります",
      key: result.key,
    },
    200,
  );
});

// POST /admin/knowledge/convert - 画像/PDF → Markdown 変換
const convertFileRoute = createRoute({
  method: "post",
  path: "/convert",
  summary: "画像/PDFをMarkdownに変換",
  description:
    "画像またはPDFファイルをLLMで読み取り、Markdown形式に変換してR2に保存します",
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
  const body = await c.req.parseBody();
  const file = body.file;
  const filename = typeof body.filename === "string" ? body.filename : null;

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: "File is required" });
  }
  if (!filename) {
    throw new HTTPException(400, { message: "Filename is required" });
  }

  validateFileKey(filename);

  const result = await convertAndUpload(file, filename, {
    bucket: c.env.KNOWLEDGE_BUCKET,
    d1: c.env.DB,
  });

  return c.json(
    {
      message: "ファイルを変換しました。検索への反映には数十秒かかります",
      key: result.key,
      originalType: result.originalType,
    },
    200,
  );
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
  if (!originalKey.startsWith("originals/")) {
    throw new HTTPException(400, {
      message: "originalKey must start with 'originals/'",
    });
  }
  validateFileKey(filename);

  const result = await reconvertFromOriginal(originalKey, filename, {
    bucket: c.env.KNOWLEDGE_BUCKET,
    d1: c.env.DB,
  });

  return c.json(
    {
      message: "ファイルを再変換しました。検索への反映には数十秒かかります",
      key: result.key,
    },
    200,
  );
});
