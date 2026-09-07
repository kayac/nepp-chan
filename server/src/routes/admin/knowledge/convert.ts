import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { CURATED_DRAFT_LIMITS } from "@nepp-chan/shared/constants/knowledge";
import { HTTPException } from "hono/http-exception";
import { isSupportedMimeType } from "~/lib/image-converter";
import { errorResponse } from "~/lib/openapi-errors";
import type { PrincipalVariables } from "~/lib/principal";
import {
  CuratedDraftError,
  convertAndUpload,
  draftCurated,
  reconvertFromOriginal,
  uploadMarkdownFile,
} from "~/services/knowledge";
import {
  CuratedDraftRequestSchema,
  CuratedDraftResponseSchema,
  validateFileKey,
} from "./schemas";

const toArray = (value: unknown) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

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

// POST /admin/knowledge/curated-draft - URL・テキスト・画像から curated 下書きを生成
const curatedDraftRoute = createRoute({
  method: "post",
  path: "/curated-draft",
  summary: "curated ナレッジの下書きを生成",
  description:
    "URL・貼り付けテキスト・画像/PDF を資料として読み、curated 形式の Markdown 下書きを返します。R2 には保存しません",
  tags: ["Admin - Knowledge"],
  request: {
    body: {
      content: {
        "multipart/form-data": { schema: CuratedDraftRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "下書き",
      content: { "application/json": { schema: CuratedDraftResponseSchema } },
    },
    400: errorResponse(400),
    401: errorResponse(401),
    422: errorResponse(422),
    500: errorResponse(500),
  },
});

knowledgeConvertRoutes.openapi(curatedDraftRoute, async (c) => {
  const body = await c.req.parseBody({ all: true });

  const urls = toArray(body.urls)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
  const files = toArray(body.files).filter((v): v is File => v instanceof File);
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!urls.length && !files.length && !text) {
    throw new HTTPException(400, {
      message: "URL・テキスト・画像のいずれかを入力してください",
    });
  }
  if (urls.length > CURATED_DRAFT_LIMITS.urls) {
    throw new HTTPException(400, {
      message: `URL は ${CURATED_DRAFT_LIMITS.urls} 件までです`,
    });
  }
  if (files.length > CURATED_DRAFT_LIMITS.files) {
    throw new HTTPException(400, {
      message: `画像・PDF は ${CURATED_DRAFT_LIMITS.files} 件までです`,
    });
  }
  const unsupported = files.find((f) => !isSupportedMimeType(f.type));
  if (unsupported) {
    throw new HTTPException(400, {
      message: `未対応のファイル形式です: ${unsupported.name}`,
    });
  }
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > CURATED_DRAFT_LIMITS.filesTotalBytes) {
    throw new HTTPException(400, {
      message: `画像・PDF の合計サイズは ${CURATED_DRAFT_LIMITS.filesTotalBytes / 1024 / 1024}MB までです`,
    });
  }

  try {
    const result = await draftCurated({ urls, text, files }, { d1: c.env.DB });
    return c.json(result, 200);
  } catch (error) {
    if (error instanceof CuratedDraftError) {
      const details = error.unreadable
        .map((item) => `${item.name}（${item.reason}）`)
        .join(" / ");
      throw new HTTPException(422, {
        message: details
          ? `${error.message}。読めなかった資料: ${details}`
          : error.message,
      });
    }
    throw error;
  }
});
