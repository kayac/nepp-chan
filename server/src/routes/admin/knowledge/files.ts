import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import {
  deleteFile,
  getFile,
  getOriginalFile,
  listFiles,
  listUnifiedFiles,
} from "~/services/knowledge";
import {
  FileContentResponseSchema,
  FileKeyParamSchema,
  FilesListResponseSchema,
  SaveFileRequestSchema,
  SuccessResponseSchema,
  UnifiedFilesListResponseSchema,
  validateFileKey,
} from "./schemas";

export const knowledgeFilesRoutes = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Partial<PrincipalVariables>;
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
  const result = await listFiles(c.env.KNOWLEDGE_BUCKET);
  return c.json(result, 200);
});

// GET /admin/knowledge/files/{key} - ファイル内容取得
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
  validateFileKey(key);

  const result = await getFile(c.env.KNOWLEDGE_BUCKET, key);
  if (!result) {
    throw new HTTPException(404, { message: "File not found" });
  }
  return c.json(result, 200);
});

// PUT /admin/knowledge/files/{key} - ファイル保存（作成・更新）
const saveFileRoute = createRoute({
  method: "put",
  path: "/files/{key}",
  summary: "ファイルを保存",
  description:
    "ファイルを作成または更新します。Vectorize への同期は R2 イベント経由で非同期に行われます",
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
      content: { "application/json": { schema: SuccessResponseSchema } },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    500: errorResponse(500),
  },
});

knowledgeFilesRoutes.openapi(saveFileRoute, async (c) => {
  const { key } = c.req.valid("param");
  const { content } = c.req.valid("json");
  validateFileKey(key);

  await c.env.KNOWLEDGE_BUCKET.put(key, content, {
    httpMetadata: { contentType: "text/markdown" },
  });

  return c.json(
    { message: "ファイルを保存しました。検索への反映には数十秒かかります" },
    200,
  );
});

// DELETE /admin/knowledge/files/{key} - ファイル完全削除
const deleteFileRoute = createRoute({
  method: "delete",
  path: "/files/{key}",
  summary: "ファイルを完全削除",
  description:
    "Markdown と元ファイル（originals/）を削除します。Vectorize のデータは R2 イベント経由で削除されます",
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

  await deleteFile(c.env.KNOWLEDGE_BUCKET, key);
  const baseName = key.replace(/\.md$/, "");
  return c.json({ message: `${baseName} を完全に削除しました` }, 200);
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
  const result = await listUnifiedFiles(c.env.KNOWLEDGE_BUCKET);
  return c.json(result, 200);
});

// GET /admin/knowledge/originals/{key} - 元ファイル取得
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
});
